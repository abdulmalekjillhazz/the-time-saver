'use client';

import { useMemo, useState } from 'react';
import { Card } from './ui/Card.jsx';

const CATEGORIES = ['everyday', 'explaining', 'reading'];
const EXPLANATION_WORDS = /\b(because|so|if|when|but|although|therefore|while|which)\b/i;
const ACADEMIC_WORDS = /\b(study|studies|research|brain|health|focus|attention|habit|science|scientist|energy|memory|learning)\b/i;

function sentenceCategory(sentence, wordCount, story) {
  if (/[?]$/.test(sentence.trim())) return 'everyday';
  if (EXPLANATION_WORDS.test(sentence)) return 'explaining';
  if (story.category === 'science' || story.storyType === 'science' || wordCount >= 12 || ACADEMIC_WORDS.test(sentence)) {
    return 'reading';
  }
  return 'everyday';
}

function sentenceStructure(sentence) {
  if (/^(what|why|how|where|when|who|which)\b/i.test(sentence)) {
    return {
      en: 'Question word + helping verb + subject + main verb',
      bn: 'প্রশ্নবোধক শব্দ + সাহায্যকারী ক্রিয়া + কর্তা + মূল ক্রিয়া',
    };
  }
  if (/\b(because|so|if|when|but|although|therefore|while)\b/i.test(sentence)) {
    return {
      en: 'Subject + verb + main idea + connector + reason or condition',
      bn: 'কর্তা + ক্রিয়া + মূল বক্তব্য + সংযোগকারী শব্দ + কারণ বা শর্ত',
    };
  }
  if (/\b(am|is|are|was|were)\s+\w+ing\b/i.test(sentence)) {
    return {
      en: 'Subject + be verb + verb-ing + details',
      bn: 'কর্তা + be verb + verb-ing + অতিরিক্ত তথ্য',
    };
  }
  return {
    en: 'Subject + verb + object or details',
    bn: 'কর্তা + ক্রিয়া + কর্ম বা অতিরিক্ত তথ্য',
  };
}

export function extractGrammarExercises(stories = []) {
  const exercises = [];
  const seen = new Set();

  for (const story of stories) {
    const body = typeof story.body === 'string' ? story.body : '';
    const title = typeof story.title === 'string' && story.title.trim()
      ? story.title.trim()
      : (story.slug || 'Story');
    const cleanBody = body
      .replace(/^\s*\[[^\]]+\]\s*:?\s*/gm, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ');
    const sentences = cleanBody.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      const englishWords = sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
      if (englishWords.length < 4 || englishWords.length > 22 || /[\u0980-\u09ff]/.test(sentence)) continue;

      const identity = `${story.slug || title}:${sentence.toLowerCase()}`;
      if (seen.has(identity)) continue;
      seen.add(identity);

      const chunks = sentence.split(/\s+/);
      let shuffledWords = [...chunks].reverse();
      if (shuffledWords.every((word, index) => word === chunks[index])) {
        shuffledWords = [...chunks.slice(1), chunks[0]];
      }

      exercises.push({
        slug: story.slug || title,
        sourceTitle: title,
        sentence,
        words: shuffledWords,
        answer: chunks,
        category: sentenceCategory(sentence, englishWords.length, story),
        structure: sentenceStructure(sentence),
      });
    }
  }

  return exercises;
}

export function isSentenceCorrect(selectedIndices, exercise) {
  return selectedIndices.length === exercise.answer.length
    && selectedIndices.every((index, position) => exercise.words[index] === exercise.answer[position]);
}

export function SentenceBuilder({ lang = 'bn', stories = [] }) {
  const isBn = lang === 'bn';
  const exercises = useMemo(() => extractGrammarExercises(stories), [stories]);
  const [category, setCategory] = useState('everyday');
  const [storySlug, setStorySlug] = useState('all');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState('');
  const availableStories = useMemo(() => {
    const uniqueStories = new Map();
    for (const exercise of exercises) uniqueStories.set(exercise.slug, exercise.sourceTitle);
    return [...uniqueStories].map(([slug, title]) => ({ slug, title }));
  }, [exercises]);
  const filteredExercises = useMemo(
    () => exercises.filter((exercise) => exercise.category === category
      && (storySlug === 'all' || exercise.slug === storySlug)),
    [category, exercises, storySlug],
  );
  const exercise = filteredExercises.length
    ? filteredExercises[exerciseIndex % filteredExercises.length]
    : null;
  const correct = Boolean(exercise && isSentenceCorrect(selected, exercise));
  const categoryLabels = {
    everyday: isBn ? 'দৈনন্দিন কথা' : 'Everyday speaking',
    explaining: isBn ? 'ব্যাখ্যা করা' : 'Explaining ideas',
    reading: isBn ? 'থিসিসের মতো লম্বা লেখা' : 'Academic / thesis-style reading',
  };

  const chooseCategory = (nextCategory) => {
    setCategory(nextCategory);
    setExerciseIndex(0);
    setSelected([]);
    setResult('');
  };

  const chooseStory = (nextStory) => {
    setStorySlug(nextStory);
    setExerciseIndex(0);
    setSelected([]);
    setResult('');
  };

  const chooseWord = (wordIndex) => {
    if (selected.includes(wordIndex) || result === 'correct') return;
    setSelected((current) => [...current, wordIndex]);
    setResult('');
  };

  const checkSentence = () => {
    setResult(correct ? 'correct' : 'try-again');
  };

  const nextExercise = () => {
    setExerciseIndex((current) => (current + 1) % filteredExercises.length);
    setSelected([]);
    setResult('');
  };

  const resetSentence = () => {
    setSelected([]);
    setResult('');
  };

  return (
    <section className="space-y-4" aria-label={isBn ? 'ইংরেজি বাক্য গঠন' : 'English sentence builder'}>
      <Card className="surface-card space-y-5 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-sapphire-deep/20 via-paper to-gold/10 p-5 shadow-xl sm:p-7">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-3xl shadow-inner">🧩</span>
          <div>
            <span className="inline-flex rounded-full border border-sapphire/25 bg-sapphire/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sapphire">
              Grammar · Sentence structure
            </span>
            <h2 className="mt-2 text-xl font-black tracking-tight text-ink sm:text-2xl">
              {isBn ? 'গল্প থেকে ইংরেজি বাক্য গঠন শেখো' : 'Learn sentence structure from stories'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/75">
              {isBn
                ? 'আগে পড়া ইংরেজি গল্পের বাস্তব বাক্য সাজাও—দৈনন্দিন কথা, কিছু ব্যাখ্যা করা, বা থিসিসের মতো লম্বা লেখা পড়ার অনুশীলন করো।'
                : 'Rebuild real sentences from your English stories. Practise daily conversation, explaining ideas, and reading longer academic text.'}
            </p>
          </div>
        </div>

        {exercises.length ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3" aria-label={isBn ? 'অনুশীলনের ধরন' : 'Practice category'}>
              {CATEGORIES.map((item) => {
                const count = exercises.filter((exerciseItem) => exerciseItem.category === item).length;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    disabled={!count}
                    onClick={() => chooseCategory(item)}
                    className={`min-h-12 rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      category === item
                        ? 'border-gold bg-gold/15 text-ink shadow-sm'
                        : 'border-sapphire/20 bg-paper/65 text-ink/75 hover:border-gold/50'
                    }`}
                  >
                    <span className="block">{categoryLabels[item]}</span>
                    <span className="mt-1 block text-[10px] font-semibold opacity-65">{count} {isBn ? 'টি বাক্য' : (count === 1 ? 'sentence' : 'sentences')}</span>
                  </button>
                );
              })}
            </div>

            <label className="block text-sm font-bold text-ink">
              {isBn ? 'গল্প বেছে নাও' : 'Choose a story'}
              <select
                value={storySlug}
                onChange={(event) => chooseStory(event.target.value)}
                className="mt-1.5 block min-h-11 w-full rounded-xl border border-sapphire/25 bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="all">{isBn ? 'সব গল্প' : 'All stories'}</option>
                {availableStories.map((story) => (
                  <option key={story.slug} value={story.slug}>{story.title}</option>
                ))}
              </select>
            </label>

            {exercise ? (
              <div className="space-y-4 rounded-2xl border border-sapphire/20 bg-paper/70 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-ink/60">
                    {isBn ? `অনুশীলন ${exerciseIndex + 1} / ${filteredExercises.length}` : `Challenge ${exerciseIndex + 1} / ${filteredExercises.length}`}
                  </span>
                  <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold-soft">
                    {categoryLabels[category]}
                  </span>
                </div>

                <p className="text-xs font-semibold text-ink/65">
                  {isBn ? 'গল্প:' : 'From story:'} <span className="font-extrabold text-ink">{exercise.sourceTitle}</span>
                </p>

                <div className="flex min-h-20 flex-wrap items-center gap-2 rounded-xl border border-dashed border-gold/40 bg-paper/70 p-3" aria-live="polite">
                  {selected.length ? (
                    selected.map((wordIndex, position) => (
                      <span key={`${wordIndex}-${position}`} className="rounded-lg border border-sapphire/25 bg-sapphire/10 px-3 py-2 text-sm font-bold text-ink">
                        {exercise.words[wordIndex]}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-ink/50">{isBn ? 'শব্দের অংশগুলো সঠিক ক্রমে বেছে নাও…' : 'Choose the word chunks in the correct order…'}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2" aria-label={isBn ? 'শব্দ বেছে নাও' : 'Choose word chunks'}>
                  {exercise.words.map((word, wordIndex) => {
                    const used = selected.includes(wordIndex);
                    return (
                      <button
                        key={`${exercise.slug}-${exerciseIndex}-${wordIndex}`}
                        type="button"
                        disabled={used || result === 'correct'}
                        onClick={() => chooseWord(wordIndex)}
                        className="min-h-10 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-gold/70 hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/35 disabled:cursor-default disabled:opacity-35"
                      >
                        {word}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={checkSentence} disabled={!selected.length || result === 'correct'} className="min-h-11 rounded-xl bg-gradient-to-r from-sapphire-deep to-sapphire px-5 py-2 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
                    {isBn ? 'বাক্য যাচাই' : 'Check sentence'}
                  </button>
                  <button type="button" onClick={resetSentence} disabled={!selected.length} className="min-h-11 rounded-xl border border-sapphire/25 bg-paper/70 px-4 py-2 text-sm font-bold text-ink transition hover:bg-sapphire/10 disabled:cursor-not-allowed disabled:opacity-50">
                    {isBn ? 'আবার সাজাও' : 'Start over'}
                  </button>
                  {result === 'correct' ? (
                    <button type="button" onClick={nextExercise} className="min-h-11 rounded-xl border border-gold/40 bg-gold/15 px-4 py-2 text-sm font-extrabold text-gold-soft transition hover:bg-gold/25">
                      {isBn ? 'পরের বাক্য →' : 'Next sentence →'}
                    </button>
                  ) : null}
                </div>

                {result ? (
                  <div role="status" aria-live="polite" className={`space-y-2 rounded-xl px-3 py-3 text-sm font-bold ${result === 'correct' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-gold/10 text-ink'}`}>
                    <p>
                      {result === 'correct'
                        ? (isBn ? 'দারুণ! গল্পের বাক্যটি ঠিকভাবে সাজিয়েছ।' : 'Excellent! You rebuilt the story sentence correctly.')
                        : (isBn ? 'আরেকবার চেষ্টা করো—কর্তা দিয়ে শুরু করে ক্রিয়াটি খুঁজে দেখো।' : 'Try again. Look for the subject first, then find the verb.')}
                    </p>
                    {result === 'correct' ? (
                      <>
                        <p className="font-extrabold text-ink">{exercise.sentence}</p>
                        <p className="text-xs font-bold">{isBn ? 'বাক্যের গঠন:' : 'Sentence structure:'} {isBn ? exercise.structure.bn : exercise.structure.en}</p>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p role="status" className="rounded-2xl border border-gold/25 bg-gold/5 p-4 text-sm leading-relaxed text-ink/75">
                {isBn
                  ? 'এই ধরনের যথেষ্ট বাক্য গল্পে নেই। অন্য অনুশীলনের ধরন বা সব গল্প বেছে দেখো।'
                  : 'There are no story sentences in this practice category. Try another category or select all stories.'}
              </p>
            )}
          </>
        ) : (
          <p role="status" className="rounded-2xl border border-gold/25 bg-gold/5 p-4 text-sm leading-relaxed text-ink/75">
            {isBn
              ? 'Grammar practice-এর জন্য এখনো কোনো ইংরেজি গল্প পাওয়া যায়নি। আগে একটি গল্প লোড করে আবার দেখো।'
              : 'No English story sentences are available for grammar practice yet. Load a story and check again.'}
          </p>
        )}
      </Card>
    </section>
  );
}
