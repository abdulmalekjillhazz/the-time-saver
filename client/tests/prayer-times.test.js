import { describe, expect, it, vi } from 'vitest';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrayerTimesCard } from '../components/PrayerTimesCard.jsx';
import { useAppStore } from '../lib/appStore.js';
import { getPrayerApiDate, getPrayerDateKey, getPrayerOccurrences, nextPrayerInfo } from '../lib/prayerTimes.js';

const prayerTestStore = vi.hoisted(() => {
  let state = {
    showPrayerTimes: false,
    prayerNotificationsEnabled: false,
    lastPrayerNotificationId: '',
  };
  const store = (selector) => selector(state);
  store.getState = () => state;
  store.setState = (nextState) => {
    state = { ...state, ...nextState };
  };
  return { store };
});

vi.mock('../lib/appStore.js', () => ({ useAppStore: prayerTestStore.store }));

const timings = {
  Fajr: '05:00 (+06)',
  Sunrise: '06:10 (+06)',
  Dhuhr: '12:00 (+06)',
  Asr: '15:30 (+06)',
  Maghrib: '17:45 (+06)',
  Isha: '19:00 (+06)',
};

describe('Bangladesh prayer-time conversion', () => {
  it('converts Dhaka wall time to UTC without adding an hour', () => {
    const now = new Date('2026-10-12T22:10:00.000Z');
    const next = nextPrayerInfo(timings, now);
    expect(next.prayer.key).toBe('Fajr');
    expect(next.at.toISOString()).toBe('2026-10-12T23:00:00.000Z');
  });

  it('selects the next prayer from the Dhaka calendar date', () => {
    const now = new Date('2026-10-13T06:15:00.000Z');
    const next = nextPrayerInfo(timings, now);
    expect(next.prayer.key).toBe('Asr');
    expect(next.at.toISOString()).toBe('2026-10-13T09:30:00.000Z');
  });

  it('formats the Aladhan calendar date from the prayer timezone wall clock', () => {
    expect(getPrayerApiDate(new Date('2026-10-12T18:30:00.000Z'), 'Asia/Dhaka')).toBe('13-10-2026');
    expect(getPrayerApiDate(new Date('2026-10-13T04:30:00.000Z'), 'Asia/Dhaka')).toBe('13-10-2026');
  });

  it('ignores malformed prayer times instead of scheduling them at an invalid time', () => {
    expect(getPrayerOccurrences({ Fajr: '29:85' }, new Date('2026-10-12T22:10:00.000Z'))).toEqual([]);
    expect(nextPrayerInfo({ Fajr: 'not a time' }, new Date('2026-10-12T22:10:00.000Z'))).toBeNull();
  });

  it('uses the timezone returned for the device coordinates, including local date boundaries', () => {
    const now = new Date('2026-10-13T04:30:00.000Z');
    expect(getPrayerDateKey(now, 'America/New_York')).toBe('2026-10-13');
    const next = nextPrayerInfo(timings, now, 'America/New_York');
    expect(next.prayer.key).toBe('Fajr');
    expect(next.at.toISOString()).toBe('2026-10-13T09:00:00.000Z');
  });
});

describe('daily direct reference', () => {
  it('renders the Quran/Hadith reference with its citation and no AI reflection', () => {
    const previous = useAppStore.getState();
    const previousReact = globalThis.React;
    globalThis.React = React;
    try {
      useAppStore.setState({ showPrayerTimes: true, prayerNotificationsEnabled: false });
      const alertsOff = renderToStaticMarkup(createElement(PrayerTimesCard, { lang: 'en' }));
      expect(alertsOff).toContain('Daily Quran and Hadith');
      expect(alertsOff).toContain('Source: ');
      expect(alertsOff).not.toContain('Islamic reflection');
      expect(alertsOff).not.toContain('Preview adhan audio');

      useAppStore.setState({ prayerNotificationsEnabled: true });
      const alertsOn = renderToStaticMarkup(createElement(PrayerTimesCard, { lang: 'en' }));
      expect(alertsOn).toContain('Daily Quran and Hadith');
      expect(alertsOn).toContain('<audio');
      expect(alertsOn).not.toContain('controls');
    } finally {
      useAppStore.setState(previous);
      if (previousReact === undefined) delete globalThis.React;
      else globalThis.React = previousReact;
    }
  });

  it('shows the Netrokona default without any school label', () => {
    const previous = useAppStore.getState();
    const previousReact = globalThis.React;
    globalThis.React = React;
    try {
      useAppStore.setState({ showPrayerTimes: true, prayerNotificationsEnabled: false });
      const html = renderToStaticMarkup(createElement(PrayerTimesCard, { lang: 'en' }));
      expect(html).toContain('Netrokona');
      expect(html).not.toContain('Hanafi');
      expect(html).not.toContain('হানাফী');
      const htmlBn = renderToStaticMarkup(createElement(PrayerTimesCard, { lang: 'bn' }));
      expect(htmlBn).toContain('নেত্রকোণা');
      expect(htmlBn).not.toContain('Hanafi');
      expect(htmlBn).not.toContain('হানাফী');
    } finally {
      useAppStore.setState(previous);
      if (previousReact === undefined) delete globalThis.React;
      else globalThis.React = previousReact;
    }
  });
});
