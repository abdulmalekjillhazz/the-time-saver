const DATABASE_NAME = 'smart-routine-offline-stories';
const DATABASE_VERSION = 2;
const LESSON_STORE = 'lessons';
const MEANING_STORE = 'meanings';
const AUDIO_STORE = 'audio';
const CONSENT_KEY = 'smart-routine-offline-story-cache';

let databasePromise;

function openDatabase() {
  if (typeof globalThis.indexedDB === 'undefined') {
    throw new Error('এই ব্রাউজারে অফলাইন সংরক্ষণের সুবিধা নেই।');
  }

  databasePromise ??= new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LESSON_STORE)) {
        database.createObjectStore(LESSON_STORE, { keyPath: 'slug' });
      }
      if (!database.objectStoreNames.contains(MEANING_STORE)) {
        database.createObjectStore(MEANING_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(AUDIO_STORE)) {
        database.createObjectStore(AUDIO_STORE, { keyPath: 'slug' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('অফলাইন সংরক্ষণের ডেটাবেস খোলা যায়নি।'));
    request.onblocked = () => reject(new Error('অন্য একটি ট্যাবের কারণে অফলাইন সংরক্ষণ আটকে আছে।'));
  });
  databasePromise.catch(() => {
    databasePromise = undefined;
  });

  return databasePromise;
}

async function transact(storeNames, mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    let result;
    try {
      result = action(transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('অফলাইন ডেটা সংরক্ষণ করা যায়নি।'));
    transaction.onabort = () => reject(transaction.error || new Error('অফলাইন ডেটা সংরক্ষণ বাতিল হয়েছে।'));
  });
}

export function getOfflineCacheConsent() {
  if (typeof globalThis.localStorage === 'undefined') return null;
  const value = globalThis.localStorage.getItem(CONSENT_KEY);
  if (value === 'allowed') return true;
  if (value === 'declined') return false;
  return null;
}

export function setOfflineCacheConsent(allowed) {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error('এই ব্রাউজারে অফলাইন সংরক্ষণের অনুমতি রাখা যাচ্ছে না।');
  }
  globalThis.localStorage.setItem(CONSENT_KEY, allowed ? 'allowed' : 'declined');
}

export function extractUniqueEnglishWords(content) {
  const text = Array.isArray(content)
    ? content.map((line) => typeof line === 'string' ? line : line?.text || '').join(' ')
    : typeof content === 'string'
      ? content
      : content && typeof content === 'object'
        ? Object.values(content).filter((value) => typeof value === 'string').join(' ')
        : '';
  return [...new Set(
    (text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [])
      .map((word) => word.replace(/['’]s$/i, '').toLowerCase())
      .filter(Boolean),
  )];
}

export async function getOfflineLesson(slug) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(LESSON_STORE, 'readonly')
      .objectStore(LESSON_STORE)
      .get(String(slug));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('অফলাইনে রাখা পাঠ খুঁজে পাওয়া যায়নি।'));
  });
}

export async function getOfflineStoryAudio(slug, content) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(AUDIO_STORE, 'readonly')
      .objectStore(AUDIO_STORE)
      .get(String(slug));
    request.onsuccess = () => {
      const saved = request.result;
      resolve(saved?.content === content ? saved.audio : null);
    };
    request.onerror = () => reject(request.error || new Error('অফলাইনে রাখা গল্পের অডিও পড়া যায়নি।'));
  });
}

export async function saveOfflineStoryAudio(slug, content, audio) {
  if (typeof slug !== 'string' || !slug.trim() || typeof content !== 'string' || !content.trim()) {
    throw new Error('গল্পের পরিচিতি পাওয়া যায়নি, তাই অডিও অফলাইনে রাখা যাচ্ছে না।');
  }
  if (typeof globalThis.Blob !== 'function' || !(audio instanceof globalThis.Blob) || audio.size === 0) {
    throw new Error('অডিও ফাইলটি খালি বা ব্যবহারযোগ্য নয়।');
  }
  await transact([AUDIO_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(AUDIO_STORE).put({
      slug,
      content,
      audio,
      cachedAt: Date.now(),
    });
  });
}

export async function listOfflineLessons() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(LESSON_STORE, 'readonly')
      .objectStore(LESSON_STORE)
      .getAll();
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.cachedAt - a.cachedAt));
    request.onerror = () => reject(request.error || new Error('অফলাইনে রাখা পাঠের তালিকা পড়া যায়নি।'));
  });
}

export async function getOfflineMeanings(words, lang = 'bn') {
  const wanted = new Set(words.map((word) => `${lang}:${word}`));
  if (!wanted.size) return new Map();
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(MEANING_STORE, 'readonly')
      .objectStore(MEANING_STORE)
      .getAll();
    request.onsuccess = () => {
      const matches = (request.result || []).filter((item) => wanted.has(item.key));
      resolve(new Map(matches.map((item) => [item.term, item.meaning])));
    };
    request.onerror = () => reject(request.error || new Error('অফলাইনে রাখা শব্দার্থ পড়া যায়নি।'));
  });
}

export async function saveOfflineMeanings(meanings, lang = 'bn') {
  if (!meanings.length) return;
  await transact([MEANING_STORE], 'readwrite', (transaction) => {
    const store = transaction.objectStore(MEANING_STORE);
    for (const item of meanings) {
      if (!item?.term || !item?.meaning) continue;
      store.put({
        key: `${lang}:${item.term}`,
        term: item.term,
        meaning: item.meaning,
        cachedAt: Date.now(),
      });
    }
  });
}

export async function cacheOfflineLesson(lesson, request) {
  if (getOfflineCacheConsent() !== true) return { lessonSaved: false, meaningsSaved: 0 };
  if (!lesson?.slug) throw new Error('এই পাঠটির পরিচিতি পাওয়া যায়নি, তাই অফলাইনে রাখা যাচ্ছে না।');

  await transact([LESSON_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(LESSON_STORE).put({ ...lesson, cachedAt: Date.now() });
  });
  if (getOfflineCacheConsent() !== true) return { lessonSaved: false, meaningsSaved: 0 };

  const vocabularyMeanings = (lesson.vocabulary || []).flatMap((item) => {
    const term = String(item?.term || item?.word || '')
      .trim()
      .toLowerCase()
      .replace(/['’]s$/i, '')
      .replace(/^[^a-z0-9\u0980-\u09FF]+|[^a-z0-9\u0980-\u09FF]+$/gi, '');
    const raw = item?.definition || item?.meaning || '';
    const meaning = typeof raw === 'string' ? raw : raw?.bn || raw?.en || '';
    return term && meaning ? [{ term, meaning }] : [];
  });
  await saveOfflineMeanings(vocabularyMeanings);
  if (getOfflineCacheConsent() !== true) return { lessonSaved: false, meaningsSaved: 0 };

  const words = extractUniqueEnglishWords(lesson.body);
  const cached = await getOfflineMeanings(words);
  const missing = words.filter((word) => !cached.has(word));
  let meaningsSaved = vocabularyMeanings.length;
  let meaningsMissing = 0;

  for (let index = 0; index < missing.length; index += 200) {
    const batch = missing.slice(index, index + 200);
    const result = await request('/api/word-meanings', {
      method: 'POST',
      body: { words: batch, lang: 'bn' },
    });
    if (!Array.isArray(result.meanings)) {
      throw new Error('শব্দার্থের উত্তরটি বোঝা যায়নি; আবার চেষ্টা করুন।');
    }
    if (getOfflineCacheConsent() !== true) return { lessonSaved: false, meaningsSaved: 0 };
    await saveOfflineMeanings(result.meanings);
    meaningsSaved += result.meanings.length;
    meaningsMissing += Array.isArray(result.unavailable) ? result.unavailable.length : 0;
  }

  return { lessonSaved: true, meaningsSaved, meaningsMissing };
}

export async function clearOfflineStoryCache() {
  await transact([LESSON_STORE, MEANING_STORE, AUDIO_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(LESSON_STORE).clear();
    transaction.objectStore(MEANING_STORE).clear();
    transaction.objectStore(AUDIO_STORE).clear();
  });
}
