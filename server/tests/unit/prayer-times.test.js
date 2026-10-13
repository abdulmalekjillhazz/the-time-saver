import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAladhanTimingsUrl,
  fetchPrayerTimings,
  normalizeAladhanTimings,
} from '../../src/services/prayerTimes.js';

afterEach(() => vi.unstubAllGlobals());

const sampleTimings = {
  Fajr: '04:58 (+06)',
  Sunrise: '06:08 (+06)',
  Dhuhr: '11:50 (+06)',
  Asr: '15:20 (+06)',
  Maghrib: '17:40 (+06)',
  Isha: '18:50 (+06)',
};

describe('device-location prayer-time source', () => {
  it('uses the supplied coordinates with Karachi method and Hanafi Asr calculation', () => {
    const url = buildAladhanTimingsUrl(
      { latitude: 24.88, longitude: 90.73 },
      new Date('2026-10-12T00:00:00.000Z'),
    );
    expect(url.searchParams.get('latitude')).toBe('24.88');
    expect(url.searchParams.get('longitude')).toBe('90.73');
    expect(url.searchParams.get('school')).toBe('1');
    expect(url.searchParams.get('method')).toBe('1');
    expect(url.searchParams.has('timezonestring')).toBe(false);
  });

  it('queries the client local calendar date when a DD-MM-YYYY date is supplied', () => {
    const url = buildAladhanTimingsUrl({ latitude: 24.88, longitude: 90.73, date: '13-10-2026' });
    expect(url.pathname.endsWith('/timings/13-10-2026')).toBe(true);
    expect(url.searchParams.get('latitude')).toBe('24.88');
    expect(url.searchParams.get('school')).toBe('1');
    expect(url.searchParams.get('method')).toBe('1');
  });

  it('falls back to a timestamp path for a malformed date', () => {
    const url = buildAladhanTimingsUrl(
      { latitude: 24.88, longitude: 90.73, date: 'not-a-date' },
      new Date('2026-10-12T00:00:00.000Z'),
    );
    expect(url.pathname.endsWith('/timings/1791763200')).toBe(true);
  });

  it('normalizes provider times and strips timezone suffixes', () => {
    expect(normalizeAladhanTimings(sampleTimings)).toEqual({
      Fajr: '04:58',
      Sunrise: '06:08',
      Dhuhr: '11:50',
      Asr: '15:20',
      Maghrib: '17:40',
      Isha: '18:50',
    });
  });

  it('rejects malformed upstream times instead of returning inaccurate estimates', () => {
    expect(() => normalizeAladhanTimings({ ...sampleTimings, Asr: '28:10' })).toThrow(/invalid Asr/);
  });

  it('returns normalized timings and the timezone confirmed by Aladhan', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: 200, data: { meta: { timezone: 'Asia/Dhaka' }, timings: sampleTimings } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPrayerTimings(24.88, 90.73, new Date('2026-10-12T00:00:00.000Z'))).resolves.toMatchObject({
      timings: { Fajr: '04:58', Asr: '15:20' },
      timezone: 'Asia/Dhaka',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0].searchParams.get('latitude')).toBe('24.88');
  });

  it('passes the client calendar date through to the Aladhan request', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: 200, data: { meta: { timezone: 'Asia/Dhaka' }, timings: sampleTimings } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPrayerTimings(24.88, 90.73, '13-10-2026')).resolves.toMatchObject({
      timezone: 'Asia/Dhaka',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0].pathname.endsWith('/timings/13-10-2026')).toBe(true);
  });

  it('rejects a missing or invalid provider timezone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: 200, data: { meta: { timezone: 'Invalid/Zone' }, timings: sampleTimings } }),
    })));
    await expect(fetchPrayerTimings(24.88, 90.73)).rejects.toThrow(/invalid timezone/);
  });
});
