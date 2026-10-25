'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSentenceDifficultyLevel } from '@smart-routine/shared';
import { apiRequest } from '../lib/apiClient.js';
import { announceLearningActivity } from '../lib/learningFeedback.js';
import { playCongratulationsSound } from '../lib/notificationSound.js';
import { speakNaturalSpeech } from '../lib/voiceBriefing.js';
import { lookupStoryWordMeaning, normalizeWord } from './StoryReader.jsx';
import { Card } from './ui/Card.jsx';

const LEVELS = ['basic', 'intermediate', 'advanced'];
const CORE_SENTENCES = [
  { level: 'basic', sentence: 'My cat hates mornings.', translation: 'আমার বিড়াল সকালবেলা একদম পছন্দ করে না।' },
  { level: 'basic', sentence: 'Where is my phone?', translation: 'আমার ফোনটা কোথায় গেল?' },
  { level: 'basic', sentence: 'I need more coffee.', translation: 'আমার আরেকটু কফি দরকার।' },
  { level: 'basic', sentence: 'Why are you laughing?', translation: 'তুমি হাসছ কেন?' },
  { level: 'basic', sentence: 'He fell asleep fast.', translation: 'সে দ্রুত ঘুমিয়ে পড়ল।' },
  { level: 'basic', sentence: 'The dog stole bread.', translation: 'কুকুরটি পাউরুটি চুরি করে নিয়ে গেল।' },
  { level: 'basic', sentence: 'Just five more minutes!', translation: 'আর মাত্র পাঁচটা মিনিট!' },
  { level: 'basic', sentence: 'We forgot the keys.', translation: 'আমরা চাবিটা ভুলে ফেলে এসেছি।' },
  { level: 'intermediate', sentence: 'I was searching for glasses on my head.', translation: 'আমি মাথায় চশমা রেখে সারা বাড়ি খুঁজছিলাম।' },
  { level: 'intermediate', sentence: 'He set five alarms and still woke late.', translation: 'সে পাঁচটা অ্যালার্ম দিয়েও দেরিতে ঘুম থেকে উঠল।' },
  { level: 'intermediate', sentence: 'I walked in and forgot why I came.', translation: 'আমি ঘরে ঢুকে ভুলেই গেলাম কেন এসেছিলাম।' },
  { level: 'intermediate', sentence: 'The waiter said enjoy, and I said you.', translation: 'ওয়েটার বলল খাবার উপভোগ করুন, আমি বললাম আপনিও!' },
  { level: 'intermediate', sentence: 'My tea got cold while waiting for it.', translation: 'চা ঠান্ডা হওয়ার অপেক্ষায় থাকতে থাকতে একেবারে বরফ হয়ে গেল।' },
  { level: 'intermediate', sentence: 'She smiled and nodded without understanding a word.', translation: 'একটা কথাও না বুঝে সে শুধু মাথা নেড়ে হাসল।' },
  { level: 'intermediate', sentence: 'I went for bananas and bought chocolate cake.', translation: 'কলা কিনতে গিয়ে চকোলেট কেক কিনে বাড়ি ফিরলাম।' },
  { level: 'intermediate', sentence: 'The cat walked straight across my warm keyboard.', translation: 'বিড়ালটি সোজা এসে আমার গরম কিবোর্ডের ওপর হেঁটে গেল।' },
  { level: 'advanced', sentence: 'I thought today was Friday until my friend laughed and said it was Tuesday.', translation: 'বন্ধু হেসে মনে করিয়ে দেওয়ার আগ পর্যন্ত আমি ভাবছিলাম আজ শুক্রবার, অথচ আজ কেবল মঙ্গলবার!' },
  { level: 'advanced', sentence: 'He searched for his mobile in panic while talking to his mother on that same phone.', translation: 'মায়ের সাথে ফোনে কথা বলতে বলতেই সে ভয়ে পাগলের মতো নিজের ফোন খুঁজছিল!' },
  { level: 'advanced', sentence: 'I tried to steal a midnight snack quietly, but the loud metal spoon crashed onto the floor.', translation: 'মধ্যরাতে চুপিচুপি খাবার নিতে গিয়ে দেখি ধাতব চামচটা সশব্দে মেঝেতে আছড়ে পড়ল!' },
  { level: 'advanced', sentence: 'The internet stopped working right at the most exciting minute of my favorite cricket match.', translation: 'প্রিয় ক্রিকেট ম্যাচের সবথেকে উত্তেজনাপূর্ণ মুহূর্তে ঠিক তখনই ইন্টারনেট সংযোগ চলে গেল!' },
  { level: 'advanced', sentence: 'She promised to study for ten minutes, but spent two hours watching funny cat videos instead.', translation: 'সে দশ মিনিট পড়ার কথা বলে দুই ঘণ্টা কাটিয়ে দিল মজার সব বিড়ালের ভিডিও দেখে।' },
  { level: 'advanced', sentence: 'He pretended to answer an urgent phone call just to avoid an awkward conversation in the lift.', translation: 'লিফটের মধ্যে অস্বস্তিকর কথাবার্তা এড়াতে সে জরুরি ফোনে কথা বলার ভান করল।' },
  { level: 'advanced', sentence: 'I carefully ironed my shirt in the morning, only to spill hot breakfast tea down the front.', translation: 'সকালে যত্ন করে শার্ট ইস্ত্রি করলাম, আর খাবার টেবিলে বসতেই গরম চা শার্টের ওপর চলকে পড়ল!' },
  { level: 'advanced', sentence: 'After opening the refrigerator five times in one hour, he realized no magical food was appearing.', translation: 'এক ঘণ্টায় পাঁচবার ফ্রিজ খোলার পর সে বুঝতে পারল জাদুকরী কোনো খাবার নিজে থেকে তৈরি হচ্ছে না।' },
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
        storyBacked: true,
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
  return CORE_SENTENCES.map(({ level, sentence, translation }) => {
    const answer = sentence.split(/\s+/);
    return {
      slug: 'everyday-sentence-practice',
      sourceTitle: 'Everyday sentence practice',
      storyBacked: false,
      sentence,
      translation,
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
  const practiceExercises = useMemo(() => {
    const storyExercises = exercises.filter(({ storyBacked }) => storyBacked);
    return storyExercises.length ? storyExercises : exercises;
  }, [exercises]);
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
  const [selectedWordMeaning, setSelectedWordMeaning] = useState(null);
  const wordMeaningRequestRef = useRef(0);
  const speechRef = useRef(null);

  useEffect(() => () => speechRef.current?.stop(), []);

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
    for (const exercise of practiceExercises) {
      if (exercise.storyBacked) uniqueStories.set(exercise.slug, exercise.sourceTitle);
    }
    return [...uniqueStories].map(([slug, title]) => ({ slug, title }));
  }, [practiceExercises]);

  const filteredExercises = useMemo(
    () => practiceExercises.filter((exercise) => exercise.level === level
      && (storySlug === 'all' || exercise.slug === storySlug)),
    [practiceExercises, level, storySlug],
  );
  const shuffledExercises = useMemo(
    () => shuffleItems(filteredExercises),
    [filteredExercises, shuffleRound],
  );

  const levelCounts = useMemo(
    () => Object.fromEntries(LEVELS.map((item) => [
      item,
      practiceExercises.filter((exercise) => exercise.level === item).length,
    ])),
    [practiceExercises],
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
    wordMeaningRequestRef.current += 1;
    setSelectedWordMeaning(null);
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
    wordMeaningRequestRef.current += 1;
    setSelectedWordMeaning(null);
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
    if (!exercise.storyBacked) {
      setResult('correct');
      return;
    }
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
    wordMeaningRequestRef.current += 1;
    setSelectedWordMeaning(null);
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
    wordMeaningRequestRef.current += 1;
    setSelectedWordMeaning(null);
    setMilestoneNotice('');
    setCompletionError('');
  };

  const resetSentence = () => {
    setSelected([]);
    setResult('');
    wordMeaningRequestRef.current += 1;
    setSelectedWordMeaning(null);
    setMilestoneNotice('');
  };

  const speakWord = (word) => {
    const clearSpeakingWord = () => setSpeakingWord('');
    const errorMessage = isBn
      ? 'শব্দের অডিও চালানো যায়নি। আবার চেষ্টা করুন।'
      : 'Could not play the word audio. Please try again.';
    try {
      speechRef.current?.stop();
      setSpeakingWord(word);
      setPronunciationError('');
      speechRef.current = speakNaturalSpeech(word, {
        lang: 'en-US',
        rate: 0.85,
        onEnd: clearSpeakingWord,
        onStop: clearSpeakingWord,
        onError: () => {
          clearSpeakingWord();
          setPronunciationError(errorMessage);
        },
      });
    } catch {
      setSpeakingWord('');
      setPronunciationError(isBn
        ? 'শব্দের অডিও চালানো যায়নি। আবার চেষ্টা করুন।'
        : 'Could not play the word audio. Please try again.');
    }
  };

  const handleWordTap = async (word, wordIndex) => {
    chooseWord(wordIndex);
    speakWord(word);
    const clean = normalizeWord(word);
    const requestId = ++wordMeaningRequestRef.current;
    setSelectedWordMeaning({ word: clean, meaning: '', loading: true });
    try {
      const result = await lookupStoryWordMeaning(clean, [], lang);
      if (requestId === wordMeaningRequestRef.current && result) {
        setSelectedWordMeaning({ ...result, word: clean, loading: false });
      }
    } catch (error) {
      if (requestId === wordMeaningRequestRef.current) {
        setSelectedWordMeaning({
          word: clean,
          meaning: isBn
            ? `শব্দের অর্থ আনা যায়নি: ${error.message}`
            : `Could not load the word meaning: ${error.message}`,
          loading: false,
        });
      }
    }
  };

  const dismissWordMeaning = () => {
    wordMeaningRequestRef.current += 1;
    setSelectedWordMeaning(null);
  };

  const milestonePct = Math.min(100, Math.round((Math.min(completedSentenceCount, 10) / 10) * 100));

  return (
    <section className="space-y-4" aria-label={isBn ? 'ইংরেজি বাক্য গঠন' : 'English sentence builder'}>
      <Card className="surface-card duo-card space-y-5 overflow-hidden rounded-3xl border-2 border-gold/30 bg-gradient-to-br from-sapphire-deep/20 via-paper to-gold/10 p-4 shadow-xl sm:p-7">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl border border-gold/35 bg-gold/15 text-3xl shadow-inner">🧩</span>
          <div>
            <span className="inline-flex rounded-full border border-sapphire/25 bg-sapphire/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sapphire">
              Grammar · Sentence structure
            </span>
            <h2 className="mt-2 text-xl font-black tracking-tight text-ink sm:text-2xl">
              {isBn ? 'সহজ থেকে ধাপে ধাপে ইংরেজি বাক্য গঠন' : 'Build English sentences step by step'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/75">
              {isBn
                ? 'শব্দগুলো সঠিক ক্রমে সাজিয়ে বাক্য তৈরি করুন। শব্দে ট্যাপ করলে উচ্চারণ ও অর্থ পাবেন।'
                : 'Arrange the words to build the sentence. Tap any word to hear it and see its meaning.'}
            </p>
          </div>
        </div>

        {exercises.length ? (
          <>
            <div className="space-y-2 rounded-2xl border border-gold/30 bg-gold/10 p-3.5">
              <p className="text-sm font-extrabold text-ink">
                {isBn
                  ? `গল্পের বাক্য: ${Math.min(completedSentenceCount, 10)} / 10 · ১০টি গল্পের বাক্যে ৩০ পয়েন্ট`
                  : `Story sentences: ${Math.min(completedSentenceCount, 10)} / 10 · Earn 30 points at 10`}
              </p>
              <div className="duo-progress-track h-2.5 w-full overflow-hidden rounded-full bg-ink/15">
                <div
                  className="duo-progress-fill h-full rounded-full bg-gradient-to-r from-sapphire-deep via-sapphire to-gold transition-[width] duration-300"
                  style={{ width: `${milestonePct}%` }}
                />
              </div>
            </div>

            <details className="rounded-2xl border border-sapphire/20 bg-paper/60 p-3">
              <summary className="cursor-pointer text-sm font-extrabold text-ink">
                {isBn ? 'স্তর ও গল্প বেছে নিন' : 'Choose level and story'}
              </summary>
              <div className="mt-3 space-y-3">
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
                    className={`duo-word-chip min-h-[46px] rounded-2xl border-2 px-3 py-2 text-left text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      level === item
                        ? 'border-gold bg-gold/20 text-ink shadow-sm'
                        : 'border-sapphire/25 bg-paper/75 text-ink/75 hover:border-gold/50'
                    }`}
                  >
                    <span className="block">{levelLabels[item]}</span>
                    <span className="mt-1 block text-[10px] font-semibold opacity-70">
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
                className="mt-1.5 block min-h-[46px] w-full rounded-2xl border-2 border-sapphire/25 bg-paper px-3.5 py-2 text-sm font-semibold text-ink"
              >
                <option value="all">{isBn ? 'সব গল্প' : 'All stories'}</option>
                {availableStories.map((story) => (
                  <option key={story.slug} value={story.slug}>{story.title}</option>
                ))}
              </select>
            </label>
              </div>
            </details>

            {exercise ? (
              <div className="duo-card space-y-4 rounded-2xl border-2 border-sapphire/25 bg-paper/85 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-ink/70">
                    {isBn ? `অনুশীলন ${exerciseIndex + 1} / ${filteredExercises.length}` : `Challenge ${exerciseIndex + 1} / ${filteredExercises.length}`}
                  </span>
                  <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold-soft">
                    {levelLabels[level]}
                  </span>
                </div>

                <p className="text-xs font-semibold text-ink/70">
                  {isBn
                    ? (exercise.storyBacked ? 'গল্প:' : 'অনুশীলন:')
                    : (exercise.storyBacked ? 'From story:' : 'Practice:')}{' '}
                  <span className="font-extrabold text-ink">{exercise.sourceTitle}</span>
                </p>

                {exercise.translation ? (
                  <div className="rounded-2xl border-2 border-gold/40 bg-gradient-to-r from-gold/15 via-paper to-sapphire/10 p-3.5 sm:p-4 text-center shadow-sm">
                    <span className="block text-[11px] font-extrabold uppercase tracking-widest text-gold-soft">
                      {isBn ? '🎯 বাক্যটির অর্থ বুঝে সাজাও:' : '🎯 Meaning to build:'}
                    </span>
                    <p className="mt-1 text-base sm:text-lg font-black leading-snug text-ink">
                      “{exercise.translation}”
                    </p>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-ink/65">
                    {isBn ? 'আপনার সাজানো বাক্য:' : 'Your built sentence:'}
                  </span>
                  {selected.length > 0 && result !== 'correct' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeWordAtPosition(selected.length - 1)}
                        className="rounded-lg border border-sapphire/35 bg-sapphire/10 px-2.5 py-1 text-xs font-bold text-ink hover:bg-sapphire/20"
                        title={isBn ? 'শেষ শব্দটি মুছুন' : 'Undo last word'}
                      >
                        ↩ {isBn ? 'আনডু' : 'Undo'}
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-500/20"
                        title={isBn ? 'সব মুছুন' : 'Clear all'}
                      >
                        ✕ {isBn ? 'রিসেট' : 'Reset'}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="duo-answer-tray flex min-h-24 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-gold/45 bg-paper/80 p-3.5" aria-live="polite">
                  {selected.length ? (
                    selected.map((wordIndex, position) => (
                      <button
                        key={`${wordIndex}-${position}`}
                        type="button"
                        onClick={() => removeWordAtPosition(position)}
                        disabled={result === 'correct'}
                        aria-label={isBn ? `${exercise.words[wordIndex]} বাদ দিতে ক্লিক করুন` : `Click to remove ${exercise.words[wordIndex]}`}
                        title={isBn ? 'বাদ দিতে ট্যাপ করুন' : 'Tap to remove'}
                        className="duo-word-chip inline-flex min-h-[44px] items-center rounded-xl border-2 border-sapphire/50 bg-sapphire/20 px-3.5 py-2 text-sm font-extrabold text-ink transition hover:border-rose-400 hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sapphire disabled:cursor-default"
                      >
                        <span>{exercise.words[wordIndex]}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-sm text-ink/55">{isBn ? 'নিচের শব্দগুলোতে ট্যাপ করে সঠিক ক্রমে বাক্য সাজাও…' : 'Tap the words below to build the sentence…'}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2" aria-label={isBn ? 'শব্দ বেছে নাও' : 'Choose word chunks'}>
                  {exercise.words.map((word, wordIndex) => {
                    const used = selected.includes(wordIndex);
                    return (
                      <button
                        key={`${exercise.slug}-${exerciseIndex}-${wordIndex}`}
                        type="button"
                        disabled={result === 'correct'}
                        onClick={() => { void handleWordTap(word, wordIndex); }}
                        aria-label={`${isBn ? 'শব্দ বেছে নিন ও উচ্চারণ শুনুন' : 'Select word and hear pronunciation'}: ${word}`}
                        aria-pressed={used}
                        className={`duo-word-chip inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-extrabold text-ink transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/35 disabled:cursor-default disabled:opacity-40 ${
                          selectedWordMeaning?.word === normalizeWord(word)
                            ? 'border-sapphire bg-sapphire/15'
                            : 'border-gold/35 bg-gold/15 hover:border-gold/75 hover:bg-gold/25'
                        }`}
                      >
                        <span>{word}</span>
                        {speakingWord === word ? <span aria-hidden="true" className="animate-pulse text-xs">♪</span> : null}
                      </button>
                    );
                  })}
                </div>
                {selectedWordMeaning ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-start justify-between gap-3 rounded-2xl border-2 border-gold/40 bg-gold/10 p-3.5 text-sm text-ink"
                  >
                    <span>
                      <strong className="block text-base font-extrabold">{selectedWordMeaning.word}</strong>
                      <span>{selectedWordMeaning.loading
                        ? (isBn ? 'অর্থ খোঁজা হচ্ছে…' : 'Looking up meaning…')
                        : selectedWordMeaning.meaning}</span>
                    </span>
                    <button
                      type="button"
                      onClick={dismissWordMeaning}
                      aria-label={isBn ? 'শব্দের অর্থ বন্ধ করুন' : 'Close word meaning'}
                      className="grid size-8 shrink-0 place-items-center rounded-lg font-bold hover:bg-gold/20"
                    >
                      ×
                    </button>
                  </div>
                ) : null}
                {pronunciationError ? <p role="alert" className="text-sm font-semibold text-rose-400">{pronunciationError}</p> : null}

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={checkSentence}
                    disabled={!selected.length || result === 'correct' || completionBusy}
                    className="primary-button inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-sapphire-deep to-sapphire px-5 py-2.5 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {completionBusy
                      ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…')
                      : (isBn ? 'বাক্য যাচাই' : 'Check sentence')}
                  </button>
                  <button
                    type="button"
                    onClick={resetSentence}
                    disabled={!selected.length}
                    className="secondary-button inline-flex min-h-[46px] items-center justify-center rounded-xl border border-sapphire/25 bg-paper/70 px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-sapphire/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBn ? 'সব মুছুন' : 'Reset all'}
                  </button>
                  {result === 'correct' ? (
                    <button
                      type="button"
                      onClick={nextExercise}
                      className="secondary-button inline-flex min-h-[46px] items-center justify-center rounded-xl border-2 border-gold/45 bg-gold/15 px-4 py-2.5 text-sm font-extrabold text-gold-soft transition hover:bg-gold/25"
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
                    className={`space-y-2 rounded-2xl p-4 text-sm font-bold ${
                      result === 'correct'
                        ? 'practice-completion-feedback border-2 border-emerald-500/40 bg-emerald-500/15 text-ink'
                        : 'border-2 border-gold/35 bg-gold/10 text-ink'
                    }`}
                  >
                    <p>
                      {result === 'correct'
                        ? (isBn ? '✓ দারুণ! গল্পের বাক্যটি ঠিকভাবে সাজিয়েছ।' : '✓ Excellent! You rebuilt the story sentence correctly.')
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
              <div role="status" aria-live="polite" className="practice-completion-feedback flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-emerald-500/35 bg-emerald-500/10 p-4 text-sm font-bold text-ink">
                <span>{isBn ? 'এই গল্প ও স্তরের সব বাক্য শেষ।' : 'You have finished every sentence in this story and level.'}</span>
                <button
                  type="button"
                  onClick={restartExercises}
                  className="primary-button min-h-[44px] rounded-xl bg-sapphire px-4 py-2 font-extrabold text-white"
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
