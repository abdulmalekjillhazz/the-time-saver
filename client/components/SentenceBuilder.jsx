'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSentenceDifficultyLevel } from '@smart-routine/shared';
import { apiRequest } from '../lib/apiClient.js';
import { announceLearningActivity } from '../lib/learningFeedback.js';
import { playCongratulationsSound } from '../lib/notificationSound.js';
import { Card } from './ui/Card.jsx';

const LEVELS = ['basic', 'intermediate', 'advanced'];
const CORE_SENTENCES = [
  { level: 'basic', sentence: 'I wake up early.' },
  { level: 'basic', sentence: 'She drinks warm tea.' },
  { level: 'basic', sentence: 'We walk after lunch.' },
  { level: 'basic', sentence: 'The bus arrives soon.' },
  { level: 'basic', sentence: 'Please open the window now.' },
  { level: 'basic', sentence: 'My sister reads daily.' },
  { level: 'basic', sentence: 'They share their food.' },
  { level: 'basic', sentence: 'He rests after work.' },
  { level: 'intermediate', sentence: 'I review my notes before class begins.' },
  { level: 'intermediate', sentence: 'She practices English with a friend after work.' },
  { level: 'intermediate', sentence: 'We packed some fruit for the long journey.' },
  { level: 'intermediate', sentence: 'The manager explained the schedule during our morning meeting.' },
  { level: 'intermediate', sentence: 'He checks the bus time before leaving home.' },
  { level: 'intermediate', sentence: 'They take short breaks to protect their focus.' },
  { level: 'intermediate', sentence: 'My neighbor waters the plants every other morning.' },
  { level: 'intermediate', sentence: 'Please send the report before the office closes today.' },
  { level: 'advanced', sentence: 'Although the first answer seemed correct, Maya checked every detail again.' },
  { level: 'advanced', sentence: 'If the train arrives late, we will call the hotel reception.' },
  { level: 'advanced', sentence: 'Because Omar practiced each difficult sound, his presentation became easier to follow.' },
  { level: 'advanced', sentence: 'The team finished the project early because everyone shared updates regularly.' },
  { level: 'advanced', sentence: 'After the rain stopped, we walked through the market to find the library.' },
  { level: 'advanced', sentence: 'Unless you save your work often, a sudden restart can erase your changes.' },
  { level: 'advanced', sentence: 'She asked for clearer instructions before starting the unfamiliar task.' },
  { level: 'advanced', sentence: 'While my friend prepared lunch, I finished the report and answered two messages.' },
];

export function shuffleItems(items, random = Math.random) {
  const shuffled = items.map((value, index) => ({ value, index }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled.every((item, index) => item.index === index)) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled.map((item) => item.value);
}

export function shuffleSentenceWords(words, random = Math.random) {
  return shuffleItems(words, random);
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

      exercises.push({
        slug: story.slug || title,
        sourceTitle: title,
        sentence,
        words: shuffleSentenceWords(chunks),
        answer: chunks,
        wordCount: englishWords.length,
        level: getSentenceDifficultyLevel(englishWords.length),
        structure: sentenceStructure(sentence),
      });
    }
  }

  return exercises.sort((left, right) => (
    left.wordCount - right.wordCount || left.sentence.localeCompare(right.sentence)
  ));
}

export function createCoreSentenceExercises() {
  return CORE_SENTENCES.map(({ level, sentence }) => {
    const answer = sentence.split(/\s+/);
    return {
      slug: 'everyday-sentence-practice',
      sourceTitle: 'Everyday sentence practice',
      sentence,
      words: shuffleSentenceWords(answer),
      answer,
      wordCount: (sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length,
      level,
      structure: sentenceStructure(sentence),
    };
  });
}

export function isSentenceCorrect(selectedIndices, exercise) {
  return selectedIndices.length === exercise.answer.length
    && selectedIndices.every((index, position) => exercise.words[index] === exercise.answer[position]);
}

export function SentenceBuilder({ lang = 'bn', stories = [] }) {
  const isBn = lang === 'bn';
  const exercises = useMemo(() => {
    const storyExercises = extractGrammarExercises(stories);
    const storySentences = new Set(storyExercises.map(({ sentence }) => sentence.toLowerCase()));
    return [
      ...createCoreSentenceExercises().filter(({ sentence }) => !storySentences.has(sentence.toLowerCase())),
      ...storyExercises,
    ];
  }, [stories]);
  const [level, setLevel] = useState('basic');
  const [storySlug, setStorySlug] = useState('all');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [shuffleRound, setShuffleRound] = useState(0);
  const [wordOrderVersion, setWordOrderVersion] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState('');
  const [completedLevels, setCompletedLevels] = useState({ basic: 0, intermediate: 0, advanced: 0 });
  const [completedSentenceCount, setCompletedSentenceCount] = useState(0);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionError, setCompletionError] = useState('');
  const [milestoneNotice, setMilestoneNotice] = useState('');
  const [pronunciationError, setPronunciationError] = useState('');
  const [speakingWord, setSpeakingWord] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/gamification/grammar-sentences')
      .then(({ completedSentences, completedLevels: savedLevels }) => {
        if (!active) return;
        setCompletedSentenceCount(completedSentences);
        if (savedLevels) setCompletedLevels(savedLevels);
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
  const shuffledExercises = useMemo(
    () => shuffleItems(filteredExercises),
    [filteredExercises, shuffleRound],
  );

  const levelCounts = useMemo(
    () => Object.fromEntries(LEVELS.map((item) => [
      item,
      exercises.filter((exercise) => exercise.level === item).length,
    ])),
    [exercises],
  );

  const unlockedLevels = new Set(getUnlockedLevels(levelCounts, completedLevels));
  const currentExercise = shuffledExercises[exerciseIndex] || null;
  const exercise = useMemo(
    () => currentExercise
      ? { ...currentExercise, words: shuffleSentenceWords(currentExercise.answer) }
      : null,
    [currentExercise, wordOrderVersion],
  );
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
    setShuffleRound((current) => current + 1);
    setSessionFinished(false);
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
    setCompletionError('');
  };

  const chooseStory = (nextStory) => {
    setStorySlug(nextStory);
    setExerciseIndex(0);
    setShuffleRound((current) => current + 1);
    setSessionFinished(false);
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
    setCompletionError('');
  };

  const chooseWord = (wordIndex) => {
    if (selected.includes(wordIndex) || result === 'correct') return;
    setSelected((current) => [...current, wordIndex]);
    setResult('');
  };

  const removeWordAtPosition = (position) => {
    if (result === 'correct') return;
    setSelected((current) => current.filter((_, idx) => idx !== position));
    setResult('');
  };

  const checkSentence = () => {
    if (!correct) {
      setResult('try-again');
      return;
    }
    if (!exercise || completionBusy || result === 'correct') return;
    playCongratulationsSound();
    setCompletionBusy(true);
    setCompletionError('');
    apiRequest('/api/gamification/grammar-sentences', {
      method: 'POST',
      body: { sourceSlug: exercise.slug, sentence: exercise.sentence },
      locale: lang,
    }).then((completion) => {
      setCompletedSentenceCount(completion.completedSentences);
      if (completion.completedLevels) setCompletedLevels(completion.completedLevels);
      if (completion.earnedPoints > 0) {
        setMilestoneNotice(isBn
          ? 'অভিনন্দন! ১০টি বাক্য শেষ করে ৩০ পয়েন্ট পেয়েছ!'
          : 'Congratulations! You completed 10 sentences and earned 30 points!');
        announceLearningActivity(completion.earnedPoints, { soundAlreadyPlayed: true });
      } else {
        setMilestoneNotice('');
      }
      setResult('correct');
    }).catch((error) => {
      setCompletionError(error.message || (isBn ? 'বাক্য সংরক্ষণ করা যায়নি।' : 'Could not save the completed sentence.'));
    }).finally(() => setCompletionBusy(false));
  };

  const nextExercise = () => {
    if (exerciseIndex >= shuffledExercises.length - 1) {
      setSessionFinished(true);
    } else {
      setExerciseIndex((current) => current + 1);
      setWordOrderVersion((current) => current + 1);
    }
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
    setCompletionError('');
  };

  const restartExercises = () => {
    setShuffleRound((current) => current + 1);
    setWordOrderVersion((current) => current + 1);
    setExerciseIndex(0);
    setSessionFinished(false);
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
    setCompletionError('');
  };

  const resetSentence = () => {
    setSelected([]);
    setResult('');
    setMilestoneNotice('');
  };

  const speakWord = (word) => {
    const speechSynthesis = globalThis.window?.speechSynthesis;
    const Utterance = globalThis.window?.SpeechSynthesisUtterance
      || globalThis.SpeechSynthesisUtterance;
    if (!speechSynthesis || typeof Utterance !== 'function') {
      setPronunciationError(isBn
        ? 'এই ডিভাইসে উচ্চারণ শোনা যাচ্ছে না।'
        : 'Word audio is not available on this device.');
      return;
    }
    speechSynthesis.cancel();
    const utterance = new Utterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.82;
    utterance.onstart = () => {
      setSpeakingWord(word);
      setPronunciationError('');
    };
    utterance.onend = () => setSpeakingWord('');
    utterance.onerror = () => {
      setSpeakingWord('');
      setPronunciationError(isBn
        ? 'শব্দের অডিও চালানো যায়নি। আবার চেষ্টা করুন।'
        : 'Could not play the word audio. Please try again.');
    };
    try {
      speechSynthesis.speak(utterance);
    } catch {
      setSpeakingWord('');
      setPronunciationError(isBn
        ? 'শব্দের অডিও চালানো যায়নি। আবার চেষ্টা করুন।'
        : 'Could not play the word audio. Please try again.');
    }
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
                ? 'প্রতিটি স্তরে নতুন অনুশীলন আছে। আগের গল্পের বাক্যগুলো রাখা হয়েছে, আর প্রতিদিনের নতুন AI গল্প থেকেও বাক্য যোগ হয়।'
                : 'Choose from a growing set of levelled challenges. Existing story sentences stay available, and new daily AI story sentences are added as they publish.'}
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
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40 ${
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
                className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-sapphire/25 bg-paper px-3 py-2 text-sm text-ink"
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
                      <button
                        key={`${wordIndex}-${position}`}
                        type="button"
                        onClick={() => removeWordAtPosition(position)}
                        disabled={result === 'correct'}
                        aria-label={isBn ? `${exercise.words[wordIndex]} বাদ দিতে ক্লিক করুন` : `Click to remove ${exercise.words[wordIndex]}`}
                        title={isBn ? 'বাদ দিতে ট্যাপ করুন' : 'Tap to remove'}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-sapphire/40 bg-sapphire/15 px-3 py-2 text-sm font-bold text-ink transition hover:border-rose-400 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sapphire disabled:cursor-default"
                      >
                        <span>{exercise.words[wordIndex]}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-sm text-ink/50">{isBn ? 'নিচের শব্দগুলোতে ট্যাপ করে সঠিক ক্রমে বাক্য সাজাও…' : 'Tap the words below to build the sentence…'}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2" aria-label={isBn ? 'শব্দ বেছে নাও' : 'Choose word chunks'}>
                  {exercise.words.map((word, wordIndex) => {
                    const used = selected.includes(wordIndex);
                    return (
                      <div key={`${exercise.slug}-${exerciseIndex}-${wordIndex}`} className="inline-flex items-stretch gap-1">
                        <button
                          type="button"
                          disabled={used || result === 'correct'}
                          onClick={() => chooseWord(wordIndex)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-gold/70 hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/35 disabled:cursor-default disabled:opacity-35"
                        >
                          {word}
                        </button>
                        <button
                          type="button"
                          onClick={() => speakWord(word)}
                          aria-label={`${isBn ? 'শব্দের উচ্চারণ শুনুন' : 'Hear pronunciation'}: ${word}`}
                          title={isBn ? 'শব্দের উচ্চারণ শুনুন' : 'Hear word pronunciation'}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-sapphire/25 bg-sapphire/10 text-base text-sapphire transition hover:bg-sapphire/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sapphire/25"
                        >
                          <span className={speakingWord === word ? 'animate-pulse' : ''} aria-hidden="true">🔊</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {pronunciationError ? <p role="alert" className="text-sm font-semibold text-rose-700">{pronunciationError}</p> : null}

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={checkSentence}
                    disabled={!selected.length || result === 'correct' || completionBusy}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-sapphire-deep to-sapphire px-5 py-2 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {completionBusy
                      ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…')
                      : (isBn ? 'বাক্য যাচাই' : 'Check sentence')}
                  </button>
                  <button
                    type="button"
                    onClick={resetSentence}
                    disabled={!selected.length}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-sapphire/25 bg-paper/70 px-4 py-2 text-sm font-bold text-ink transition hover:bg-sapphire/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBn ? 'সব মুছুন' : 'Reset all'}
                  </button>
                  {result === 'correct' ? (
                    <button
                      type="button"
                      onClick={nextExercise}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gold/40 bg-gold/15 px-4 py-2 text-sm font-extrabold text-gold-soft transition hover:bg-gold/25"
                    >
                      {exerciseIndex === shuffledExercises.length - 1
                        ? (isBn ? 'অনুশীলন শেষ করুন' : 'Finish practice')
                        : (isBn ? 'পরের বাক্য →' : 'Next sentence →')}
                    </button>
                  ) : null}
                </div>

                {result ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`space-y-2 rounded-xl p-3.5 text-sm font-bold ${
                      result === 'correct'
                        ? 'practice-completion-feedback border border-emerald-500/30 bg-emerald-500/15 text-emerald-800'
                        : 'border border-gold/30 bg-gold/10 text-ink'
                    }`}
                  >
                    <p>
                      {result === 'correct'
                        ? (isBn ? 'দারুণ! গল্পের বাক্যটি ঠিকভাবে সাজিয়েছ।' : 'Excellent! You rebuilt the story sentence correctly.')
                        : (isBn ? 'আরেকবার চেষ্টা করো—কর্তা দিয়ে শুরু করে ক্রিয়াটি খুঁজে দেখো।' : 'Try again. Look for the subject first, then find the verb.')}
                    </p>
                    {milestoneNotice ? <p className="font-extrabold text-gold-soft">{milestoneNotice}</p> : null}
                    {result === 'correct' ? (
                      <>
                        <p className="font-extrabold text-ink">{exercise.sentence}</p>
                        <p className="text-xs font-bold text-ink/80">{isBn ? 'বাক্যের গঠন:' : 'Sentence structure:'} {isBn ? exercise.structure.bn : exercise.structure.en}</p>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {completionError ? <p role="alert" className="text-sm font-bold text-rose-300">{completionError}</p> : null}
              </div>
            ) : (
              <p role="status" className="rounded-2xl border border-gold/25 bg-gold/5 p-4 text-sm leading-relaxed text-ink/75">
                {isBn
                  ? 'এই স্তরে এই গল্পের কোনো বাক্য নেই। অন্য গল্প বেছে নাও অথবা Basic স্তরে ফিরে যাও।'
                  : 'No story sentences are available at this level for the selected story. Choose another story or return to Basic.'}
              </p>
            )}
            {sessionFinished ? (
              <div role="status" aria-live="polite" className="practice-completion-feedback flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-ink">
                <span>{isBn ? 'এই গল্প ও স্তরের সব বাক্য শেষ।' : 'You have finished every sentence in this story and level.'}</span>
                <button
                  type="button"
                  onClick={restartExercises}
                  className="min-h-[44px] rounded-xl bg-sapphire px-4 py-2 font-extrabold text-white"
                >
                  {isBn ? 'আবার অনুশীলন' : 'Practice again'}
                </button>
              </div>
            ) : null}
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
