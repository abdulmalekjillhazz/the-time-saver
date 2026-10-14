'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../lib/appStore.js';
import { getPrayerApiDate, getPrayerDateKey, getPrayerOccurrences, nextPrayerInfo, PRAYERS } from '../lib/prayerTimes.js';
import { getDailyIslamicReference } from '../lib/islamicReferences.js';
import { AZAN_CREDIT, AZAN_FALLBACK_URL, AZAN_REMOTE_URL, getAzanPlaybackUrl } from '../lib/azan.js';
import { Card } from './ui/Card.jsx';

const DEFAULT_LOCATION = Object.freeze({ latitude: 24.88, longitude: 90.73 });
const DEFAULT_TIMINGS = Object.freeze({
  Fajr: '04:55',
  Sunrise: '06:08',
  Dhuhr: '11:52',
  Asr: '15:58',
  Maghrib: '17:28',
  Isha: '18:45',
});

async function showSystemNotification(title, options) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          icon: '/icon.svg',
          badge: '/icon.svg',
          vibrate: [200, 100, 200],
          ...options,
        });
        return true;
      }
    }
  } catch {
    // Fallback to standard Notification API below
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export function PrayerTimesCard({ lang = 'bn' }) {
  const showPrayerTimes = useAppStore((state) => state.showPrayerTimes);
  const notificationsEnabled = useAppStore((state) => state.prayerNotificationsEnabled);
  const setNotificationsEnabled = useAppStore((state) => state.setPrayerNotificationsEnabled);
  const lastNotificationId = useAppStore((state) => state.lastPrayerNotificationId);
  const setLastNotificationId = useAppStore((state) => state.setLastPrayerNotificationId);
  const [location, setLocation] = useState({ ...DEFAULT_LOCATION, accuracy: null, isDefault: true });
  const [timings, setTimings] = useState(DEFAULT_TIMINGS);
  const [timezone, setTimezone] = useState('Asia/Dhaka');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [azanUrl, setAzanUrl] = useState(AZAN_REMOTE_URL);
  const adhanAudioRef = useRef(null);
  const isBn = lang === 'bn';
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';
  const prayerDateKey = getPrayerDateKey(now, timezone || browserTimezone);

  const requestLocation = useCallback(async () => {
    setLocating(true);
    setError('');
    try {
      if (!navigator.geolocation) {
        throw new Error('GEOLOCATION_UNSUPPORTED');
      }
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 15_000,
        });
      });
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        isDefault: false,
      });
    } catch (locationError) {
      const messages = {
        GEOLOCATION_UNSUPPORTED: isBn
          ? 'এই browser-এ device location পাওয়া যাচ্ছে না।'
          : 'Device location is not available in this browser.',
        1: isBn
          ? 'সঠিক নামাজের সময় পেতে browser settings-এ location permission দিন।'
          : 'Allow location access in browser settings to get accurate prayer times.',
        2: isBn
          ? 'আপনার device location নির্ধারণ করা যায়নি। GPS চালু করে আবার চেষ্টা করুন।'
          : 'Could not determine your device location. Enable GPS and try again.',
        3: isBn
          ? 'Location পেতে বেশি সময় লাগছে। আবার চেষ্টা করুন।'
          : 'Location lookup timed out. Please try again.',
      };
      setError(messages[locationError.message || locationError.code] || (
        isBn ? 'Device location পাওয়া যায়নি। আবার চেষ্টা করুন।' : 'Could not get device location. Please try again.'
      ));
    } finally {
      setLocating(false);
    }
  }, [isBn]);

  useEffect(() => {
    if (!showPrayerTimes || !location) return undefined;
    let active = true;
    setError('');
    const apiDate = getPrayerApiDate(now, timezone || browserTimezone);
    const query = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      date: apiDate,
    });

    async function loadTimings() {
      try {
        const res = await fetch(`/api/calendar/prayers?${query.toString()}`);
        const data = await res.json();
        if (res.ok && data?.timings && data?.timezone) {
          if (active) {
            setTimings(data.timings);
            setTimezone(data.timezone);
            setSource(data.source || '');
          }
          return;
        }
      } catch {
        // Fallback to direct Aladhan API below
      }

      try {
        const directUrl = `https://api.aladhan.com/v1/timings/${apiDate}?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&method=1&school=1`;
        const res = await fetch(directUrl);
        const body = await res.json();
        if (res.ok && body?.code === 200 && body?.data?.timings) {
          const raw = body.data.timings;
          const clean = {};
          for (const k of ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
            const m = String(raw[k] || '').match(/(\d{1,2}:\d{2})/);
            if (m) clean[k] = m[1];
          }
          if (active && Object.keys(clean).length >= 5) {
            setTimings(clean);
            setTimezone(body.data?.meta?.timezone || 'Asia/Dhaka');
            setSource('Aladhan API');
          }
        }
      } catch {
        // Keep DEFAULT_TIMINGS active
      }
    }

    loadTimings();
    return () => { active = false; };
  }, [showPrayerTimes, location, lang, prayerDateKey, isBn]);

  useEffect(() => {
    if (!showPrayerTimes) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(timer);
  }, [showPrayerTimes]);

  useEffect(() => {
    if (!notificationsEnabled || typeof window === 'undefined') return;
    void getAzanPlaybackUrl().then((url) => {
      if (url) setAzanUrl(url);
    }).catch(() => {});
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!showPrayerTimes || !notificationsEnabled || !timings || !timezone
      || typeof window === 'undefined' || !('Notification' in window)) return undefined;

    const triggerPrayerAlert = (due) => {
      if (!due || Notification.permission !== 'granted') return;
      const notificationId = `${due.date}-${due.prayer.key}`;
      if (notificationId === lastNotificationId) return;

      setLastNotificationId(notificationId);
      setNow(new Date());

      const title = isBn ? `🕌 ${due.prayer.name.bn} নামাজের সময়` : `🕌 ${due.prayer.name.en} prayer time`;
      const body = isBn ? 'এখন নামাজের ওয়াক্ত শুরু হয়েছে। আজান বাজছে।' : 'Prayer waqt has started. Playing Azan.';

      void showSystemNotification(title, {
        body,
        tag: `smart-routine-prayer-${notificationId}`,
        renotify: true,
      });

      try {
        const audio = adhanAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.muted = false;
          const playback = audio.play();
          playback?.catch(() => {
            setAudioBlocked(true);
          });
        }
      } catch {
        setAudioBlocked(true);
      }
    };

    const checkDuePrayer = () => {
      if (Notification.permission !== 'granted') return;
      const currentTime = new Date();
      const due = getPrayerOccurrences(timings, currentTime, timezone).find(({ at }) => (
        at <= currentTime && currentTime.getTime() - at.getTime() <= 10 * 60_000
      ));
      if (due) triggerPrayerAlert(due);
    };

    checkDuePrayer();
    const intervalId = window.setInterval(checkDuePrayer, 15_000);

    let exactTimeoutId = null;
    const next = nextPrayerInfo(timings, new Date(), timezone);
    if (next && next.at) {
      const delayMs = Math.max(500, next.at.getTime() - Date.now() + 250);
      if (delayMs <= 24 * 3_600_000) {
        exactTimeoutId = window.setTimeout(() => {
          triggerPrayerAlert(next);
        }, delayMs);
      }
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') checkDuePrayer();
    };
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      if (exactTimeoutId) window.clearTimeout(exactTimeoutId);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [showPrayerTimes, notificationsEnabled, timings, timezone, lastNotificationId, setLastNotificationId, isBn]);

  useEffect(() => {
    if (showPrayerTimes && notificationsEnabled) return;
    const audio = adhanAudioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [showPrayerTimes, notificationsEnabled]);

  useEffect(() => () => {
    const audio = adhanAudioRef.current;
    if (audio && !audio.paused) audio.pause();
  }, []);

  if (!showPrayerTimes) return null;
  const upcoming = timings && timezone ? nextPrayerInfo(timings, now, timezone) : null;
  const dailyReference = getDailyIslamicReference(now, timezone || browserTimezone);
  const remainingMs = upcoming ? Math.max(0, upcoming.at.getTime() - now.getTime()) : 0;
  const remainingHours = Math.floor(remainingMs / 3_600_000);
  const remainingMinutes = Math.floor((remainingMs % 3_600_000) / 60_000);

  async function togglePrayerNotifications() {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      return;
    }
    if (!('Notification' in window)) {
      setError(isBn ? 'এই browser-এ notification সমর্থিত নয়।' : 'Notifications are not supported in this browser.');
      return;
    }
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') {
        setError(isBn ? 'Browser settings থেকে notification অনুমতি দিন।' : 'Allow notifications in your browser settings.');
        return;
      }
      setError('');
      setNotificationsEnabled(true);

      void getAzanPlaybackUrl().then((url) => {
        setAzanUrl(url);
        useAppStore.getState().setAzanStatus(url === AZAN_FALLBACK_URL ? 'fallback' : 'ready');
      });

      try {
        const audio = adhanAudioRef.current;
        if (audio) {
          audio.muted = true;
          await audio.play().catch(() => {});
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        }
      } catch {
        // Best-effort audio unlock
      }

      const nextText = upcoming
        ? (isBn ? `পরবর্তী আজান: ${upcoming.prayer.name.bn} (${timings[upcoming.prayer.key]?.slice(0, 5)})` : `Next Azan: ${upcoming.prayer.name.en} (${timings[upcoming.prayer.key]?.slice(0, 5)})`)
        : (isBn ? 'প্রতি ওয়াক্তে স্বয়ংক্রিয়ভাবে আজান ও নোটিফিকেশন আসবে।' : 'Automatic Azan alerts are now active for every prayer time.');
      void showSystemNotification(
        isBn ? '🕌 স্বয়ংক্রিয় আজান নোটিফিকেশন চালু হয়েছে' : '🕌 Automatic Azan Notifications Enabled',
        {
          body: nextText,
          tag: 'smart-routine-prayer-enabled',
        }
      );
    } catch (notificationError) {
      setError(notificationError.message || (isBn ? 'Notification অনুমতি নেওয়া যায়নি।' : 'Could not request notification permission.'));
    }
  }

  return (
    <Card className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="brand-orb text-xl">🕌</span>
          <div>
            <h3 className="text-sm font-bold">
              {isBn ? 'নামাজের ওয়াক্ত ও আজান' : 'Prayer Times & Azan'}
            </h3>
            {upcoming ? (
              <p className="mt-1 text-xs font-semibold text-gold-soft" aria-live="polite">
                {isBn ? `পরবর্তী ${upcoming.prayer.name.bn} · বাকি ${remainingHours} ঘণ্টা ${remainingMinutes} মিনিট` : `Next: ${upcoming.prayer.name.en} · ${remainingHours}h ${remainingMinutes}m`}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            className="secondary-button min-h-9 px-3 py-1 text-xs disabled:opacity-60"
          >
            {locating
              ? (isBn ? 'লোকেশন খোঁজা হচ্ছে…' : 'Finding location…')
              : (isBn ? '📍 আমার লোকেশন' : '📍 Verify location')}
          </button>
          <button
            type="button"
            aria-pressed={notificationsEnabled}
            onClick={togglePrayerNotifications}
            className={`primary-button min-h-9 px-3 py-1 text-xs ${notificationsEnabled ? 'bg-sapphire text-on-sapphire' : ''}`}
          >
            {notificationsEnabled
              ? (isBn ? '🔔 আজান চালু আছে' : '🔔 Azan alerts on')
              : (isBn ? '🔔 আজান চালু করুন' : '🔔 Enable Azan alerts')}
          </button>
        </div>
      </div>

      {location?.isDefault ? (
        <p className="mt-2 text-xs opacity-80">
          {isBn ? 'নেত্রকোণার সময় দেখানো হচ্ছে। আপনার সঠিক অবস্থানের জন্য উপরের লোকেশন বোতাম চাপুন।' : 'Showing Netrokona times. Press Verify location above for your exact coordinates.'}
          {timezone ? ` · ${timezone}` : ''}
        </p>
      ) : location ? (
        <p className="mt-2 text-xs opacity-80">
          {isBn ? 'ডিভাইসের স্থানাঙ্ক' : 'Device coordinates'}: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          {Number.isFinite(location.accuracy) ? ` · ±${Math.round(location.accuracy)}m` : ''}
          {timezone ? ` · ${timezone}` : ''}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-5 gap-1.5 text-center sm:gap-2">
        {PRAYERS.map((prayer) => {
          const rawTime = timings?.[prayer.key] || '--:--';
          const isNext = upcoming?.prayer?.key === prayer.key;
          return (
            <div
              key={prayer.key}
              className={`routine-tile p-2 transition ${isNext ? 'border border-gold bg-gold/15 shadow-sm' : ''}`}
            >
              <span className="block text-xs font-semibold opacity-85">{prayer.name[isBn ? 'bn' : 'en']}</span>
              <span className="mt-1 block font-mono text-xs font-extrabold text-gold-soft sm:text-sm">
                {rawTime.slice(0, 5)}
              </span>
            </div>
          );
        })}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-red-400">{error}</p> : null}
      <section className="routine-tile mt-2.5 p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <h4 className="section-heading text-xs sm:text-sm">
            {isBn ? 'প্রতিদিনের কুরআন ও হাদিস' : 'Daily Quran and Hadith'}
          </h4>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold-soft">
            {dailyReference.type === 'quran' ? (isBn ? 'কুরআন' : 'Quran') : (isBn ? 'হাদিস' : 'Hadith')}
          </span>
        </div>
        {dailyReference.ar ? (
          <p dir="rtl" lang="ar" className="mt-2 text-right text-base font-semibold leading-loose text-gold-soft">
            {dailyReference.ar}
          </p>
        ) : null}
        <p className="mt-1 text-xs sm:text-sm opacity-90">{dailyReference[isBn ? 'bn' : 'en']}</p>
        <p className="mt-1.5 text-[11px] font-semibold text-gold-soft">
          {isBn ? 'উৎস: ' : 'Source: '}{dailyReference[isBn ? 'refBn' : 'refEn']}
        </p>
      </section>
      {notificationsEnabled ? (
        <div className="mt-2 space-y-1.5 text-xs opacity-90">
          <p>{isBn ? '✅ স্বয়ংক্রিয় আজান সক্রিয়: প্রতি ওয়াক্তে নোটিফিকেশন ও আজানের ধ্বনি বাজবে।' : '✅ Automatic Azan active: notifications and Azan audio will play at each prayer time.'}</p>
          <audio
            ref={adhanAudioRef}
            hidden
            preload="auto"
            src={azanUrl}
            onPlay={() => setAudioBlocked(false)}
            onError={() => { if (azanUrl !== AZAN_FALLBACK_URL) setAzanUrl(AZAN_FALLBACK_URL); }}
          />
          <p className="text-[11px] opacity-70">{AZAN_CREDIT}</p>
          {audioBlocked ? (
            <button
              type="button"
              onClick={() => {
                adhanAudioRef.current?.play().catch(() => {});
                setAudioBlocked(false);
              }}
              className="mt-1 rounded-lg border border-gold bg-gold/20 px-3 py-1.5 text-xs font-bold text-gold-soft"
            >
              {isBn ? '🔊 আজানের সাউন্ড আনলক করতে এখানে ট্যাপ করুন' : '🔊 Tap here to unmute Azan audio'}
            </button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
