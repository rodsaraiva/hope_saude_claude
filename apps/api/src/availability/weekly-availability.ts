import { DateTime } from 'luxon';

export class InvalidAvailabilityPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAvailabilityPayloadError';
  }
}

export type WeeklySlot = {
  id?: number;
  date?: string; // YYYY-MM-DD
  day?: string; // Segunda, etc
  start: string;
  end: string;
  recurrence?: 'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY';
};

export type TimeIntervalMs = {
  startMs: number;
  endMs: number;
};

const WEEKDAY_PT: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
};

/**
 * Valida o payload persistido em DoctorProfile.availability (array JSON de slots).
 */
export function assertValidDoctorAvailabilityJson(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidAvailabilityPayloadError('Disponibilidade deve ser um JSON válido');
  }
  if (!Array.isArray(parsed)) {
    throw new InvalidAvailabilityPayloadError('Disponibilidade deve ser um array JSON');
  }
  for (const item of parsed) {
    if (
      item == null ||
      typeof item !== 'object' ||
      (!('day' in item) && !('date' in item)) ||
      !('start' in item) ||
      !('end' in item) ||
      (typeof (item as { day?: unknown }).day !== 'string' &&
        typeof (item as { date?: unknown }).date !== 'string') ||
      typeof (item as { start: unknown }).start !== 'string' ||
      typeof (item as { end: unknown }).end !== 'string'
    ) {
      throw new InvalidAvailabilityPayloadError(
        'Cada slot deve incluir day ou date, start e end como texto',
      );
    }
  }
}

export function parseAvailabilityJson(raw: string | null | undefined): WeeklySlot[] {
  if (raw == null || raw.trim() === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out: WeeklySlot[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        ('day' in item || 'date' in item) &&
        'start' in item &&
        'end' in item
      ) {
        out.push({
          id: (item as any).id,
          date: (item as any).date,
          day: (item as any).day,
          start: (item as { start: string }).start,
          end: (item as { end: string }).end,
          recurrence: (item as any).recurrence,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Intervalos [startMs, endMs) — fim exclusivo. */
export function intervalsOverlap(a: TimeIntervalMs, b: TimeIntervalMs): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function expandWeeklySlotsInRange(
  from: Date,
  to: Date,
  slots: WeeklySlot[],
  timeZone: string,
): TimeIntervalMs[] {
  if (slots.length === 0) {
    return [];
  }

  const rangeStart = DateTime.fromJSDate(from, { zone: timeZone }).startOf('day');
  const rangeEnd = DateTime.fromJSDate(to, { zone: timeZone }).startOf('day');

  if (rangeStart > rangeEnd) {
    return [];
  }

  const windowStart = DateTime.fromJSDate(from, { zone: timeZone });
  const windowEnd = DateTime.fromJSDate(to, { zone: timeZone });

  const result: TimeIntervalMs[] = [];

  for (let d = rangeStart; d <= rangeEnd; d = d.plus({ days: 1 })) {
    const dayName = WEEKDAY_PT[d.weekday];
    if (dayName === undefined) {
      continue;
    }

    for (const slot of slots) {
      const recurrence = slot.recurrence || 'WEEKLY';

      // Avaliação de Data Específica vs Dia Genérico
      if (slot.date) {
        const slotDate = DateTime.fromISO(slot.date, { zone: timeZone }).startOf('day');

        // Se d (data avaliada) é menor que a data inicial do slot, ele ainda não se aplica
        if (d < slotDate) {
          continue;
        }

        if (recurrence === 'NONE' && d.toISODate() !== slot.date) {
          continue;
        }

        if (recurrence === 'WEEKLY' && d.weekday !== slotDate.weekday) {
          continue;
        }

        if (recurrence === 'WEEKDAYS' && d.weekday > 5) {
          continue;
        }

        if (recurrence === 'BIWEEKLY') {
          if (d.weekday !== slotDate.weekday) continue;

          // Calcula diferença em dias (já que startOf('day') zera as horas)
          const diffMs = d.toMillis() - slotDate.toMillis();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

          // 1 semana = 7 dias, a cada 14 dias repete.
          // Logo, se diffDays for 0, 14, 28... é válido.
          if (diffDays % 14 !== 0) {
            continue;
          }
        }
      } else if (slot.day) {
        // Lógica Legada (Compatibilidade) de dia da semana genérico
        if (recurrence === 'WEEKLY' && slot.day !== dayName) {
          continue;
        }
        if (recurrence === 'WEEKDAYS' && d.weekday > 5) {
          continue;
        }
        if (recurrence === 'BIWEEKLY') {
          if (slot.day !== dayName) continue;
          if (d.weekNumber % 2 !== 0) continue;
        }
      }

      const startParts = parseHourMinute(slot.start);
      const endParts = parseHourMinute(slot.end);
      if (!startParts || !endParts) {
        continue;
      }

      const slotStart = d.set({
        hour: startParts.h,
        minute: startParts.m,
        second: 0,
        millisecond: 0,
      });
      const slotEnd = d.set({
        hour: endParts.h,
        minute: endParts.m,
        second: 0,
        millisecond: 0,
      });

      if (slotEnd.toMillis() <= slotStart.toMillis()) {
        continue;
      }

      const startMs = slotStart.toMillis();
      const endMs = slotEnd.toMillis();

      if (endMs <= windowStart.toMillis() || startMs >= windowEnd.toMillis()) {
        continue;
      }

      result.push({ startMs, endMs });
    }
  }

  result.sort((x, y) => x.startMs - y.startMs);
  return result;
}

function parseHourMinute(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) {
    return null;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) {
    return null;
  }
  return { h, m: min };
}

/**
 * Remove candidatos que tenham qualquer sobreposição com intervalos ocupados (agenda atômica por slot).
 */
export function subtractBusyFromCandidates(
  candidates: TimeIntervalMs[],
  busy: TimeIntervalMs[],
): TimeIntervalMs[] {
  if (busy.length === 0) {
    return [...candidates];
  }
  return candidates.filter((c) => !busy.some((b) => intervalsOverlap(c, b)));
}
