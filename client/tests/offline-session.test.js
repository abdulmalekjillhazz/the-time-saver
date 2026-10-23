import { afterEach, describe, expect, it } from 'vitest';
import {
  cacheOfflineUser,
  clearOfflineUser,
  isOfflineFailure,
  readOfflineUser,
} from '../lib/offlineSession.js';

function memoryStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    key: (index) => [...data.keys()][index] ?? null,
  };
}

const original = globalThis.localStorage;
afterEach(() => {
  if (original === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = original;
});

describe('offline session snapshot', () => {
  it('stores only the safe profile fields and restores them', () => {
    globalThis.localStorage = memoryStorage();
    expect(cacheOfflineUser({
      id: 'user-1',
      displayName: 'Ayesha',
      avatarId: 'sunrise',
      locale: 'en',
      timezone: 'Asia/Dhaka',
      email: 'private@example.com',
      secret: 'should-not-be-written',
    })).toBe(true);
    const restored = readOfflineUser();
    expect(restored).toMatchObject({ id: 'user-1', displayName: 'Ayesha', locale: 'en' });
    expect(restored.email).toBeUndefined();
    expect(restored.secret).toBeUndefined();
  });

  it('rejects corrupt or incomplete snapshots instead of crashing', () => {
    globalThis.localStorage = memoryStorage();
    globalThis.localStorage.setItem('smart-routine:last-user:v1', '{not json');
    expect(readOfflineUser()).toBeNull();
    globalThis.localStorage.setItem('smart-routine:last-user:v1', JSON.stringify({ displayName: 'No id' }));
    expect(readOfflineUser()).toBeNull();
  });

  it('clears the snapshot on sign out', () => {
    globalThis.localStorage = memoryStorage();
    cacheOfflineUser({ id: 'user-1' });
    expect(readOfflineUser()).not.toBeNull();
    expect(clearOfflineUser()).toBe(true);
    expect(readOfflineUser()).toBeNull();
  });

  it('treats missing status and gateway errors as offline, but not a server bug', () => {
    expect(isOfflineFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isOfflineFailure({ status: 503 })).toBe(true);
    expect(isOfflineFailure({ status: 500 })).toBe(false);
    expect(isOfflineFailure({ status: 401 })).toBe(false);
  });
});
