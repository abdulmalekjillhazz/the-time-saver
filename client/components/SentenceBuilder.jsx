'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { announceLearningActivity } from '../lib/learningFeedback.js';
import { Card } from './ui/Card.jsx';

const LEVELS = ['basic', 'intermediate', 'advanced'];

function sentenceLevel(wordCount) {
  if (wordCount <= 5) return 'basic';
  if (wordCount <= 9) return 'intermediate';
  return 'advanced';
}

export function getUnlockedLevels(levelCounts, completedLevels) {
  const unlocked = ['basic'];
  if (!levelCounts.basic || completedLevels.basic >= Math.min(3, levelCounts.basic)) {
    unlocked.push('intermediate');
  }
  if (!levelCounts.intermediate || completedLevels.intermediate >= Math.min(3, levelCounts.intermediate)) {
    unlocked.push('advanced');
  }
  return unlocked;
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
      if (englishWords.length < 3 || englishWords.length > 22 || /[\u0980-\u09ff]/.test(sentence)) continue;

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
        wordCount: englishWords.length,
        level: sentenceLevel(englishWords.length),
        structure: sentenceStructure(sentence),
      });
    }
  }

  return exercises.sort((left, right) => (
    left.wordCount - right.wordCount || left.sentence.localeCompare(right.sentence)
  ));
}

export function isSentenceCorrect(selectedIndices, exercise) {
  return selectedIndices.length === exercise.answer.length
    && selectedIndices.every((index, position) => exercise.words[index] === exercise.answer[position]);
}

export function SentenceBuilder({ lang = 'bn', stories = [] }) {
  const isBn = lang === 'bn';
  const exercises = useMemo(() => extractGrammarExercises(stories), [stories]);
  const [level, setLevel] = useState('basic');
  const [storySlug, setStorySlug] = useState('all');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState('');
  const [completedLevels, setCompletedLevels] = useState({ basic: 0, intermediate: 0, advanced: 0 });
  const [completedSentenceCount, setCompletedSentenceCount] = useState(0);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionError, setCompletionError] = useState('');
  const [milestoneNotice, setMilestoneNotice] = useState('');
  useEffect(() => {
    let active = true;
    apiRequest('/api/gamification/grammar-sentences')
      .then(({ completedSentences }) => {
        if (active) setCompletedSentenceCount(completedSentences);
      })
      .catch((error) => {
        if (active) setCompletionError(error.message);
      });
    return () => { active = false; };
  }, []);
  const availableStories = useMemo(() => {
    const uniqueStories = new Map();
    for (const exercise of exercises) uniqueStories.set(exercise.slug, exercise.sourceTitle);
    return [...uniqueStories].map(([slug, title]) => ({ slug, title }));
  }, [exercises]);
  const filteredExercises = useMemo(
    () => exercises.filter((exercise) => exercise.level === level
      && (storySlug === 'all' || exercise.slug === storySlug)),
    [exercises, level, storySlug],
  );
  const levelCounts = useMemo(
    () => Object.fromEntries(LEVELS.map((item) => [
      item,
      exercises.filter((exercise) => exercise.level === item).length,
    ])),
    [exercises],
  );
  const unlockedLevels = new Set(getUnlockedLevels(levelCounts, completedLevels));
  const exercise = filteredExercises.length
    ? filteredExercises[exerciseIndex % filteredExercises.length]
    : null;
  const correct = Boolean(exercise && isSentenceCorrect(selected, exercise));
  const levelLabels = {
    basic: isBn ? 'শুরু · ছোট বাক্য' : 'Basic · short sentences',
    intermediate: isBn ? 'মাঝারি · একটু বড় বাক্য' : 'Intermediate · longer sentences',
    advanced: isBn ? 'উন্নত · লম্বা বাক্য' : 'Advanced · long sentences',
  };

  const chooseLevel = (nextLevel) => {
    if (!unlockedLevels.has(nextLevel)) return;
    setLevel(nextLevel);
    setExerciseIndex(0);
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
  };

  const chooseStory = (nextStory) => {
    setStorySlug(nextStory);
    setExerciseIndex(0);
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
  };

  const chooseWord = (wordIndex) => {
    if (selected.includes(wordIndex) || result === 'correct') return;
    setSelected((current) => [...current, wordIndex]);
    setResult('');
  };

  const checkSentence = () => {
    if (!correct) {
      setResult('try-again');
      return;
    }
    if (!exercise || completionBusy || result === 'correct') return;
    setCompletionBusy(true);
    setCompletionError('');
    apiRequest('/api/gamification/grammar-sentences', {
      method: 'POST',
      body: { sourceSlug: exercise.slug, sentence: exercise.sentence },
      locale: lang,
    }).then((completion) => {
      setCompletedSentenceCount(completion.completedSentences);
      if (completion.recorded) {
        setCompletedLevels((current) => ({ ...current, [level]: current[level] + 1 }));
      }
      if (completion.earnedPoints > 0) {
        setMilestoneNotice(isBn
          ? 'অভিনন্দন! ১০টি বাক্য শেষ করে ৩০ পয়েন্ট পেয়েছ!'
          : 'Congratulations! You completed 10 sentences and earned 30 points!');
        announceLearningActivity(completion.earnedPoints);
      } else {
        setMilestoneNotice('');
      }
      setResult('correct');
    }).catch((error) => {
      setCompletionError(error.message || (isBn ? 'বাক্য সংরক্ষণ করা যায়নি।' : 'Could not save the completed sentence.'));
    }).finally(() => setCompletionBusy(false));
  };

  const nextExercise = () => {
    setExerciseIndex((current) => (current + 1) % filteredExercises.length);
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
  };

  const resetSentence = () => {
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
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
              {isBn ? 'সহজ থেকে ধাপে ধাপে ইংরেজি বাক্য গঠন' : 'Build English sentences step by step'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/75">
              {isBn
                ? 'ছোট ও সহজ বাক্য দিয়ে শুরু করো। কয়েকটি ঠিক হলে পরের স্তর খুলবে—সব অনুশীলন তোমার পড়া গল্প থেকে নেওয়া।'
                : 'Start with short, easy sentences. Complete a few to unlock the next level. Every exercise comes from a story you have read.'}
            </p>
          </div>
        </div>

        {exercises.length ? (
          <>
            <p className="rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 text-sm font-extrabold text-ink">
              {isBn
                ? `সম্পন্ন বাক্য: ${Math.min(completedSentenceCount, 10)} / 10 · ১০টি শেষ করলে ৩০ পয়েন্ট`
                : `Sentences completed: ${Math.min(completedSentenceCount, 10)} / 10 · Earn 30 points at 10`}
            </p>
            <div className="grid gap-2 sm:grid-cols-3" aria-label={isBn ? 'বাক্যের স্তর' : 'Sentence level'}>
              {LEVELS.map((item, levelIndex) => {
                const unlocked = unlockedLevels.has(item);
                const previousLevel = LEVELS[levelIndex - 1];
                const required = previousLevel ? Math.min(3, levelCounts[previousLevel]) : 0;
                const progress = previousLevel
                  ? `${Math.min(completedLevels[previousLevel], required)}/${required}`
                  : '';
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={level === item}
                    disabled={!unlocked}
                    onClick={() => chooseLevel(item)}
                    className={`min-h-12 rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      level === item
                        ? 'border-gold bg-gold/15 text-ink shadow-sm'
                        : 'border-sapphire/20 bg-paper/65 text-ink/75 hover:border-gold/50'
                    }`}
                  >
                    <span className="block">{levelLabels[item]}</span>
                    <span className="mt-1 block text-[10px] font-semibold opacity-65">
                      {!unlocked
                        ? (isBn ? `আগের স্তর: ${progress} সম্পন্ন` : `Finish previous level: ${progress}`)
                        : `${levelCounts[item]} ${isBn ? 'টি বাক্য' : (levelCounts[item] === 1 ? 'sentence' : 'sentences')}`}
                    </span>
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
                    {levelLabels[level]}
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
                    <span className="text-sm text-ink/50">{isBn ? 'শব্দগুলো সঠিক ক্রমে বেছে নাও…' : 'Put the words in the correct order…'}</span>
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
                  <button type="button" onClick={checkSentence} disabled={!selected.length || result === 'correct' || completionBusy} className="min-h-11 rounded-xl bg-gradient-to-r from-sapphire-deep to-sapphire px-5 py-2 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
                    {completionBusy
                      ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…')
                      : (isBn ? 'বাক্য যাচাই' : 'Check sentence')}
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
                    {milestoneNotice ? <p className="font-extrabold text-gold-soft">{milestoneNotice}</p> : null}
                    {result === 'correct' ? (
                      <>
                        <p className="font-extrabold text-ink">{exercise.sentence}</p>
                        <p className="text-xs font-bold">{isBn ? 'বাক্যের গঠন:' : 'Sentence structure:'} {isBn ? exercise.structure.bn : exercise.structure.en}</p>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {completionError ? <p role="alert" className="text-sm font-bold text-rose-700">{completionError}</p> : null}
              </div>
            ) : (
              <p role="status" className="rounded-2xl border border-gold/25 bg-gold/5 p-4 text-sm leading-relaxed text-ink/75">
                {isBn
                  ? 'এই স্তরে এই গল্পের কোনো বাক্য নেই। অন্য গল্প বেছে নাও অথবা Basic স্তরে ফিরে যাও।'
                  : 'No story sentences are available at this level for the selected story. Choose another story or return to Basic.'}
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
