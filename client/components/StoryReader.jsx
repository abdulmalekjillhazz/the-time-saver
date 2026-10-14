'use client';

import { useState } from 'react';

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

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      term: clean,
      meaning: isBn ? '⚠️ অফলাইন: ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
      isOffline: true,
    };
  }

  if (sessionWordCache.has(clean)) {
    return sessionWordCache.get(clean);
  }

  const [serverRes, gtxResult, myMemoryResult, dictResult] = await Promise.allSettled([
    fetch(`/api/word-meaning?word=${encodeURIComponent(clean)}&lang=${encodeURIComponent(lang)}`, {
      signal: AbortSignal.timeout(5000),
    }).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&dt=bd&q=${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(5000) }
    ).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|bn`,
      { signal: AbortSignal.timeout(5000) }
    ).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(5000) }
    ).then((r) => (r.ok ? r.json() : null)),
  ]);

  if (serverRes.status === 'fulfilled' && serverRes.value?.ok && serverRes.value?.meaning) {
    const item = { term: clean, meaning: serverRes.value.meaning, isOffline: false };
    sessionWordCache.set(clean, item);
    return item;
  }

  let banglaMeaning = '';
  let englishDetails = '';

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

  const finalMeaning = [banglaMeaning, englishDetails].filter(Boolean).join(' — ');
  if (finalMeaning) {
    const item = { term: clean, meaning: finalMeaning, isOffline: false };
    sessionWordCache.set(clean, item);
    return item;
  }

  return {
    term: clean,
    meaning: isBn ? 'শব্দার্থ লোড হচ্ছে, আবার ট্যাপ করুন।' : 'Tap again to load meaning.',
    isOffline: false,
  };
}

export function StoryReader({ lines = [], vocabulary = [], lang = 'bn' }) {
  const isBn = lang === 'bn';
  const [selected, setSelected] = useState(null);

  const handleWordClick = async (word) => {
    const clean = normalizeWord(word);
    if (!clean) return;

    const vocabMatch = (vocabulary || []).find(
      (v) => normalizeWord(v?.term || v?.word || '') === clean
    );
    if (vocabMatch) {
      const rawMeaning = vocabMatch.definition || vocabMatch.meaning || '';
      const localDef = typeof rawMeaning === 'string'
        ? rawMeaning
        : rawMeaning?.[lang] || rawMeaning?.bn || rawMeaning?.en || '';
      if (localDef && typeof navigator !== 'undefined' && navigator.onLine) {
        setSelected({ term: clean, meaning: localDef, loading: false });
      }
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSelected({
        term: clean,
        meaning: isBn ? '⚠️ অফলাইন: ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
        isOffline: true,
      });
      return;
    }

    setSelected((prev) => prev?.term === clean && prev?.meaning ? prev : {
      term: clean,
      meaning: '...',
      loading: true,
    });
    const result = await fetchOnlineWordMeaning(clean, lang);
    if (result) setSelected(result);
  };

  return (
    <div className="w-full space-y-3">
      {selected ? (
        <div
          role="status"
          className="sticky top-2 z-30 flex items-center justify-between rounded-xl border-2 border-gold bg-paper p-3 text-sm shadow-lg"
        >
          <div className="min-w-0 flex-1 pr-2">
            <span className="mr-2 inline-block rounded bg-gold px-2 py-0.5 text-xs font-extrabold text-on-gold">
              {selected.term}
            </span>
            <span className="font-semibold text-ink">{selected.meaning}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="shrink-0 rounded-lg border border-gold/50 px-2.5 py-1 text-xs font-bold text-gold-soft"
          >
            ✕
          </button>
        </div>
      ) : null}

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
              const isSelected = selected && normalizeWord(selected.term) === clean;

              if (!clean) return <span key={partIndex}>{part}</span>;

              return (
                <button
                  key={partIndex}
                  type="button"
                  onClick={() => handleWordClick(part)}
                  className={`rounded px-1 py-0.5 transition cursor-pointer hover:bg-gold/30 ${
                    isSelected ? 'bg-gold text-on-gold font-extrabold ring-2 ring-gold' : ''
                  }`}
                >
                  {part}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
