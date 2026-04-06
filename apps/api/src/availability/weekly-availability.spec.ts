import { DateTime } from 'luxon';
import {
  parseAvailabilityJson,
  expandWeeklySlotsInRange,
  subtractBusyFromCandidates,
  intervalsOverlap,
  assertValidDoctorAvailabilityJson,
  InvalidAvailabilityPayloadError,
} from './weekly-availability';

describe('weekly-availability', () => {
  describe('parseAvailabilityJson', () => {
    it('retorna array vazio para null ou string vazia', () => {
      expect(parseAvailabilityJson(null)).toEqual([]);
      expect(parseAvailabilityJson('')).toEqual([]);
    });

    it('retorna array vazio para JSON inválido', () => {
      expect(parseAvailabilityJson('not-json')).toEqual([]);
    });

    it('retorna array vazio se não for array', () => {
      expect(parseAvailabilityJson('{}')).toEqual([]);
    });

    it('parseia slots com day, start e end', () => {
      const raw = JSON.stringify([{ day: 'Segunda', start: '08:00', end: '09:00', id: 1 }]);
      expect(parseAvailabilityJson(raw)).toEqual([{ day: 'Segunda', start: '08:00', end: '09:00', id: 1, date: undefined, recurrence: undefined }]);
    });
  });

  describe('intervalsOverlap', () => {
    it('detecta sobreposição parcial', () => {
      const a = { startMs: 100, endMs: 200 };
      const b = { startMs: 150, endMs: 250 };
      expect(intervalsOverlap(a, b)).toBe(true);
    });

    it('retorna false quando não há sobreposição', () => {
      const a = { startMs: 100, endMs: 200 };
      const b = { startMs: 200, endMs: 300 };
      expect(intervalsOverlap(a, b)).toBe(false);
    });
  });

  describe('expandWeeklySlotsInRange', () => {
    const zone = 'America/Sao_Paulo';

    it('expande slot de Segunda para a segunda-feira dentro do intervalo', () => {
      const slots = [{ day: 'Segunda', start: '08:00', end: '09:00', recurrence: 'WEEKLY' }];
      // 6 abr 2026 é segunda-feira (America/Sao_Paulo)
      const from = DateTime.fromObject({ year: 2026, month: 4, day: 4 }, { zone }).startOf('day').toJSDate();
      const to = DateTime.fromObject({ year: 2026, month: 4, day: 12 }, { zone }).endOf('day').toJSDate();

      const expanded = expandWeeklySlotsInRange(from, to, slots, zone);

      const monday806 = DateTime.fromObject(
        { year: 2026, month: 4, day: 6, hour: 8, minute: 0, second: 0, millisecond: 0 },
        { zone },
      );
      expect(expanded.length).toBeGreaterThanOrEqual(1);
      expect(expanded.some((i) => i.startMs === monday806.toMillis())).toBe(true);
    });

    it('expande slot com data específica (evento único)', () => {
      const slots = [{ date: '2026-04-15', start: '08:00', end: '09:00', recurrence: 'NONE' }];
      const from = DateTime.fromObject({ year: 2026, month: 4, day: 10 }, { zone }).startOf('day').toJSDate();
      const to = DateTime.fromObject({ year: 2026, month: 4, day: 20 }, { zone }).endOf('day').toJSDate();

      const expanded = expandWeeklySlotsInRange(from, to, slots as any, zone);

      expect(expanded.length).toBe(1);
      const start = DateTime.fromMillis(expanded[0].startMs).setZone(zone);
      expect(start.toISODate()).toBe('2026-04-15');
    });

    it('expande slot com data e recorrência DAILY a partir da data', () => {
      const slots = [{ date: '2026-04-15', start: '08:00', end: '09:00', recurrence: 'DAILY' }];
      const from = DateTime.fromObject({ year: 2026, month: 4, day: 10 }, { zone }).startOf('day').toJSDate();
      const to = DateTime.fromObject({ year: 2026, month: 4, day: 20 }, { zone }).endOf('day').toJSDate();

      const expanded = expandWeeklySlotsInRange(from, to, slots as any, zone);

      // Começa dia 15 e vai até dia 20 (inclui 15, 16, 17, 18, 19, 20) = 6 ocorrências
      expect(expanded.length).toBe(6);
      const first = DateTime.fromMillis(expanded[0].startMs).setZone(zone);
      expect(first.toISODate()).toBe('2026-04-15');
    });

    it('expande slot DAILY para todos os dias no intervalo', () => {
      const slots = [{ day: 'Segunda', start: '08:00', end: '09:00', recurrence: 'DAILY' }];
      const from = DateTime.fromObject({ year: 2026, month: 4, day: 6 }, { zone }).startOf('day').toJSDate();
      const to = DateTime.fromObject({ year: 2026, month: 4, day: 8 }, { zone }).endOf('day').toJSDate();

      const expanded = expandWeeklySlotsInRange(from, to, slots, zone);

      // Deve ter dia 6, 7 e 8
      expect(expanded.length).toBe(3);
    });

    it('expande slot WEEKDAYS apenas para dias de semana', () => {
      const slots = [{ day: 'Segunda', start: '08:00', end: '09:00', recurrence: 'WEEKDAYS' }];
      // Sábado 4 a Segunda 6
      const from = DateTime.fromObject({ year: 2026, month: 4, day: 4 }, { zone }).startOf('day').toJSDate();
      const to = DateTime.fromObject({ year: 2026, month: 4, day: 6 }, { zone }).endOf('day').toJSDate();

      const expanded = expandWeeklySlotsInRange(from, to, slots, zone);

      // Sábado(4) e Domingo(5) não devem entrar, Segunda(6) deve.
      expect(expanded.length).toBe(1);
      const start = DateTime.fromMillis(expanded[0].startMs).setZone(zone);
      expect(start.weekday).toBe(1); // Segunda
    });

    it('expande slot BIWEEKLY apenas em semanas alternadas (paridade)', () => {
      const slots = [{ day: 'Segunda', start: '08:00', end: '09:00', recurrence: 'BIWEEKLY' }];
      // Semana 15 (Segunda 6 Abr) e Semana 16 (Segunda 13 Abr)
      const from = DateTime.fromObject({ year: 2026, month: 4, day: 5 }, { zone }).startOf('day').toJSDate();
      const to = DateTime.fromObject({ year: 2026, month: 4, day: 14 }, { zone }).endOf('day').toJSDate();

      const expanded = expandWeeklySlotsInRange(from, to, slots, zone);

      // Deve aparecer apenas uma vez (semana 15 ou 16, dependendo da implementação da paridade escolhida)
      expect(expanded.length).toBe(1);
    });

    it('retorna vazio quando intervalo de datas é inválido (from > to)', () => {
      const slots = [{ day: 'Segunda', start: '08:00', end: '09:00' }];
      const from = new Date('2026-04-10T00:00:00.000Z');
      const to = new Date('2026-04-01T00:00:00.000Z');
      expect(expandWeeklySlotsInRange(from, to, slots, zone)).toEqual([]);
    });
  });

  describe('assertValidDoctorAvailabilityJson', () => {
    it('aceita array vazio', () => {
      expect(() => assertValidDoctorAvailabilityJson('[]')).not.toThrow();
    });

    it('aceita slots válidos', () => {
      const raw = JSON.stringify([{ day: 'Segunda', start: '08:00', end: '09:00' }]);
      expect(() => assertValidDoctorAvailabilityJson(raw)).not.toThrow();
    });

    it('rejeita JSON inválido', () => {
      expect(() => assertValidDoctorAvailabilityJson('not json')).toThrow(InvalidAvailabilityPayloadError);
    });

    it('rejeita quando item não tem day/start/end', () => {
      expect(() => assertValidDoctorAvailabilityJson('[{"day":"Segunda"}]')).toThrow(
        InvalidAvailabilityPayloadError,
      );
    });
  });

  describe('subtractBusyFromCandidates', () => {
    it('remove candidatos que colidem com intervalo ocupado', () => {
      const candidates = [
        { startMs: 1000, endMs: 2000 },
        { startMs: 3000, endMs: 4000 },
      ];
      const busy = [{ startMs: 1500, endMs: 1600 }];
      const free = subtractBusyFromCandidates(candidates, busy);
      expect(free).toEqual([{ startMs: 3000, endMs: 4000 }]);
    });

    it('remove candidato totalmente coberto por busy', () => {
      const candidates = [{ startMs: 1000, endMs: 2000 }];
      const busy = [{ startMs: 900, endMs: 2100 }];
      expect(subtractBusyFromCandidates(candidates, busy)).toEqual([]);
    });
  });
});
