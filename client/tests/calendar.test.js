import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, bengaliCalendarMonthRange, buildCalendarDays } from '../lib/calendar.js';

describe('Bengali holiday calendar', () => {
  it('shows Bengali dates alongside English dates and marks public holidays/weekends', () => {
    const days = buildCalendarDays(2026, 9, [
      { date: '2026-10-08', name: { bn: 'দুর্গা পূজা', en: 'Durga Puja' } },
    ]);
    const eighth = days.find((day) => day?.day === 8);
    const tenth = days.find((day) => day?.day === 10);
    expect(eighth).toMatchObject({ date: '2026-10-08', holidayName: { bn: 'দুর্গা পূজা', en: 'Durga Puja' }, weekend: false });
    expect(eighth.bengaliDay).toBeTruthy();
    expect(tenth).toMatchObject({ date: '2026-10-10', weekend: true });
  });

  it('pads calendar weeks and formats the Bangla month range', () => {
    const days = buildCalendarDays(2026, 9);
    expect(days.length % 7).toBe(0);
    expect(days[0]).toBeNull();
    expect(bengaliCalendarMonthRange(2026, 9).first).toContain('আশ্বিন');
  });

  it('omits Bengali dates when rendering an English-only calendar', () => {
    const days = buildCalendarDays(2026, 9, [], { includeBengaliDates: false });
    expect(days.find((day) => day?.day === 1)).toMatchObject({ day: 1, bengaliDay: null });
  });

  it('converts a VAPID public key to the browser subscription bytes', () => {
    expect([...base64UrlToBytes('AQID')]).toEqual([1, 2, 3]);
  });
});
