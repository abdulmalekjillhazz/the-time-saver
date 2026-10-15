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

  const handleWordClick = async (word, keyId) => {
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
        setSelected({ keyId, term: clean, meaning: localDef, loading: false });
      }
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSelected({
        keyId,
        term: clean,
        meaning: isBn ? '⚠️ অফলাইন: ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
        isOffline: true,
      });
      return;
    }

    setSelected((prev) => (prev?.keyId === keyId && prev?.meaning ? prev : {
      keyId,
      term: clean,
      meaning: '...',
      loading: true,
    }));
    const result = await fetchOnlineWordMeaning(clean, lang);
    if (result) setSelected({ ...result, keyId });
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
