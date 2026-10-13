// Nicer azan for prayer notifications, bundled with the app so it plays offline.
//
// "Azan" by Andrewler, Wikimedia Commons,
// CC BY-SA 4.0 International — free to share with attribution, which the app
// shows (AZAN_CREDIT). Source: https://commons.wikimedia.org/wiki/File:Azan.ogg
// (MP3 transcode of the 3 min 3 s recitation featured on the Bengali Wikipedia আযান article).
// Served from /azan.mp3 and cached in Cache Storage on first tap — every later
// play comes from the local cache. The previous /adhan.ogg stays as fallback.
export const AZAN_REMOTE_URL = '/azan.mp3';
export const AZAN_FALLBACK_URL = '/adhan.ogg';
export const AZAN_CACHE_NAME = 'smart-routine-azan-v2';
export const AZAN_CREDIT = 'Azan: “Azan” by Andrewler · CC BY-SA 4.0 (Wikimedia Commons)';

let blobUrl = null;

// Downloads the azan into Cache Storage if needed. Returns the cached
// Response, or null when caching is unavailable (private mode, old browser).
export async function ensureAzanCached(url = AZAN_REMOTE_URL) {
  try {
    if (typeof caches === 'undefined' || typeof fetch === 'undefined') return null;
    const cache = await caches.open(AZAN_CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) return hit;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return null;
    await cache.put(url, res.clone());
    return res;
  } catch {
    return null;
  }
}

// Best playback URL: in-memory blob after the single download, so one download
// replays forever within this visit (and Cache Storage keeps it for later).
export async function getAzanPlaybackUrl() {
  if (blobUrl) return blobUrl;
  try {
    const cached = await ensureAzanCached();
    if (cached && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = await cached.blob();
      if (blob && blob.size > 0) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = URL.createObjectURL(blob);
        return blobUrl;
      }
    }
  } catch {
    // Fall through to the remote URL.
  }
  return AZAN_REMOTE_URL;
}
