// Browser helpers for closed-app alarm delivery (Web Push).
// Everything here fails soft (throws short codes); the caller maps codes to
// localized copy. Local alarms always keep working without push.
import { apiRequest } from './apiClient.js';
import { base64UrlToBytes } from './calendar.js';

function pushSupported() {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && typeof globalThis.window !== 'undefined'
    && 'PushManager' in globalThis.window
    && 'Notification' in globalThis.window;
}

// Registers the service worker, subscribes this device, and stores the
// subscription on the server with alarm reminders switched on. Existing
// routine/holiday preferences are preserved.
export async function ensureAlarmPushSubscription() {
  if (!pushSupported()) throw new Error('unsupported');
  const { publicKey } = await apiRequest('/api/push/public-key').catch(() => ({}));
  if (typeof publicKey !== 'string' || !publicKey) throw new Error('unavailable');
  const registration = await navigator.serviceWorker.register('/sw.js');
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      });
    } catch (error) {
      if (/push service not available/i.test(error?.message || '')) {
        throw new Error('push-service-unavailable', { cause: error });
      }
      throw error;
    }
  }
  const data = subscription.toJSON();
  if (!data.endpoint || !data.keys?.p256dh || !data.keys?.auth) throw new Error('unavailable');
  const query = new URLSearchParams({ endpoint: data.endpoint });
  const existing = await apiRequest(`/api/push/subscriptions/preferences?${query}`).catch(() => ({}));
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
