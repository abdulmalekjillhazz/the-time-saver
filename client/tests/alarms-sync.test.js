import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  syncAlarmCreate,
  syncAlarmDelete,
  syncAlarmUpdate,
  reportAlarmFired,
  fetchServerAlarms,
  fetchMissedAlarms,
  acknowledgeAlarm,
} from '../lib/alarmsSync.js';

const user = { timezone: 'Asia/Dhaka' };
const alarm = { id: 'abc-123', at: 1790000000000, label: 'ফজর', firedAt: null };

function stubFetch(handler) {
  globalThis.fetch = vi.fn(async (url, options = {}) => handler(String(url), options));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('alarm server mirror (offline-first)', () => {
  it('returns null without a logged-in user and never touches the network', async () => {
    stubFetch(async () => { throw new Error('must not fetch'); });
    await expect(syncAlarmCreate(null, alarm)).resolves.toBeNull();
    await expect(fetchMissedAlarms(null)).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('creates an alarm with the client id, time, name, and timezone', async () => {
    const seen = [];
    stubFetch(async (url, options) => {
      seen.push([url, options]);
      if (url.endsWith('/api/auth/csrf')) {
        return { ok: true, json: async () => ({ csrfToken: 'csrf-1' }) };
      }
      return {
        ok: true,
        json: async () => ({ alarm: { clientId: 'abc-123', at: 1790000000000, name: 'ফজর', firedAt: null, acknowledgedAt: null } }),
      };
    });
    const created = await syncAlarmCreate(user, alarm);
    expect(created).toMatchObject({ id: 'abc-123', label: 'ফজর' });
    const [, postOptions] = seen.find(([url]) => url === '/api/alarms');
    expect(JSON.parse(postOptions.body)).toMatchObject({
      clientId: 'abc-123',
      at: 1790000000000,
      name: 'ফজর',
      timezone: 'Asia/Dhaka',
    });
  });

  it('returns null when the network fails, keeping local alarms working', async () => {
    stubFetch(async () => { throw new Error('offline'); });
    await expect(syncAlarmCreate(user, alarm)).resolves.toBeNull();
    await expect(syncAlarmDelete(user, 'abc-123')).resolves.toBeNull();
    await expect(syncAlarmUpdate(user, 'abc-123', { at: 1 })).resolves.toBeNull();
    await expect(reportAlarmFired(user, 'abc-123')).resolves.toBeNull();
    await expect(fetchServerAlarms(user)).resolves.toEqual([]);
    await expect(acknowledgeAlarm(user, 'abc-123')).resolves.toBeNull();
  });

  it('fetches and acknowledges missed alarms', async () => {
    stubFetch(async (url) => {
      if (url.endsWith('/api/auth/csrf')) return { ok: true, json: async () => ({ csrfToken: 'csrf-1' }) };
      if (url.includes('missed=1')) {
        return {
          ok: true,
          json: async () => ({ alarms: [{ clientId: 'm1', at: 1, name: 'Late', firedAt: 2, acknowledgedAt: null }] }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    const missed = await fetchMissedAlarms(user);
    expect(missed).toEqual([{ id: 'm1', at: 1, label: 'Late', firedAt: 2, acknowledgedAt: null }]);
    await expect(acknowledgeAlarm(user, 'm1')).resolves.toBe(true);
  });
});
