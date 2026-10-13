const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;

export function buildAladhanTimingsUrl({ latitude, longitude, date }, now = new Date()) {
  const pathSegment = typeof date === 'string' && DATE_RE.test(date)
    ? date
    : String(Math.floor(now.getTime() / 1000));
  const url = new URL(`https://api.aladhan.com/v1/timings/${pathSegment}`);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('method', '1');
  url.searchParams.set('school', '1');
  return url;
}

export function normalizeAladhanTimings(rawTimings) {
  if (!rawTimings || typeof rawTimings !== 'object') {
    throw new Error('Aladhan response did not contain prayer timings.');
  }
  const timings = {};
  for (const key of PRAYER_KEYS) {
    const match = String(rawTimings[key] || '').match(/^\s*(\d{1,2}):(\d{2})/);
    if (!match) throw new Error(`Aladhan response contained an invalid ${key} time.`);
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new Error(`Aladhan response contained an invalid ${key} time.`);
    timings[key] = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  return timings;
}

export async function fetchPrayerTimings(latitude, longitude, dateOrNow = new Date()) {
  const extra = typeof dateOrNow === 'string' ? { date: dateOrNow } : undefined;
  const response = await fetch(buildAladhanTimingsUrl({ latitude, longitude, ...extra }, typeof dateOrNow === 'string' ? undefined : dateOrNow), {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Aladhan returned HTTP ${response.status}.`);
  const body = await response.json();
  const timezone = body?.data?.meta?.timezone;
  if (body?.code !== 200 || typeof timezone !== 'string' || !timezone) {
    throw new Error('Aladhan returned an unsuccessful response or missing timezone.');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    throw new Error('Aladhan returned an invalid timezone.');
  }
  return {
    timings: normalizeAladhanTimings(body.data.timings),
    timezone,
  };
}
