import { describe, expect, it } from 'vitest';
import {
  getBangladeshDayOff,
  getBangladeshPublicHolidays,
  getHolidayNotificationSlot,
  formatHolidayReminderReason,
  isBangladeshWeekend,
} from '../../src/services/holidays.js';

describe('Bangladesh holiday calendar', () => {
  it('lists translated public holidays and filters cancelled observances', () => {
    const holidays = getBangladeshPublicHolidays(2026);
    expect(holidays).toContainEqual({
      date: '2026-02-21',
      name: { bn: 'শহীদ দিবস', en: "Language Martyrs' Day" },
    });
    expect(holidays.some((holiday) => holiday.date === '2026-03-17')).toBe(false);
  });

  it('marks Friday and Saturday as weekly days off', () => {
    expect(isBangladeshWeekend('2026-10-09')).toBe(true);
    expect(isBangladeshWeekend('2026-10-11')).toBe(false);
    expect(getBangladeshDayOff('2026-10-10', 'bn')).toBe('সাপ্তাহিক ছুটি');
  });

  it('selects the evening-before and morning-of push windows', () => {
    expect(getHolidayNotificationSlot('2026-10-08', 18, 2)).toEqual({ date: '2026-10-09', kind: 'eve' });
    expect(getHolidayNotificationSlot('2026-10-09', 9, 4)).toEqual({ date: '2026-10-09', kind: 'day' });
    expect(getHolidayNotificationSlot('2026-10-09', 9, 5)).toBeNull();
  });

  it('states why holiday notifications are being sent in the selected language', () => {
    expect(formatHolidayReminderReason('Weekly day off', 'en'))
      .toBe('Reason: you enabled holiday notifications; Weekly day off.');
    expect(formatHolidayReminderReason('সাপ্তাহিক ছুটি', 'bn'))
      .toBe('কারণ: আপনি ছুটির নোটিফিকেশন চালু করেছেন; সাপ্তাহিক ছুটি।');
  });
});
