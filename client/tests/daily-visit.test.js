import { describe, expect, it } from 'vitest';
import { recordDailyVisit } from '../lib/dailyVisit.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('daily app visits', () => {
  it('starts a one-day streak on the first visit', () => {
    expect(recordDailyVisit(createStorage(), 'user-1', new Date(2026, 9, 16)))
      .toEqual({ streak: 1, checkedInToday: true });
  });

  it('keeps the same streak when the user visits again that day', () => {
    const storage = createStorage({
      'smart-routine:daily-visit:user-1': JSON.stringify({ date: '2026-10-16', streak: 4 }),
    });

    expect(recordDailyVisit(storage, 'user-1', new Date(2026, 9, 16)))
      .toEqual({ streak: 4, checkedInToday: true });
  });

  it('increments on the next consecutive local calendar day', () => {
    const storage = createStorage({
      'smart-routine:daily-visit:user-1': JSON.stringify({ date: '2026-10-15', streak: 4 }),
    });

    expect(recordDailyVisit(storage, 'user-1', new Date(2026, 9, 16)))
      .toEqual({ streak: 5, checkedInToday: true });
  });

  it('restarts after a missed day and isolates each user', () => {
    const storage = createStorage({
      'smart-routine:daily-visit:user-1': JSON.stringify({ date: '2026-10-14', streak: 4 }),
    });

    expect(recordDailyVisit(storage, 'user-1', new Date(2026, 9, 16)).streak).toBe(1);
    expect(recordDailyVisit(storage, 'user-2', new Date(2026, 9, 16)).streak).toBe(1);
  });
});
