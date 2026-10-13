'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../lib/appStore.js';
import { getPrayerApiDate, getPrayerDateKey, getPrayerOccurrences, nextPrayerInfo, PRAYERS } from '../lib/prayerTimes.js';
import { getDailyIslamicReference } from '../lib/islamicReferences.js';
import { AZAN_CREDIT, AZAN_FALLBACK_URL, AZAN_REMOTE_URL, getAzanPlaybackUrl } from '../lib/azan.js';
import { Card } from './ui/Card.jsx';

// Netrokona, Bangladesh — the card shows these times immediately so the schedule
// is correct for the home location even before (or without) GPS permission.
const DEFAULT_LOCATION = Object.freeze({ latitude: 24.88, longitude: 90.73 });

export function PrayerTimesCard({ lang = 'bn' }) {
  const showPrayerTimes = useAppStore((state) => state.showPrayerTimes);
  const notificationsEnabled = useAppStore((state) => state.prayerNotificationsEnabled);
  const setNotificationsEnabled = useAppStore((state) => state.setPrayerNotificationsEnabled);
  const lastNotificationId = useAppStore((state) => state.lastPrayerNotificationId);
  const setLastNotificationId = useAppStore((state) => state.setLastPrayerNotificationId);
  const [location, setLocation] = useState({ ...DEFAULT_LOCATION, accuracy: null, isDefault: true });
  const [timings, setTimings] = useState(null);
  const [timezone, setTimezone] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [azanUrl, setAzanUrl] = useState(AZAN_REMOTE_URL);
  const adhanAudioRef = useRef(null);
  const isBn = lang === 'bn';
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const prayerDateKey = getPrayerDateKey(now, timezone || browserTimezone);

  const requestLocation = useCallback(async () => {
    setLocating(true);
    setError('');
    setTimings(null);
    setTimezone('');
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
      if (locationError.message !== 'GEOLOCATION_UNSUPPORTED') {
        console.error('Could not get device location for prayer times', locationError);
      }
    } finally {
      setLocating(false);
    }
  }, [isBn]);

  useEffect(() => {
    if (!showPrayerTimes || !location) return undefined;
    let active = true;
    setTimings(null);
    setTimezone('');
    setSource('');
    setError('');
    const query = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      date: getPrayerApiDate(now, timezone || browserTimezone),
    });
    fetch(`/api/calendar/prayers?${query.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          const message = data?.error?.message;
          throw new Error(message?.[lang] || message || 'Prayer times could not be loaded.');
        }
        if (!data?.timings || typeof data.timezone !== 'string' || !data.timezone) {
          throw new Error('Prayer times or location timezone were missing from the response.');
        }
        if (active) {
          setTimings(data.timings);
          setTimezone(data.timezone);
          setSource(data.source || '');
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || (isBn ? 'নামাজের সময় পাওয়া যায়নি।' : 'Prayer times could not be loaded.'));
          console.error('Could not load prayer times for device location', requestError);
        }
      });
    return () => { active = false; };
  }, [showPrayerTimes, location, lang, prayerDateKey, isBn]);

  useEffect(() => {
    if (!showPrayerTimes) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [showPrayerTimes]);

  useEffect(() => {
    if (!showPrayerTimes || !notificationsEnabled || !timings || !timezone
      || typeof window === 'undefined' || !('Notification' in window)) return undefined;
    const notifyPrayer = () => {
      if (Notification.permission !== 'granted') return;
      const currentTime = new Date();
      const due = getPrayerOccurrences(timings, currentTime, timezone).find(({ at }) => (
        at <= currentTime && currentTime.getTime() - at.getTime() <= 5 * 60_000
      ));
      if (!due) return;
      const notificationId = `${due.date}-${due.prayer.key}`;
      if (notificationId === lastNotificationId) return;
      try {
        new Notification(isBn ? `🕌 ${due.prayer.name.bn} নামাজের সময়` : `🕌 ${due.prayer.name.en} prayer time`, {
          body: isBn ? 'এখন নামাজের সময়' : 'It is time to pray',
          tag: `smart-routine-prayer-${notificationId}`,
        });
        setLastNotificationId(notificationId);
        const playback = adhanAudioRef.current?.play();
        playback?.catch((playError) => {
          console.error('Browser blocked automatic adhan playback', playError);
          setAudioBlocked(true);
        });
      } catch (notificationError) {
        setError(notificationError.message || (isBn ? 'নামাজের notification দেখানো যায়নি।' : 'Could not show the prayer notification.'));
        console.error('Could not show the prayer notification', notificationError);
      }
    };
    notifyPrayer();
    const timer = window.setInterval(notifyPrayer, 15_000);
    return () => window.clearInterval(timer);
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
    if (!timings) {
      setError(isBn ? 'আগে device location দিয়ে সঠিক সময় লোড করুন।' : 'Load prayer times from your device location first.');
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
      // Download the Cloudinary azan ONCE (this user tap), then replay from cache.
      void getAzanPlaybackUrl().then((url) => {
        setAzanUrl(url);
        useAppStore.getState().setAzanStatus(url === AZAN_FALLBACK_URL ? 'fallback' : 'ready');
      });
      // Unlock azan audio with this user gesture so later automatic playback is not blocked.
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
        // Audio unlock is best-effort; the preview player still works manually.
      }
    } catch (notificationError) {
      setError(notificationError.message || (isBn ? 'Notification অনুমতি নেওয়া যায়নি।' : 'Could not request notification permission.'));
      console.error('Could not enable prayer notifications', notificationError);
    }
  }

  return (
    <Card className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="brand-orb text-xl">🕌</span>
          <div>
            <h3 className="text-sm font-bold">
              {isBn ? 'নামাজের ওয়াক্ত' : 'Prayer Times'}
            </h3>
            {upcoming ? (
              <p className="mt-1 text-xs font-semibold text-gold-soft" aria-live="polite">
                {isBn ? `পরবর্তী ${upcoming.prayer.name.bn} · বাকি ${remainingHours} ঘণ্টা ${remainingMinutes} মিনিট` : `Next: ${upcoming.prayer.name.en} · ${remainingHours}h ${remainingMinutes}m`}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold-soft">
            {timezone || (isBn ? 'লোকেশন যাচাই হচ্ছে' : 'checking location')}
          </span>
          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            className="secondary-button min-h-9 px-3 py-1 text-xs disabled:opacity-60"
          >
            {locating
              ? (isBn ? 'লোকেশন খোঁজা হচ্ছে…' : 'Finding location…')
              : (isBn ? '📍 আমার লোকেশন যাচাই করুন' : '📍 Verify my location')}
          </button>
          <button
            type="button"
            aria-pressed={notificationsEnabled}
            disabled={!timings && !notificationsEnabled}
            onClick={togglePrayerNotifications}
            className={`primary-button min-h-9 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${notificationsEnabled ? 'bg-sapphire text-on-sapphire' : ''}`}
          >
            {notificationsEnabled
              ? (isBn ? '🔔 নামাজের notification চালু' : '🔔 Prayer alerts on')
              : (isBn ? '🔔 notification চালু করুন' : '🔔 Enable prayer alerts')}
          </button>
        </div>
      </div>

      {location?.isDefault ? (
        <p className="mt-2 text-xs opacity-80">
          {isBn ? 'নেত্রকোণার সময় দেখানো হচ্ছে। আপনার সঠিক অবস্থানের জন্য উপরের Verify বোতাম চাপুন।' : 'Showing Netrokona times. Press Verify above for your exact location.'}
          {timezone ? ` · ${timezone}` : ''}
        </p>
      ) : location ? (
        <p className="mt-2 text-xs opacity-80">
          {isBn ? 'ডিভাইসের স্থানাঙ্ক' : 'Device coordinates'}: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          {Number.isFinite(location.accuracy) ? ` · ±${Math.round(location.accuracy)}m` : ''}
          {timezone ? ` · ${timezone}` : ''}
        </p>
      ) : (
        <p className="mt-2 text-xs opacity-80">
          {isBn ? 'আপনার অবস্থানের সময় দেখাতে browser-এর location permission দিন। HTTPS/localhost-এ খুলুন, browser prompt-এ Allow দিন।' : 'Allow browser location access to show times for your location. Open over HTTPS/localhost and press Allow.'}
        </p>
      )}

      <div className="mt-3 grid grid-cols-5 gap-1.5 text-center sm:gap-2">
        {PRAYERS.map((prayer) => {
          const rawTime = timings?.[prayer.key] || '--:--';
          return (
            <div key={prayer.key} className="routine-tile p-2">
              <span className="block text-xs font-semibold opacity-80">{prayer.name[isBn ? 'bn' : 'en']}</span>
              <span className="mt-1 block font-mono text-xs font-extrabold text-gold-soft sm:text-sm">
                {rawTime.slice(0, 5)}
              </span>
            </div>
          );
        })}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-red-400">{error}</p> : null}
      {source ? <p className="mt-2 text-xs opacity-70">{source}</p> : null}
      <section className="routine-tile mt-2 p-3" aria-live="polite">
        <h4 className="section-heading text-sm">
          {isBn ? 'প্রতিদিনের কুরআন ও হাদিস' : 'Daily Quran and Hadith'}
        </h4>
        <p className="mt-1 inline-block rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold-soft">
          {dailyReference.type === 'quran' ? (isBn ? 'কুরআন' : 'Quran') : (isBn ? 'হাদিস' : 'Hadith')}
        </p>
        {dailyReference.ar ? (
          <p dir="rtl" lang="ar" className="mt-2 text-right text-base font-semibold leading-loose text-gold-soft">
            {dailyReference.ar}
          </p>
        ) : null}
        <p className="mt-1 opacity-90">{dailyReference[isBn ? 'bn' : 'en']}</p>
        <p className="mt-2 text-[11px] font-semibold text-gold-soft">
          {isBn ? 'উৎস: ' : 'Source: '}{dailyReference[isBn ? 'refBn' : 'refEn']}
        </p>
      </section>
      {notificationsEnabled ? (
        <div className="mt-2 space-y-2 text-xs opacity-90">
          <p>{isBn ? 'অ্যাপ/browser চালু থাকলে সময়মতো notification ও আজানের অডিও বাজবে। browser বন্ধ থাকলে আজান বাজবে না। প্রথমবার Enable চাপলে অডিও unlock হয়।' : 'Prayer notifications and azan audio play while the app/browser is running. Azan cannot play after the browser is closed. Audio unlocks when you first press Enable.'}</p>
          <audio
            ref={adhanAudioRef}
            hidden
            preload="auto"
            src={azanUrl}
            onPlay={() => setAudioBlocked(false)}
            onError={() => { if (azanUrl !== AZAN_FALLBACK_URL) setAzanUrl(AZAN_FALLBACK_URL); }}
          />
          <p className="text-xs opacity-75">{AZAN_CREDIT}</p>
          {audioBlocked ? (
            <p role="status">{isBn ? 'Browser স্বয়ংক্রিয় অডিও আটকে দিয়েছে।' : 'The browser blocked automatic audio.'}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
