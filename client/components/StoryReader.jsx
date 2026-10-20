'use client';

import { useEffect, useState } from 'react';
import {
  getOfflineCacheConsent,
  getOfflineMeanings,
  saveOfflineMeanings,
} from '../lib/offlineStoryCache.js';

const sessionWordCache = new Map();

export function normalizeWord(word = '') {
  return String(word || '')
    .trim()
    .replace(/['’]s$/i, '')
    .toLowerCase()
    .replace(/^[^a-z0-9\u0980-\u09FF]+|[^a-z0-9\u0980-\u09FF]+$/gi, '');
}

export async function fetchOnlineWordMeaning(rawWord, lang = 'bn') {
  const isBn = lang === 'bn';
  const clean = normalizeWord(rawWord);
  if (!clean || clean.length < 1) return null;

  const cacheKey = `${lang}:${clean}`;
  if (sessionWordCache.has(cacheKey)) return sessionWordCache.get(cacheKey);

  if (getOfflineCacheConsent() === true) {
    let cached = await getOfflineMeanings([clean], lang);
    if (!cached.has(clean) && lang === 'en') {
      cached = await getOfflineMeanings([clean], 'bn');
    }
    if (cached.has(clean)) {
      const item = { term: clean, meaning: cached.get(clean), isOffline: true };
      sessionWordCache.set(cacheKey, item);
      return item;
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      term: clean,
      meaning: isBn ? '⚠️ অফলাইন: এই শব্দের অর্থ সংরক্ষিত নেই।' : '⚠️ Offline: this meaning is not saved.',
      isOffline: true,
    };
  }

  const response = await fetch(
    `/api/word-meaning?word=${encodeURIComponent(clean)}&lang=${encodeURIComponent(lang)}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok) throw new Error(`শব্দার্থ আনা যায়নি (HTTP ${response.status})।`);
  const result = await response.json();
  if (!result?.ok || !result.meaning) {
    return {
      term: clean,
      meaning: isBn ? 'এই শব্দের অর্থ পাওয়া যায়নি।' : 'Meaning not found.',
      isOffline: false,
    };
  }

  const item = { term: clean, meaning: result.meaning, isOffline: false };
  sessionWordCache.set(cacheKey, item);
  if (getOfflineCacheConsent() === true) {
    await saveOfflineMeanings([{ term: clean, meaning: result.meaning }], lang);
  }
  return item;
}

export function getVocabularyMeaning(rawWord, vocabulary, lang = 'bn') {
  const clean = normalizeWord(rawWord);
  const vocabMatch = (vocabulary || []).find(
    (item) => normalizeWord(item?.term || item?.word || '') === clean,
  );
  if (!vocabMatch) return '';
  const rawMeaning = vocabMatch.definition || vocabMatch.meaning || '';
  return typeof rawMeaning === 'string'
    ? rawMeaning
    : rawMeaning?.[lang] || rawMeaning?.bn || rawMeaning?.en || '';
}

export async function lookupStoryWordMeaning(rawWord, vocabulary, lang = 'bn') {
  const clean = normalizeWord(rawWord);
  const localMeaning = getVocabularyMeaning(clean, vocabulary, lang);
  if (localMeaning) return { term: clean, meaning: localMeaning, isOffline: false };
  return fetchOnlineWordMeaning(clean, lang);
}

export function StoryReader({ lines = [], vocabulary = [], lang = 'bn' }) {
  const isBn = lang === 'bn';
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (vocabulary?.length) {
      const vocabList = vocabulary.map((v) => {
        const raw = v.definition || v.meaning || '';
        const meaning = typeof raw === 'string' ? raw : (raw?.bn || raw?.en || '');
        return { term: normalizeWord(v.term || v.word), meaning };
      }).filter((v) => v.term && v.meaning);
      saveOfflineMeanings(vocabList, lang).catch(() => {});
    }
  }, [vocabulary, lang]);

  const handleWordClick = async (word, keyId) => {
    const clean = normalizeWord(word);
    if (!clean) return;

    setSelected((prev) => (prev?.keyId === keyId && prev?.meaning ? prev : {
      keyId,
      term: clean,
      meaning: '...',
      loading: true,
    }));
    try {
      const result = await lookupStoryWordMeaning(clean, vocabulary, lang);
      if (result) setSelected({ ...result, keyId });
    } catch (error) {
      setSelected({
        keyId,
        term: clean,
        meaning: isBn ? `শব্দার্থ লোড করা যায়নি: ${error.message}` : `Meaning could not be loaded: ${error.message}`,
        isOffline: false,
      });
    }
  };

  return (
    <div className="w-full space-y-2.5">
      {lines.map((line, index) => (
        <div key={index} className="rounded-xl border border-gold/20 bg-paper/70 px-3.5 py-3 text-base leading-relaxed">
          {line.speaker ? (
            <span className="mr-2 inline-block rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-xs font-bold text-gold-soft">
              {line.speaker}
            </span>
          ) : null}
          {String(line.text || '').split(/(\s+)/).map((part, partIndex) => {
            if (!/\S/.test(part)) return <span key={partIndex}>{part}</span>;
            const clean = normalizeWord(part);
            if (!clean) return <span key={partIndex}>{part}</span>;
            const keyId = `${index}-${partIndex}`;
            const isSelected = selected && selected.keyId === keyId;

            return (
              <span key={partIndex} className="relative inline-block">
                {isSelected ? (
                  <span
                    role="status"
                    className="absolute bottom-full left-1/2 z-50 mb-2 min-w-[170px] max-w-[260px] -translate-x-1/2 rounded-xl border-2 border-gold bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-2xl"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        <strong className="block text-gold-soft">{selected.term}</strong>
                        <span className="mt-0.5 block leading-snug text-ink">{selected.meaning}</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(null);
                        }}
                        className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold text-gold-soft hover:bg-gold/20"
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </span>
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleWordClick(part, keyId)}
                  className={`cursor-pointer rounded px-1 py-0.5 transition hover:bg-gold/30 ${
                    isSelected ? 'bg-gold font-extrabold text-on-gold ring-2 ring-gold' : ''
                  }`}
                >
                  {part}
                </button>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
