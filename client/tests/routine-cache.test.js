import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCachedRoutines,
  loadCachedRoutinesForOffline,
  readCachedRoutines,
  readLatestCachedRoutines,
  saveCachedRoutines,
} from '../lib/routineCache.js';

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

const routines = [
  { id: 'r1', title: 'Morning walk', startTime: '07:00', endTime: '07:30', completionStatus: 'done' },
  { id: 'r2', title: 'Read', startTime: '20:00', endTime: '20:30', completionStatus: null },
];

const original = globalThis.localStorage;
afterEach(() => {
  if (original === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = original;
});

describe('routine offline cache', () => {
  it('round-trips the exact dated snapshot', () => {
    globalThis.localStorage = memoryStorage();
    expect(saveCachedRoutines('u1', '2026-10-23', routines)).toBe(true);
    expect(readCachedRoutines('u1', '2026-10-23')).toEqual(routines);
    expect(readCachedRoutines('u1', '2026-10-24')).toBeNull();
  });

  it('rejects malformed payloads and dates', () => {
    globalThis.localStorage = memoryStorage();
    expect(saveCachedRoutines('u1', '2026-10-23', [{ title: 'No id' }])).toBe(false);
    expect(saveCachedRoutines('u1', 'yesterday', routines)).toBe(false);
    globalThis.localStorage.setItem('smart-routine:routines:u1:2026-10-23', '{broken');
    expect(readCachedRoutines('u1', '2026-10-23')).toBeNull();
  });

  it('falls back to the latest previous snapshot and clears stale completion status', () => {
    globalThis.localStorage = memoryStorage();
    saveCachedRoutines('u1', '2026-10-20', routines);
    saveCachedRoutines('u1', '2026-10-22', routines);
    saveCachedRoutines('other-user', '2026-10-23', routines);
    expect(readLatestCachedRoutines('u1')?.date).toBe('2026-10-22');

    const offline = loadCachedRoutinesForOffline('u1', '2026-10-23');
    expect(offline.stale).toBe(true);
    expect(offline.date).toBe('2026-10-22');
    expect(offline.routines.every((routine) => routine.completionStatus === null)).toBe(true);
  });

  it('marks the same-day snapshot as fresh', () => {
    globalThis.localStorage = memoryStorage();
    saveCachedRoutines('u1', '2026-10-23', routines);
    const offline = loadCachedRoutinesForOffline('u1', '2026-10-23');
    expect(offline.stale).toBe(false);
    expect(offline.routines[0].completionStatus).toBe('done');
  });

  it('clears every snapshot for one user without touching another user', () => {
    globalThis.localStorage = memoryStorage();
    saveCachedRoutines('u1', '2026-10-22', [{ id: 'a', title: 'One' }]);
    saveCachedRoutines('u1', '2026-10-23', [{ id: 'a', title: 'One' }]);
    saveCachedRoutines('u2', '2026-10-23', [{ id: 'b', title: 'Two' }]);

    expect(clearCachedRoutines('u1')).toBe(true);
    expect(readCachedRoutines('u1', '2026-10-22')).toBeNull();
    expect(readCachedRoutines('u1', '2026-10-23')).toBeNull();
    expect(readCachedRoutines('u2', '2026-10-23')).not.toBeNull();
  });
});
