import { describe, it, expect } from 'vitest';
import { getWeekEndDate } from '../../src/services/weeklySummary.js';

describe('Weekly Summary: pure utilities', () => {
  describe('getWeekEndDate', () => {
    it('returns the Sunday of the same week for Monday-Saturday', () => {
      // Oct 12, 2026 is a Monday
      expect(getWeekEndDate('2026-10-12')).toBe('2026-10-18'); // next Sunday
      expect(getWeekEndDate('2026-10-13')).toBe('2026-10-18'); // Tuesday -> next Sunday
      expect(getWeekEndDate('2026-10-14')).toBe('2026-10-18'); // Wednesday -> next Sunday
      expect(getWeekEndDate('2026-10-15')).toBe('2026-10-18'); // Thursday -> next Sunday
      expect(getWeekEndDate('2026-10-16')).toBe('2026-10-18'); // Friday -> next Sunday
      expect(getWeekEndDate('2026-10-17')).toBe('2026-10-18'); // Saturday -> next Sunday
    });

    it('returns the same date if it is already a Sunday', () => {
      expect(getWeekEndDate('2026-10-18')).toBe('2026-10-18');
      expect(getWeekEndDate('2026-10-11')).toBe('2026-10-11');
    });

    it('handles month and year boundaries correctly', () => {
      // Test transitions across month boundaries
      expect(getWeekEndDate('2026-09-28')).toBe('2026-10-04'); // Monday of Sept -> following Sunday in Oct
      expect(getWeekEndDate('2026-12-28')).toBe('2027-01-03'); // Monday of Dec -> following Sunday in Jan
    });

    it('handles leap years correctly', () => {
      // 2024 is a leap year; test Feb 29 transitions
      expect(getWeekEndDate('2024-02-26')).toBe('2024-03-03'); // Monday before Feb 29 -> Sunday after
    });
  });
});
