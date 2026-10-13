import { getDate } from 'bangla-calendar';

const BENGALI_CALENDAR = { calculationMethod: 'BD' };

function atLocalNoon(year, month, day) {
  return new Date(year, month, day, 12);
}

export function bengaliCalendarMonthRange(year, month) {
  const first = atLocalNoon(year, month, 1);
  const last = atLocalNoon(year, month + 1, 0);
  return {
    first: getDate(first, { ...BENGALI_CALENDAR, format: 'D MMMM' }),
    last: getDate(last, { ...BENGALI_CALENDAR, format: 'D MMMM YYYY' }),
  };
}

export function buildCalendarDays(year, month, holidays = [], { includeBengaliDates = true } = {}) {
  const firstDay = atLocalNoon(year, month, 1);
  const dayCount = atLocalNoon(year, month + 1, 0).getDate();
  const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
  const cells = Array(firstDay.getDay()).fill(null);

  for (let day = 1; day <= dayCount; day += 1) {
    const date = atLocalNoon(year, month, day);
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = date.getDay();
    cells.push({
      day,
      date: dateKey,
      bengaliDay: includeBengaliDates ? getDate(date, { ...BENGALI_CALENDAR, format: 'D' }) : null,
      holidayName: holidayByDate.get(dateKey) || null,
      weekend: weekday === 5 || weekday === 6,
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = globalThis.atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
