export const DEFAULT_PRAYER_ANCHORS = [
  { key: 'Fajr', name: { bn: 'ফজর', en: 'Fajr' }, defaultTime: '05:00', anchorHabit: { bn: 'ফজরের নামাজের পর', en: 'After Fajr prayer' } },
  { key: 'Dhuhr', name: { bn: 'যোহর', en: 'Dhuhr' }, defaultTime: '12:45', anchorHabit: { bn: 'যোহরের নামাজের পর', en: 'After Dhuhr prayer' } },
  { key: 'Asr', name: { bn: 'আসর', en: 'Asr' }, defaultTime: '16:15', anchorHabit: { bn: 'আসরের নামাজের পর', en: 'After Asr prayer' } },
  { key: 'Maghrib', name: { bn: 'মাগরিব', en: 'Maghrib' }, defaultTime: '18:00', anchorHabit: { bn: 'মাগরিবের নামাজের পর', en: 'After Maghrib prayer' } },
  { key: 'Isha', name: { bn: 'এশা', en: 'Isha' }, defaultTime: '19:30', anchorHabit: { bn: 'এশার নামাজের পর', en: 'After Isha prayer' } },
];

function addMinutesToTime(timeStr, minutesToAdd) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = (h * 60 + m + minutesToAdd + 1440) % 1440;
  return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

export function calculatePrayerRoutineTimes({ prayerKey, offsetMinutes = 15, durationMinutes = 30, prayerTimings = null }) {
  const anchor = DEFAULT_PRAYER_ANCHORS.find((p) => p.key === prayerKey) || DEFAULT_PRAYER_ANCHORS[0];
  const baseTime = (prayerTimings && prayerTimings[prayerKey]?.slice(0, 5)) || anchor.defaultTime;
  const startTime = addMinutesToTime(baseTime, offsetMinutes);
  const endTime = addMinutesToTime(startTime, durationMinutes);
  return { startTime, endTime, anchorHabit: anchor.anchorHabit };
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export function toBanglaNumber(num) {
  return String(num).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatNaturalTime(timeStr, lang = 'bn') {
  if (!timeStr || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const minutePadded = String(m).padStart(2, '0');
  if (lang === 'en') {
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${minutePadded} ${period}`;
  }
  let periodBn = 'সকাল';
  if (h >= 4 && h < 6) periodBn = 'ভোর';
  else if (h >= 6 && h < 12) periodBn = 'সকাল';
  else if (h >= 12 && h < 15) periodBn = 'দুপুর';
  else if (h >= 15 && h < 18) periodBn = 'বিকাল';
  else if (h >= 18 && h < 20) periodBn = 'সন্ধ্যা';
  else periodBn = 'রাত';
  return `${periodBn} ${toBanglaNumber(h % 12 || 12)}:${toBanglaNumber(minutePadded)}`;
}
