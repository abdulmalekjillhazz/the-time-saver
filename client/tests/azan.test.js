import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

let azan;
let REMOTE;

beforeEach(async () => {
  vi.resetModules();
  azan = await import('../lib/azan.js');
  REMOTE = azan.AZAN_REMOTE_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('azan audio source', () => {
  it('uses the Cloudinary azan first and keeps the Cloudinary fallback', () => {
    expect(REMOTE).toBe('https://res.cloudinary.com/fnxzbafx/video/upload/v1792674330/smart-routine/app-media/smart-routine-azan-v1.mp3');
    expect(azan.AZAN_FALLBACK_URL).toBe('https://res.cloudinary.com/fnxzbafx/video/upload/v1792674331/smart-routine/app-media/smart-routine-adhan-fallback-v1.ogg');
    expect(azan.AZAN_CREDIT).toMatch(/Andrewler/);
  });

  it('returns the remote URL when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(azan.getAzanPlaybackUrl()).resolves.toBe(REMOTE);
  });

  it('downloads once, then replays later plays from the local cache', async () => {
    const body = new Blob(['fake-audio-bytes'], { type: 'audio/mpeg' });
    const networkResponse = new Response(body, { status: 200 });
    const stored = new Map();
    vi.stubGlobal('fetch', vi.fn(async () => networkResponse.clone()));
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async (url) => stored.get(url) || null,
        put: async (url, res) => { stored.set(url, res); },
      }),
    });
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:cached-azan', revokeObjectURL: () => {} });

    await expect(azan.ensureAzanCached()).resolves.not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(azan.getAzanPlaybackUrl()).resolves.toBe('blob:cached-azan');
    // Second round replays the same download: no second network hit.
    await expect(azan.getAzanPlaybackUrl()).resolves.toBe('blob:cached-azan');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to remote URL when the download fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    vi.stubGlobal('caches', {
      open: async () => ({ match: async () => null, put: async () => {} }),
    });
    await expect(azan.ensureAzanCached()).resolves.toBeNull();
    await expect(azan.getAzanPlaybackUrl()).resolves.toBe(REMOTE);
  });
});
