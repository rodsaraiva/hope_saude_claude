export type Slot = {
  id: number;
  date?: string; // YYYY-MM-DD
  day?: string; // Segunda, etc.
  start: string;
  end: string;
  recurrence?: 'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY';
};

const WEEKDAY_PT: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

/** Verifica se um Slot (legado de dia ou novo com data) deve renderizar em um Date específico. */
export function doesSlotApplyToDate(slot: Slot, date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  const dayName = WEEKDAY_PT[date.getDay()];
  const recurrence = slot.recurrence || 'WEEKLY';

  if (slot.date) {
    if (dateStr < slot.date) return false;

    if (recurrence === 'NONE') {
      return dateStr === slot.date;
    }

    const slotDate = new Date(slot.date + 'T12:00:00Z'); // Evitar timezone shift
    if (recurrence === 'WEEKLY') {
      return date.getDay() === slotDate.getDay();
    }

    if (recurrence === 'DAILY') {
      return true;
    }

    if (recurrence === 'WEEKDAYS') {
      return date.getDay() >= 1 && date.getDay() <= 5;
    }

    if (recurrence === 'BIWEEKLY') {
      if (date.getDay() !== slotDate.getDay()) return false;
      const diffTime = date.getTime() - slotDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays % 14 === 0;
    }
  } else if (slot.day) {
    if (recurrence === 'WEEKLY') return slot.day === dayName;
    if (recurrence === 'DAILY') return true;
    if (recurrence === 'WEEKDAYS') return date.getDay() >= 1 && date.getDay() <= 5;
    if (recurrence === 'BIWEEKLY') {
      // simplificação na UI: mostrar nas semanas pares/ímpares baseado em alguma logica ou apenas WEEKLY por compatibilidade
      // aqui faremos simplificado: só vamos retornar true se for a mesma paridade de semana
      if (slot.day !== dayName) return false;
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      return weekNumber % 2 !== 0;
    }
  }

  return false;
}

/** Pega as 7 datas de uma semana começando no domingo, a partir de qualquer data. */
export function getWeekDays(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day; // ajusta pro domingo
  const startOfWeek = new Date(baseDate);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Retorna os dias de um mês num grid de 6 semanas (42 dias). */
export function getMonthDaysGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDiff = firstDay.getDay();
  const startGrid = new Date(firstDay);
  startGrid.setDate(firstDay.getDate() - startDiff);

  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(startGrid);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function generateTimeSlots(startHour: number, endHour: number, intervalMinutes: number) {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMinutes) {
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return slots;
}

export const TIME_SLOTS = generateTimeSlots(0, 24, 15);

export function mergeSlots(slots: Slot[]): Slot[] {
  if (slots.length === 0) return [];

  // Group slots by sua chave identificadora (seja a date pra slots novos, ou o day pra legados)
  const slotsByKey: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const key = slot.date ? slot.date : slot.day || 'unknown';
    if (!slotsByKey[key]) {
      slotsByKey[key] = [];
    }
    slotsByKey[key].push(slot);
  }

  const mergedSlots: Slot[] = [];

  for (const key in slotsByKey) {
    const daySlots = slotsByKey[key];

    // Sort slots by start time
    daySlots.sort((a, b) => a.start.localeCompare(b.start));

    const dayMerged: Slot[] = [];
    let currentSlot = { ...daySlots[0] };

    for (let i = 1; i < daySlots.length; i++) {
      const nextSlot = daySlots[i];

      // Check if slots overlap or are adjacent
      // Since they are sorted by start, we only need to check current.end >= next.start
      if (currentSlot.end >= nextSlot.start) {
        // Merge them: current.end = max(current.end, next.end)
        if (nextSlot.end > currentSlot.end) {
          currentSlot.end = nextSlot.end;
        }
      } else {
        dayMerged.push(currentSlot);
        currentSlot = { ...nextSlot };
      }
    }
    dayMerged.push(currentSlot);
    mergedSlots.push(...dayMerged);
  }

  return mergedSlots;
}
