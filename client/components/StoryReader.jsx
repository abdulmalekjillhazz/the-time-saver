'use client';

import { useRef, useState } from 'react';

const sessionWordCache = new Map();

export function normalizeWord(word = '') {
  return String(word || '')
    .toLowerCase()
    .replace(/^[^a-z0-9\u0980-\u09FF]+|[^a-z0-9\u0980-\u09FF]+$/gi, '');
}

export async function fetchOnlineWordMeaning(rawWord, lang = 'bn') {
  const isBn = lang === 'bn';
  const clean = normalizeWord(rawWord);
  if (!clean || clean.length < 2) return null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      term: clean,
      meaning: isBn ? '⚠️ অফলাইন: শব্দার্থ দেখতে ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
      isOffline: true,
    };
  }

  if (sessionWordCache.has(clean)) {
    return sessionWordCache.get(clean);
  }

  let banglaMeaning = '';
  let englishDetails = '';

  const [gtxResult, myMemoryResult, dictResult] = await Promise.allSettled([
    fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&dt=bd&q=${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(4500) }
    ).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|bn`,
      { signal: AbortSignal.timeout(4500) }
    ).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(4500) }
    ).then((r) => (r.ok ? r.json() : null)),
  ]);

  if (gtxResult.status === 'fulfilled' && Array.isArray(gtxResult.value)) {
    const data = gtxResult.value;
    const primaryBn = data?.[0]?.[0]?.[0];
    const dictSynonyms = [];
    if (Array.isArray(data?.[1])) {
      for (const posGroup of data[1]) {
        if (Array.isArray(posGroup?.[1])) {
          dictSynonyms.push(...posGroup[1].slice(0, 3));
        }
      }
    }
    const combinedBn = [
      primaryBn && primaryBn.toLowerCase() !== clean ? primaryBn : '',
      ...dictSynonyms.filter((w) => w && w !== primaryBn),
    ].filter(Boolean);
    if (combinedBn.length > 0) {
      banglaMeaning = combinedBn.slice(0, 4).join(', ');
    }
  }

  if (!banglaMeaning && myMemoryResult.status === 'fulfilled' && myMemoryResult.value) {
    const translated = myMemoryResult.value?.responseData?.translatedText;
    if (
      translated &&
      !translated.startsWith('MYMEMORY WARNING') &&
      translated.toLowerCase() !== clean.toLowerCase()
    ) {
      banglaMeaning = translated;
    }
  }

  if (dictResult.status === 'fulfilled' && Array.isArray(dictResult.value)) {
    const entry = dictResult.value[0];
    if (entry) {
      const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || '';
      const def = entry.meanings?.[0]?.definitions?.[0]?.definition || '';
      const partOfSpeech = entry.meanings?.[0]?.partOfSpeech || '';
      englishDetails = [
        phonetic ? `[${phonetic}]` : '',
        partOfSpeech ? `(${partOfSpeech})` : '',
        def,
      ].filter(Boolean).join(' ');
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      term: clean,
      meaning: isBn ? '⚠️ অফলাইন: শব্দার্থ দেখতে ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
      isOffline: true,
    };
  }

  const finalMeaning = [banglaMeaning, englishDetails].filter(Boolean).join(' — ');
  if (finalMeaning) {
    const item = { term: clean, meaning: finalMeaning, isOffline: false };
    sessionWordCache.set(clean, item);
    return item;
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
      ? '💡 যেকোনো ইংরেজি বা কঠিন শব্দে ক্লিক/ট্যাপ করলে অথবা মাউস রাখলে সাথে সাথে বাংলা ও ইংরেজি অর্থ হাইলাইট হয়ে দেখাবে'
      : '💡 Click, tap, or hover any complex English word to highlight it and see its Bengali & English meaning',
    takeaway: isBn ? 'মূল শিক্ষা' : 'Key takeaway',
    close: isBn ? '✕ বন্ধ' : '✕ Close',
    vocabTitle: isBn ? 'গুরুত্বপূর্ণ শব্দভাণ্ডার (২০% অ্যাডভান্সড শব্দ)' : 'Key Vocabulary (20% Advanced Words)',
    searching: isBn ? 'অনলাইন থেকে অর্থ খোঁজা হচ্ছে...' : 'Fetching meaning online...',
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
    <div className="w-full">
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
      ) : (
        <p className="mb-3 rounded-xl border border-sapphire/30 bg-sapphire/10 px-3 py-2 text-xs font-semibold text-sapphire">
          {copy.tapHint}
        </p>
      )}

      {selected ? (
        <div
          role="status"
          className={`sticky top-2 z-30 mb-3 flex items-center justify-between rounded-xl border-2 p-3.5 text-sm shadow-lg ${
            selected.isOffline
              ? 'border-rose-400 bg-paper text-rose-300'
              : 'border-gold bg-paper text-ink'
          }`}
        >
          <div className="min-w-0 flex-1 pr-2">
            <span className="inline-block rounded bg-gold px-2 py-0.5 text-xs font-extrabold text-on-gold mr-2">
              {selected.term}
            </span>
            <span className="font-semibold leading-relaxed">
              {selected.loading ? (
                <span className="inline-flex items-center gap-1.5 opacity-80">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gold border-t-transparent" />
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
            className="shrink-0 rounded-lg border border-gold/50 px-3 py-1.5 text-xs font-bold text-gold-soft hover:bg-gold/20"
          >
            {copy.close}
          </button>
        </div>
      ) : null}

      <div className="w-full space-y-2">
        {lines.map((line, index) => (
          <p key={index} className="rounded-xl px-3 py-2.5 text-base leading-relaxed even:bg-sapphire/10">
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
                    className={`rounded px-1 py-0.5 transition underline decoration-dotted decoration-gold/60 underline-offset-4 cursor-pointer hover:bg-gold/30 hover:text-gold-soft ${
                      isSelected ? 'bg-gold text-on-gold font-extrabold ring-2 ring-gold no-underline' : ''
                    }`}
                  >
                    {part}
                  </button>

                  {isHovered ? (
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute -top-9 left-1/2 z-40 max-w-xs -translate-x-1/2 truncate rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-xl ${
                        hovered.isOffline
                          ? 'border-rose-400 bg-black/95 text-rose-300'
                          : 'border-gold bg-black/95 text-gold-soft'
                      }`}
                    >
                      {hovered.loading ? '...' : hovered.meaning}
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
                <div
                  key={entryIndex}
                  onClick={() => handleWordClick(term)}
                  className="cursor-pointer rounded-xl border border-gold/25 bg-paper/70 p-3 text-sm transition hover:border-gold"
                >
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
