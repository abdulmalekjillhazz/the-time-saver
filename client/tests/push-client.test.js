import { describe, expect, it, vi, afterEach } from 'vitest';
import { ensureAlarmPushSubscription } from '../lib/pushClient.js';

const originalWindow = globalThis.window;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

function stubBrowser() {
  const subscription = {
    endpoint: 'https://push.example.test/alarm-device',
    toJSON: () => ({ endpoint: 'https://push.example.test/alarm-device', keys: { p256dh: 'p256dh-value', auth: 'auth-value' } }),
  };
  const registration = {
    pushManager: {
      getSubscription: async () => null,
      subscribe: vi.fn(async () => subscription),
    },
  };
  vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn(async () => registration) } });
  globalThis.window = { PushManager: function PushManager() {}, Notification: {} };
  return { registration };
}

describe('closed-app alarm push subscription', () => {
  it('subscribes the device with alarm reminders on, preserving other prefs', async () => {
    stubBrowser();
    const posts = [];
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const target = String(url);
      if (target.endsWith('/api/push/public-key')) return { ok: true, json: async () => ({ publicKey: 'AQIDBAUGBwgJ' }) };
      if (target.includes('/preferences')) {
        return { ok: true, json: async () => ({ routineReminders: false, holidayReminders: true, alarmReminders: false }) };
      }
      if (target.endsWith('/api/auth/csrf')) return { ok: true, json: async () => ({ csrfToken: 'csrf-1' }) };
      posts.push([target, JSON.parse(options.body)]);
      return { ok: true, json: async () => ({ ok: true }) };
    }));

    const data = await ensureAlarmPushSubscription();
    expect(data.endpoint).toBe('https://push.example.test/alarm-device');
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toMatchObject({
      endpoint: 'https://push.example.test/alarm-device',
      routineReminders: false,
      holidayReminders: true,
      alarmReminders: true,
    });
  });

  it('throws a short code when push is unsupported', async () => {
    vi.stubGlobal('navigator', {});
    globalThis.window = {};
    await expect(ensureAlarmPushSubscription()).rejects.toThrow('unsupported');
  });

  it('identifies a browser push service outage before submitting a subscription', async () => {
    const { registration } = stubBrowser();
    registration.pushManager.subscribe.mockRejectedValue(
      new Error('Registration failed - push service not available'),
    );
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ publicKey: 'AQIDBAUGBwgJ' }),
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(ensureAlarmPushSubscription()).rejects.toThrow('push-service-unavailable');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
