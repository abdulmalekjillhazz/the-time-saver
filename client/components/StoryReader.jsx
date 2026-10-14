'use client';

import { useRef, useState } from 'react';

// Session memory cache to prevent spamming the internet API for identical words during active browsing
const sessionWordCache = new Map();

function normalizeWord(word = '') {
  return String(word || '')
    .toLowerCase()
    .replace(/^[^a-z0-9ঀ-৿]+|[^a-z0-9ঀ-৿]+$/g, '');
}

/**
 * Fetch word meaning directly from the internet.
 * If user is offline, strictly returns offline state so no meaning is shown.
 */
async function fetchOnlineWordMeaning(rawWord, lang = 'bn') {
  const isBn = lang === 'bn';
  const clean = normalizeWord(rawWord);
  if (!clean || clean.length < 2) return null;

  // Strict offline check: if user goes offline, they cannot see the meaning
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      term: clean,
      meaning: isBn ? '⚠️ অফলাইন: শব্দার্থ দেখতে ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
      isOffline: true,
    };
  }

  // Use session memory if already fetched while online
  if (sessionWordCache.has(clean)) {
    return sessionWordCache.get(clean);
  }

  // 1. Try MyMemory Open Translation API (en -> bn) from the internet
  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|bn`;
    const res = await fetch(myMemoryUrl, { signal: AbortSignal.timeout(4500) });
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (
        translated &&
        !translated.startsWith('MYMEMORY WARNING') &&
        translated.toLowerCase() !== clean.toLowerCase()
      ) {
        const item = { term: clean, meaning: translated, isOffline: false };
        sessionWordCache.set(clean, item);
        return item;
      }
    }
  } catch {
    // If fetch failed due to losing connection during the request
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        term: clean,
        meaning: isBn ? '⚠️ অফলাইন: শব্দার্থ দেখতে ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
        isOffline: true,
      };
    }
  }

  // 2. Fallback to Free Dictionary API (English definition & phonetics) from the internet
  try {
    const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`;
    const res = await fetch(dictUrl, { signal: AbortSignal.timeout(4500) });
    if (res.ok) {
      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : null;
      if (entry) {
        const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || '';
        const def = entry.meanings?.[0]?.definitions?.[0]?.definition || '';
        const partOfSpeech = entry.meanings?.[0]?.partOfSpeech || '';
        const display = [
          phonetic ? `[${phonetic}]` : '',
          partOfSpeech ? `(${partOfSpeech})` : '',
          def,
        ].filter(Boolean).join(' ');

        if (display) {
          const item = { term: clean, meaning: display, isOffline: false };
          sessionWordCache.set(clean, item);
          return item;
        }
      }
    }
  } catch {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        term: clean,
        meaning: isBn ? '⚠️ অফলাইন: শব্দার্থ দেখতে ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
        isOffline: true,
      };
    }
  }

  return {
    term: clean,
    meaning: isBn ? 'ইন্টারনেটে এই শব্দের অর্থ পাওয়া যায়নি।' : 'Definition not found on the internet.',
    isOffline: false,
  };
}

export function StoryReader({ lines = [], vocabulary = [], lang = 'bn', keyTakeaway = '', description = '' }) {
  const isBn = lang === 'bn';
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const hoverTimerRef = useRef(null);

  const copy = {
    meaningTitle: isBn ? 'গল্পের সারসংক্ষেপ ও শিক্ষা' : 'Story Meaning & Lessons',
    tapHint: isBn
      ? '💡 যেকোনো ইংরেজি শব্দে মাউস রাখলে বা ট্যাপ করলে সরাসরি ইন্টারনেট থেকে অর্থ দেখাবে (অফলাইনে কাজ করবে না)'
      : '💡 Hover or tap any English word to fetch its meaning online (requires internet connection)',
    takeaway: isBn ? 'মূল শিক্ষা' : 'Key takeaway',
    close: isBn ? '✕ বন্ধ' : '✕ Close',
    vocabTitle: isBn ? 'গুরুত্বপূর্ণ শব্দভাণ্ডার' : 'Key Vocabulary',
    searching: isBn ? 'অনলাইন থেকে খোঁজা হচ্ছে...' : 'Fetching online...',
  };

  const handleWordClick = async (word) => {
    const clean = normalizeWord(word);
    if (!clean || clean.length < 2) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSelected({
        term: clean,
        meaning: isBn ? '⚠️ অফলাইন: শব্দার্থ দেখতে ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
        isOffline: true,
      });
      return;
    }

    setSelected({ term: clean, meaning: copy.searching, loading: true });
    const result = await fetchOnlineWordMeaning(clean, lang);
    if (result) setSelected(result);
  };

  const handleMouseEnter = (word, key) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const clean = normalizeWord(word);
    if (!clean || clean.length < 2) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setHovered({ key, term: clean, meaning: isBn ? '⚠️ অফলাইন' : '⚠️ Offline', isOffline: true });
      return;
    }

    hoverTimerRef.current = setTimeout(async () => {
      setHovered({ key, term: clean, meaning: '...', loading: true });
      const result = await fetchOnlineWordMeaning(clean, lang);
      if (result) {
        setHovered({ key, ...result });
      }
    }, 180);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHovered(null);
  };

  return (
    <div>
      {(description || keyTakeaway) ? (
        <div className="routine-tile mb-3 p-4">
          <h4 className="eyebrow">✦ {copy.meaningTitle}</h4>
          {description ? <p className="mt-2 text-sm opacity-80 leading-relaxed">{description}</p> : null}
          {keyTakeaway ? (
            <p className="mt-2 rounded-xl border border-gold/30 bg-gold/10 p-2.5 text-sm font-semibold">
              <span className="text-gold-soft">{copy.takeaway}: </span>{keyTakeaway}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-sapphire">{copy.tapHint}</p>
        </div>
      ) : null}

      {/* Selected word popup card on click / tap */}
      {selected ? (
        <div className={`relative mb-3 flex items-center justify-between rounded-xl border p-3 text-sm shadow-md animate-in fade-in ${
          selected.isOffline
            ? 'border-rose-400/40 bg-rose-500/10 text-rose-300'
            : 'border-gold bg-gold/15 text-ink'
        }`}>
          <div>
            <span className="font-bold text-gold-soft">{selected.term}: </span>
            <span className="font-medium">
              {selected.loading ? (
                <span className="inline-flex items-center gap-1.5 opacity-80">
                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-gold border-t-transparent" />
                  {selected.meaning}
                </span>
              ) : (
                selected.meaning
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="ml-3 rounded-lg border border-gold/40 px-2.5 py-1 text-xs font-bold text-gold-soft hover:bg-gold/20"
          >
            {copy.close}
          </button>
        </div>
      ) : null}

      <div className="space-y-1.5">
        {lines.map((line, index) => (
          <p key={index} className="rounded-lg px-2.5 py-2 text-sm leading-relaxed even:bg-sapphire/10">
            {line.speaker ? (
              <span className="mr-2 inline-block rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-xs font-bold text-gold-soft">
                {line.speaker}
              </span>
            ) : null}
            {String(line.text || '').split(/(\s+)/).map((part, partIndex) => {
              if (!/\S/.test(part)) return <span key={partIndex}>{part}</span>;
              const clean = normalizeWord(part);
              const isWord = clean.length >= 2;
              const wordKey = `${index}-${partIndex}`;
              const isSelected = selected && normalizeWord(selected.term) === clean;
              const isHovered = hovered && hovered.key === wordKey;

              if (!isWord) return <span key={partIndex}>{part}</span>;

              return (
                <span key={partIndex} className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => handleWordClick(part)}
                    onMouseEnter={() => handleMouseEnter(part, wordKey)}
                    onMouseLeave={handleMouseLeave}
                    className={`rounded px-0.5 transition underline decoration-dotted decoration-gold/60 underline-offset-4 cursor-pointer hover:bg-gold/30 hover:text-gold-soft ${
                      isSelected ? 'bg-gold/40 font-bold' : ''
                    }`}
                  >
                    {part}
                  </button>

                  {/* Desktop Hover Tooltip */}
                  {isHovered ? (
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-xl ${
                        hovered.isOffline
                          ? 'border-rose-400 bg-black/95 text-rose-300'
                          : 'border-gold/70 bg-black/95 text-gold'
                      }`}
                    >
                      {hovered.loading ? (
                        <span className="opacity-70">...</span>
                      ) : (
                        hovered.meaning
                      )}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </p>
        ))}
      </div>

      {vocabulary?.length ? (
        <div className="routine-tile mt-4 p-4">
          <h4 className="eyebrow">📚 {copy.vocabTitle}</h4>
          <dl className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {vocabulary.map((entry, entryIndex) => {
              const term = entry?.term || entry?.word || '';
              const rawMeaning = entry?.definition || entry?.meaning || '';
              const meaning = typeof rawMeaning === 'string' ? rawMeaning : rawMeaning?.[lang] || rawMeaning?.en || rawMeaning?.bn || '';
              return (
                <div key={entryIndex} className="rounded-lg border border-sapphire/20 bg-paper/60 p-2.5 text-sm">
                  <dt className="font-bold text-gold-soft">{term}</dt>
                  <dd className="mt-0.5 text-xs text-ink/85">{meaning}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
