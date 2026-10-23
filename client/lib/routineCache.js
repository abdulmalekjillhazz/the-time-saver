// Local routine snapshots used when the API is unreachable.
// The key shape matches the cache the app has always written, so existing
// offline installs keep working after this change.
const PREFIX = 'smart-routine:routines:';

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function keyFor(userId, date) {
  return `${PREFIX}${userId}:${date}`;
}

function validRoutines(value) {
  return Array.isArray(value)
    && value.every((routine) => routine && typeof routine.id === 'string' && typeof routine.title === 'string');
}

function parse(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return validRoutines(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveCachedRoutines(userId, date, routines) {
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !validRoutines(routines)) return false;
  const storage = safeStorage();
  if (!storage) return false;
  try {
    storage.setItem(keyFor(userId, date), JSON.stringify(routines));
    return true;
  } catch {
    return false;
  }
}

export function clearCachedRoutines(userId) {
  const storage = safeStorage();
  if (!storage || !userId) return false;
  const prefix = `${PREFIX}${userId}:`;
  try {
    const doomed = [];
    for (let index = 0; index < storage.length; index += 1) {
      const storageKey = storage.key(index);
      if (storageKey && storageKey.startsWith(prefix)) doomed.push(storageKey);
    }
    doomed.forEach((storageKey) => storage.removeItem(storageKey));
    return true;
  } catch {
    return false;
  }
}

export function readCachedRoutines(userId, date) {
  const storage = safeStorage();
  if (!storage || !userId || !date) return null;
  try {
    return parse(storage.getItem(keyFor(userId, date)));
  } catch {
    return null;
  }
}

export function readLatestCachedRoutines(userId) {
  const storage = safeStorage();
  if (!storage || !userId) return null;
  const prefix = `${PREFIX}${userId}:`;
  try {
    let latestDate = '';
    for (let index = 0; index < storage.length; index += 1) {
      const storageKey = storage.key(index);
      if (!storageKey || !storageKey.startsWith(prefix)) continue;
      const date = storageKey.slice(prefix.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date > latestDate) latestDate = date;
    }
    if (!latestDate) return null;
    const routines = parse(storage.getItem(prefix + latestDate));
    return routines ? { date: latestDate, routines } : null;
  } catch {
    return null;
  }
}

// Exact cache first. If the device was offline overnight, fall back to the most
// recent snapshot, but strip yesterday's completion status so the offline day
// does not look finished when it is not.
export function loadCachedRoutinesForOffline(userId, date) {
  const exact = readCachedRoutines(userId, date);
  if (exact) return { date, routines: exact, stale: false };
  const latest = readLatestCachedRoutines(userId);
  if (!latest) return null;
  return {
    date: latest.date,
    stale: latest.date !== date,
    routines: latest.routines.map((routine) => ({ ...routine, completionStatus: null })),
  };
}
