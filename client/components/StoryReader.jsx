'use client';

import { useMemo, useState } from 'react';

function normalizeWord(word = '') {
  return String(word || '')
    .toLowerCase()
    .replace(/^[^a-z0-9\u0980-\u09ff]+|[^a-z0-9\u0980-\u09ff]+$/g, '');
}

function buildVocabularyMap(vocabulary = [], lang = 'bn') {
  const map = new Map();
  for (const entry of vocabulary || []) {
    const term = entry?.term || entry?.word || '';
    const rawMeaning = entry?.definition || entry?.meaning || '';
    const meaning = typeof rawMeaning === 'string'
      ? rawMeaning
      : rawMeaning?.[lang] || rawMeaning?.en || rawMeaning?.bn || '';
    const key = normalizeWord(term);
    if (key && meaning && !map.has(key)) map.set(key, { term, meaning });
  }
  return map;
}

// Interactive story reader: tap any word to see its meaning, plus a story-meaning box.
export function StoryReader({ lines = [], vocabulary = [], lang = 'bn', keyTakeaway = '', description = '' }) {
  const isBn = lang === 'bn';
  const [selected, setSelected] = useState(null);
  const vocabMap = useMemo(() => buildVocabularyMap(vocabulary, lang), [vocabulary, lang]);

  const copy = {
    meaningTitle: isBn ? 'গল্পের অর্থ' : 'Story meaning',
    tapHint: isBn ? 'যেকোনো শব্দে চাপ দিলে তার অর্থ দেখা যাবে' : 'Tap any word to see its meaning',
    takeaway: isBn ? 'মূল শিক্ষা' : 'Key takeaway',
    close: isBn ? 'বন্ধ করুন' : 'Close',
    noMeaning: isBn
      ? 'এই শব্দের সংরক্ষিত অর্থ নেই। নিচের শব্দভাণ্ডার দেখুন।'
      : 'No saved meaning for this word. See the vocabulary below.',
    vocabTitle: isBn ? 'শব্দভাণ্ডার' : 'Vocabulary',
  };

  const handleWordClick = (word) => {
    const key = normalizeWord(word);
    if (!key) return;
    const found = vocabMap.get(key);
    setSelected(found ? { word, ...found } : { word, term: word, meaning: copy.noMeaning, missing: true });
  };

  return (
    <div>
      {(description || keyTakeaway) ? (
        <div className="routine-tile mb-3 p-4">
          <h4 className="eyebrow">✦ {copy.meaningTitle}</h4>
          {description ? <p className="mt-2 text-sm opacity-80">{description}</p> : null}
          {keyTakeaway ? (
            <p className="mt-2 rounded-xl border border-gold/30 bg-gold/10 p-2.5 text-sm font-semibold">
              <span className="text-gold-soft">{copy.takeaway}: </span>{keyTakeaway}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-medium text-ink/80">{copy.tapHint}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        {lines.map((line, index) => (
          <p key={index} className="rounded-lg px-2 py-2 text-sm leading-relaxed even:bg-sapphire/10">
            {line.speaker ? (
              <span className="mr-2 inline-block rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold-soft">
                {line.speaker}
              </span>
            ) : null}
            {String(line.text || '').split(/(\s+)/).map((part, partIndex) => {
              if (!/\S/.test(part)) return <span key={partIndex}>{part}</span>;
              const isSelected = selected && normalizeWord(selected.word) === normalizeWord(part) && selected.index === `${index}-${partIndex}`;
              return (
                <button
                  key={partIndex}
                  type="button"
                  onClick={() => setSelected({ ...(vocabMap.get(normalizeWord(part)) || { term: part, meaning: copy.noMeaning, missing: true }), word: part, index: `${index}-${partIndex}` })}
                  className={`rounded px-0.5 underline decoration-dotted decoration-sapphire/50 underline-offset-2 transition hover:bg-sapphire/20 ${isSelected ? 'bg-gold/40' : ''}`}
                  title={isBn ? 'অর্থ দেখুন' : 'See meaning'}
                >
                  {part}
                </button>
              );
            })}
          </p>
        ))}
      </div>

      {vocabulary?.length ? (
        <div className="routine-tile mt-3 p-4">
          <h4 className="eyebrow">📚 {copy.vocabTitle}</h4>
          <dl className="mt-2 space-y-2">
            {vocabulary.map((entry, entryIndex) => {
              const term = entry?.term || entry?.word || '';
              const rawMeaning = entry?.definition || entry?.meaning || '';
              const meaning = typeof rawMeaning === 'string' ? rawMeaning : rawMeaning?.[lang] || rawMeaning?.en || rawMeaning?.bn || '';
              return (
                <div key={entryIndex} className="text-sm">
                  <dt className="font-semibold text-gold-soft">{term}</dt>
                  <dd className="opacity-80">{meaning}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}

      {selected ? (
        <div role="status" className="surface-card mt-3 flex items-start justify-between gap-3 p-4">
          <div>
            <p className="font-bold text-gold-soft">{selected.term}</p>
            <p className="mt-1 text-sm opacity-90">{selected.meaning}</p>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label={copy.close}
            className="secondary-button min-h-9 min-w-9 px-2 py-1 text-sm"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
