// Restores the last authenticated profile when the API is unreachable.
// This is deliberately a small, non-secret snapshot: it lets the offline shell
// show the user's locally cached routines without pretending the server is up.
// A 401 always clears it, and the next successful /api/me replaces it.
const STORAGE_KEY = 'smart-routine:last-user:v1';

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function cacheOfflineUser(user) {
  if (!user || typeof user.id !== 'string' || !user.id) return false;
  const storage = safeStorage();
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      id: user.id,
      displayName: typeof user.displayName === 'string' ? user.displayName : '',
      avatarId: typeof user.avatarId === 'string' ? user.avatarId : 'sunrise',
      locale: user.locale === 'en' ? 'en' : 'bn',
      timezone: typeof user.timezone === 'string' && user.timezone ? user.timezone : 'Asia/Dhaka',
      cachedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function readOfflineUser() {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id) return null;
    return {
      id: parsed.id,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : 'sunrise',
      locale: parsed.locale === 'en' ? 'en' : 'bn',
      timezone: typeof parsed.timezone === 'string' && parsed.timezone ? parsed.timezone : 'Asia/Dhaka',
      cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : null,
    };
  } catch {
    return null;
  }
}

export function clearOfflineUser() {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// A missing HTTP status means fetch itself failed (no network, DNS, timeout).
// Gateway errors are treated the same way; a 500 is not, because that is a
// server bug rather than an offline device and should still surface as an error.
export function isOfflineFailure(error) {
  const status = error?.status;
  if (typeof status !== 'number') return true;
  return status === 502 || status === 503 || status === 504;
}
