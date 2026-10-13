import { describe, it, expect } from 'vitest';
import { computeStreak, addDays } from '../src/index.js';

describe('addDays', () => {
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('computeStreak', () => {
  it('returns zeros when nothing is done', () => {
    expect(computeStreak([], '2026-10-12')).toEqual({ current: 0, longest: 0 });
  });

  it('counts consecutive days ending today', () => {
    const dates = ['2026-10-10', '2026-10-11', '2026-10-12'];
    expect(computeStreak(dates, '2026-10-12')).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the streak alive when today is not done yet', () => {
    const dates = ['2026-10-10', '2026-10-11'];
    expect(computeStreak(dates, '2026-10-12')).toEqual({ current: 2, longest: 2 });
  });

  it('resets current to zero after a missed day, but keeps longest', () => {
    const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-09'];
    expect(computeStreak(dates, '2026-10-12')).toEqual({ current: 0, longest: 3 });
  });

  it('ignores duplicates and invalid dates', () => {
    const dates = ['2026-10-11', '2026-10-11', '2026-02-30', 'garbage'];
    expect(computeStreak(dates, '2026-10-11')).toEqual({ current: 1, longest: 1 });
  });
});
