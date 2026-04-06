import { mergeSlots, Slot } from '../slot-utils';

describe('mergeSlots', () => {
  it('should return empty array for empty input', () => {
    expect(mergeSlots([])).toEqual([]);
  });

  it('should return the same array for single slot', () => {
    const slots: Slot[] = [{ id: 1, day: 'Segunda', start: '10:00', end: '11:00' }];
    expect(mergeSlots(slots)).toEqual(slots);
  });

  it('should merge adjacent slots on the same day', () => {
    const slots: Slot[] = [
      { id: 1, day: 'Segunda', start: '10:00', end: '11:00' },
      { id: 2, day: 'Segunda', start: '11:00', end: '12:00' },
    ];
    const merged = mergeSlots(slots);
    expect(merged.length).toBe(1);
    expect(merged[0]).toMatchObject({ day: 'Segunda', start: '10:00', end: '12:00' });
  });

  it('should merge overlapping slots on the same day', () => {
    const slots: Slot[] = [
      { id: 1, day: 'Segunda', start: '10:00', end: '11:30' },
      { id: 2, day: 'Segunda', start: '11:00', end: '12:00' },
    ];
    const merged = mergeSlots(slots);
    expect(merged.length).toBe(1);
    expect(merged[0]).toMatchObject({ day: 'Segunda', start: '10:00', end: '12:00' });
  });

  it('should not merge slots on different days', () => {
    const slots: Slot[] = [
      { id: 1, day: 'Segunda', start: '10:00', end: '11:00' },
      { id: 2, day: 'Terça', start: '11:00', end: '12:00' },
    ];
    const merged = mergeSlots(slots);
    expect(merged.length).toBe(2);
    expect(merged).toContainEqual(slots[0]);
    expect(merged).toContainEqual(slots[1]);
  });

  it('should handle complex multiple merge scenarios', () => {
    const slots: Slot[] = [
      { id: 1, day: 'Segunda', start: '08:00', end: '09:00' },
      { id: 2, day: 'Segunda', start: '09:00', end: '10:00' },
      { id: 3, day: 'Segunda', start: '11:00', end: '12:00' },
      { id: 4, day: 'Segunda', start: '11:30', end: '13:00' },
      { id: 5, day: 'Segunda', start: '14:00', end: '15:00' },
    ];
    const merged = mergeSlots(slots);
    expect(merged.length).toBe(3);
    expect(merged).toContainEqual(expect.objectContaining({ start: '08:00', end: '10:00' }));
    expect(merged).toContainEqual(expect.objectContaining({ start: '11:00', end: '13:00' }));
    expect(merged).toContainEqual(expect.objectContaining({ start: '14:00', end: '15:00' }));
  });

  it('should handle unordered inputs', () => {
    const slots: Slot[] = [
      { id: 2, day: 'Segunda', start: '11:00', end: '12:00' },
      { id: 1, day: 'Segunda', start: '10:00', end: '11:00' },
    ];
    const merged = mergeSlots(slots);
    expect(merged.length).toBe(1);
    expect(merged[0]).toMatchObject({ day: 'Segunda', start: '10:00', end: '12:00' });
  });

  it('should merge slots with 15-min granularity', () => {
    const slots: Slot[] = [
      { id: 1, day: 'Segunda', start: '13:15', end: '14:00' },
      { id: 2, day: 'Segunda', start: '14:00', end: '15:45' },
    ];
    const merged = mergeSlots(slots);
    expect(merged.length).toBe(1);
    expect(merged[0]).toMatchObject({ day: 'Segunda', start: '13:15', end: '15:45' });
  });
});
