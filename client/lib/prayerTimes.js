export const PRAYERS = [
  { key: 'Fajr', name: { bn: 'ফজর', en: 'Fajr' } },
  { key: 'Dhuhr', name: { bn: 'যোহর', en: 'Dhuhr' } },
  { key: 'Asr', name: { bn: 'আসর', en: 'Asr' } },
  { key: 'Maghrib', name: { bn: 'মাগরিব', en: 'Maghrib' } },
  { key: 'Isha', name: { bn: 'এশা', en: 'Isha' } },
];

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
}

export function getPrayerDateKey(date, timeZone = 'Asia/Dhaka') {
  const local = getZonedParts(date, timeZone);
  return `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
}

// DD-MM-YYYY in the prayer timezone, matching the Aladhan timings/{date} endpoint
// so the server queries the user's local calendar date instead of the server's date.
export function getPrayerApiDate(date, timeZone = 'Asia/Dhaka') {
  const local = getZonedParts(date, timeZone);
  return `${String(local.day).padStart(2, '0')}-${String(local.month).padStart(2, '0')}-${local.year}`;
}

function zonedDateTimeToDate({ year, month, day, hour, minute }, timeZone = 'Asia/Dhaka') {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = targetAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = getZonedParts(new Date(timestamp), timeZone);
    const zonedAsUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
    const adjustment = targetAsUtc - zonedAsUtc;
    timestamp += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(timestamp);
}

function parsePrayerClock(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function getPrayerOccurrences(timings, now = new Date(), timeZone = 'Asia/Dhaka') {
  if (!timings) return [];
  const local = getZonedParts(now, timeZone);
  const dateParts = {
    year: local.year,
    month: local.month,
    day: local.day,
  };
  return PRAYERS.flatMap((prayer) => {
    const clock = parsePrayerClock(timings[prayer.key]);
    if (!clock) return [];
    return [{
      prayer,
      date: getPrayerDateKey(now, timeZone),
      at: zonedDateTimeToDate({ ...dateParts, ...clock }, timeZone),
    }];
  }).sort((a, b) => a.at - b.at);
}

export function nextPrayerInfo(timings, now = new Date(), timeZone = 'Asia/Dhaka') {
  const occurrences = getPrayerOccurrences(timings, now, timeZone);
  const upcoming = occurrences.find(({ at }) => at > now);
  if (upcoming) return upcoming;
  const local = getZonedParts(now, timeZone);
  const nextDay = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  const nextParts = {
    year: nextDay.getUTCFullYear(),
    month: nextDay.getUTCMonth() + 1,
    day: nextDay.getUTCDate(),
  };
  const fajr = parsePrayerClock(timings?.Fajr);
  if (!fajr) return null;
  return {
    prayer: PRAYERS[0],
    date: `${nextParts.year}-${String(nextParts.month).padStart(2, '0')}-${String(nextParts.day).padStart(2, '0')}`,
    at: zonedDateTimeToDate({ ...nextParts, ...fajr }, timeZone),
  };
}
