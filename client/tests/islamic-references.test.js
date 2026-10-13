import { describe, expect, it } from 'vitest';
import { ISLAMIC_REFERENCES, getDailyIslamicReference } from '../lib/islamicReferences.js';

describe('daily direct Islamic references', () => {
  it('holds a two-week rotation of cited Quran verses and hadith', () => {
    expect(ISLAMIC_REFERENCES.length).toBeGreaterThanOrEqual(14);
    const types = new Set(ISLAMIC_REFERENCES.map((entry) => entry.type));
    expect(types.has('quran')).toBe(true);
    expect(types.has('hadith')).toBe(true);
  });

  it('gives every entry text in both languages plus an exact citation', () => {
    const ids = new Set();
    for (const entry of ISLAMIC_REFERENCES) {
      expect(entry.id).toBeTruthy();
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      expect(['quran', 'hadith']).toContain(entry.type);
      expect(entry.en.trim().length).toBeGreaterThan(0);
      expect(entry.bn.trim().length).toBeGreaterThan(0);
      expect(entry.refEn.trim().length).toBeGreaterThan(0);
      expect(entry.refBn.trim().length).toBeGreaterThan(0);
    }
  });

  it('picks one stable reference per calendar day in Asia/Dhaka', () => {
    const morning = getDailyIslamicReference(new Date('2026-10-12T18:30:00.000Z'), 'Asia/Dhaka');
    const evening = getDailyIslamicReference(new Date('2026-10-13T04:30:00.000Z'), 'Asia/Dhaka');
    expect(morning.id).toBe(evening.id);
    const nextDay = getDailyIslamicReference(new Date('2026-10-13T18:30:00.000Z'), 'Asia/Dhaka');
    expect(nextDay.id).not.toBe(morning.id);
  });

  it('rotates through the whole list across consecutive days', () => {
    const seen = new Set();
    for (let day = 1; day <= ISLAMIC_REFERENCES.length; day += 1) {
      const date = new Date(Date.UTC(2026, 0, day, 6, 0, 0));
      seen.add(getDailyIslamicReference(date, 'Asia/Dhaka').id);
    }
    expect(seen.size).toBe(ISLAMIC_REFERENCES.length);
  });
});
