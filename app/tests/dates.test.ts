import { describe, expect, it } from 'vitest';
import { addDaysIso, weekDates } from '../src/utils/dateUtils';

describe('weekDates', () => {
  it('starts on Monday and covers seven days', () => {
    expect(weekDates('2026-11-01')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('shifts a week by seven days', () => {
    const next = addDaysIso('2026-11-01', 7);
    expect(weekDates(next)[0]).toBe('2026-11-02');
    expect(weekDates(next)[6]).toBe('2026-11-08');
  });
});
