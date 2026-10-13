// Browser helpers for closed-app alarm delivery (Web Push).
// Everything here fails soft (throws short codes); the caller maps codes to
// localized copy. Local alarms always keep working without push.
import { apiRequest } from './apiClient.js';
import { base64UrlToBytes } from './calendar.js';

function pushSupported() {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// Registers the service worker, subscribes this device, and stores the
// subscription on the server with alarm reminders switched on. Existing
// routine/holiday preferences are preserved.
export async function ensureAlarmPushSubscription() {
  if (!pushSupported()) throw new Error('unsupported');
  const { publicKey } = await apiRequest('/api/push/public-key').catch(() => ({}));
  if (typeof publicKey !== 'string' || !publicKey) throw new Error('unavailable');
  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    });
  const data = subscription.toJSON();
  if (!data.endpoint || !data.keys?.p256dh || !data.keys?.auth) throw new Error('unavailable');
  let existing = {};
  try {
    const query = new URLSearchParams({ endpoint: data.endpoint });
    existing = await apiRequest(`/api/push/subscriptions/preferences?${query}`);
  } catch {
    existing = {};
  }
  await apiRequest('/api/push/subscriptions', {
    method: 'POST',
    body: {
      endpoint: data.endpoint,
      keys: data.keys,
      routineReminders: existing.routineReminders ?? true,
      holidayReminders: existing.holidayReminders ?? false,
      alarmReminders: true,
    },
  });
  return data;
}

export function isPushSupported() {
  return pushSupported();
}
