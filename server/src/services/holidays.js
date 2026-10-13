import Holidays from 'date-holidays';

const OBSOLETE_BD_HOLIDAY = /মুজিব|শোক দিবস|mujib|mourning day/i;
const holidayCache = new Map();

function holidayNames(year, language) {
  const cacheKey = `${year}:${language}`;
  if (holidayCache.has(cacheKey)) return holidayCache.get(cacheKey);
  const calendar = new Holidays('BD', undefined, undefined, { timezone: 'Asia/Dhaka' });
  calendar.setLanguages(language);
  const byDate = new Map();
  for (const holiday of calendar.getHolidays(year)) {
    const date = holiday.date.slice(0, 10);
    if (holiday.type !== 'public' || OBSOLETE_BD_HOLIDAY.test(holiday.name)) continue;
    const names = byDate.get(date) || [];
    if (!names.includes(holiday.name)) names.push(holiday.name);
    byDate.set(date, names);
  }
  holidayCache.set(cacheKey, byDate);
  return byDate;
}

export function getBangladeshPublicHolidays(year) {
  const bangla = holidayNames(year, 'bn');
  const english = holidayNames(year, 'en');
  return [...bangla].map(([date, bnNames]) => ({
    date,
    name: {
      bn: bnNames.join(' · '),
      en: (english.get(date) || bnNames).join(' · '),
    },
  })).sort((a, b) => a.date.localeCompare(b.date));
}

export function getBangladeshPublicHolidayForDate(date, language = 'en') {
  const year = Number(date.slice(0, 4));
  return getBangladeshPublicHolidays(year).find((holiday) => holiday.date === date)?.name[language] || null;
}

export function isBangladeshWeekend(date) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 5 || weekday === 6;
}

export function getBangladeshDayOff(date, language = 'en') {
  const holiday = getBangladeshPublicHolidayForDate(date, language);
  const weekend = isBangladeshWeekend(date);
  if (!holiday && !weekend) return null;

  const weekendName = language === 'bn' ? 'সাপ্তাহিক ছুটি' : 'Weekly day off';
  return [holiday, weekend ? weekendName : null].filter(Boolean).join(' · ');
}

export function formatHolidayReminderReason(summary, language = 'en') {
  return language === 'bn'
    ? `কারণ: আপনি ছুটির নোটিফিকেশন চালু করেছেন; ${summary}।`
    : `Reason: you enabled holiday notifications; ${summary}.`;
}

export function getHolidayNotificationSlot(localDate, hour, minute) {
  if (minute >= 5) return null;
  if (hour === 9) return { date: localDate, kind: 'day' };
  if (hour === 18) return { date: shiftDate(localDate, 1), kind: 'eve' };
  return null;
}

function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
