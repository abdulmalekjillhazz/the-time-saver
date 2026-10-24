'use client';

import { useEffect, useRef, useState } from 'react';
import { speakWithGoogleTts } from '../lib/voiceBriefing.js';
import { Card } from './ui/Card.jsx';
import { SentenceBuilder } from './SentenceBuilder.jsx';

export const GRAMMAR_LEVELS = [
  {
    id: 'basic',
    title: { en: 'Basic', bn: 'শুরু' },
    lessons: [
      {
        id: 'word-order',
        title: { en: 'Build a clear sentence', bn: 'সহজ বাক্য তৈরি' },
        rule: {
          en: 'In a basic active sentence, put the subject first, then the verb and its object. Add time or place details after the main idea.',
          bn: 'সহজ active বাক্যে আগে কর্তা, তারপর ক্রিয়া ও কর্ম বসে। মূল বক্তব্যের পরে সময় বা স্থানের তথ্য যোগ করা যায়।',
        },
        example: 'Mina reads a book every evening.',
        prompt: {
          en: 'Which sentence uses Mina as the subject, reads as the verb, and a book as the object?',
          bn: 'কোন বাক্যে Mina কর্তা, reads ক্রিয়া, আর a book কর্ম?',
        },
        choices: [
          'Mina reads a book every evening.',
          'A book is read by Mina every evening.',
          'Every evening, a book is read by Mina.',
        ],
        answer: 0,
        feedback: { en: 'Find the person first, then what they do.', bn: 'আগে কে কাজটি করছে, তারপর সে কী করছে খুঁজে নাও।' },
      },
      {
        id: 'be-verbs',
        title: { en: 'Use am, is, and are', bn: 'Am, is, are ব্যবহার' },
        rule: {
          en: 'Use am with I, is with he, she, it, or one person or thing, and are with you, we, they, or more than one person or thing.',
          bn: 'I-এর সঙ্গে am, he/she/it বা একজন/একটি জিনিসের সঙ্গে is, আর you/we/they বা একাধিক ব্যক্তির/জিনিসের সঙ্গে are বসে।',
        },
        example: 'I am ready for class.',
        prompt: {
          en: 'Which new sentence uses are with a plural subject?',
          bn: 'নতুন কোন বাক্যে plural subject-এর সঙ্গে are ব্যবহার করা হয়েছে?',
        },
        choices: [
          'She is ready for class.',
          'The students are ready for class.',
          'He is ready for class.',
        ],
        answer: 1,
        feedback: {
          en: "The subject 'students' is plural, so use are.",
          bn: "'Students' subject plural, তাই এর সঙ্গে are বসে।",
        },
      },
      {
        id: 'do-questions',
        title: { en: 'Ask questions with do and does', bn: 'Do ও does দিয়ে প্রশ্ন' },
        rule: {
          en: 'Use do with I, you, we, and they. Use does with he, she, it, or one person; keep the main verb in its base form.',
          bn: 'I, you, we, they-এর সঙ্গে do এবং he, she, it বা একজনের সঙ্গে does ব্যবহার করো; main verb-এর মূল রূপ রাখো।',
        },
        example: 'Does Maya walk to class every day?',
        prompt: { en: 'Which question uses does and the correct main verb?', bn: 'কোন প্রশ্নে does ও main verb সঠিকভাবে বসেছে?' },
        choices: [
          'Does Maya walks to class every day?',
          'Does Maya walk to class every day?',
          'Do Maya walk to class every day?',
        ],
        answer: 1,
        feedback: { en: 'After does, use the base verb walk.', bn: 'Does-এর পরে মূল verb walk বসে।' },
      },
      {
        id: 'there-is-are',
        title: { en: 'Describe what is there', bn: 'কিছু আছে বোঝাতে there is/are' },
        rule: {
          en: 'Use there is before one person or thing and there are before more than one.',
          bn: 'একজন বা একটি জিনিসের আগে there is এবং একাধিকের আগে there are ব্যবহার করো।',
        },
        example: 'There are two chairs near the window.',
        prompt: { en: 'Which sentence correctly describes two chairs?', bn: 'দুটি চেয়ার সঠিকভাবে কোন বাক্যে বলা হয়েছে?' },
        choices: [
          'There is two chairs near the window.',
          'There are two chairs near the window.',
          'There are a chair near the window.',
        ],
        answer: 1,
        feedback: { en: 'Two chairs is plural, so use there are.', bn: 'Two chairs একাধিক, তাই there are ব্যবহার করো।' },
      },
    ],
  },
  {
    id: 'intermediate',
    title: { en: 'Intermediate', bn: 'মাঝারি' },
    lessons: [
      {
        id: 'present-simple',
        title: { en: 'Talk about habits', bn: 'অভ্যাস নিয়ে বলা' },
        rule: {
          en: 'Use the present simple for routines and facts. Add s or es to the verb with he, she, or it.',
          bn: 'নিয়মিত কাজ ও সত্য বোঝাতে present simple ব্যবহার করো। He/she/it-এর সঙ্গে verb-এ s বা es যোগ হয়।',
        },
        example: 'Rafi walks to school every day.',
        prompt: { en: 'Which sentence describes a regular habit in the present?', bn: 'কোন বাক্যটি বর্তমানের নিয়মিত অভ্যাস বোঝায়?' },
        choices: [
          'She walks to school every day.',
          'She walked to school yesterday.',
          'She is walking to school right now.',
        ],
        answer: 0,
        feedback: { en: 'With she, add s to the present-simple verb.', bn: 'She-এর সঙ্গে present-simple verb-এ s যোগ হয়।' },
      },
      {
        id: 'past-simple',
        title: { en: 'Talk about yesterday', bn: 'গতকালের কথা বলা' },
        rule: {
          en: 'Use the past simple for a finished action. Many verbs add ed, while some common verbs change form.',
          bn: 'শেষ হয়ে যাওয়া কাজ বোঝাতে past simple ব্যবহার করো। অনেক verb-এর শেষে ed যোগ হয়, কিছু প্রচলিত verb-এর রূপ বদলে যায়।',
        },
        example: 'We visited our friend yesterday.',
        prompt: { en: 'Which sentence describes a finished visit yesterday?', bn: 'গতকাল শেষ হওয়া বেড়ানোর কথা কোন বাক্যে বলা হয়েছে?' },
        choices: [
          'We visit our friend every week.',
          'We visited our friend yesterday.',
          'We will visit our friend tomorrow.',
        ],
        answer: 1,
        feedback: { en: 'Visited shows that the action is finished.', bn: 'Visited বোঝায় কাজটি শেষ হয়েছে।' },
      },
      {
        id: 'going-to-plans',
        title: { en: 'Talk about a plan', bn: 'পরিকল্পনা নিয়ে বলা' },
        rule: {
          en: 'Use am, is, or are going to plus a base verb for a plan or intention.',
          bn: 'পরিকল্পনা বা ইচ্ছা বোঝাতে am/is/are going to-এর পরে verb-এর মূল রূপ বসাও।',
        },
        example: 'We are going to visit the museum tomorrow.',
        prompt: { en: 'Which sentence clearly describes a plan for tomorrow?', bn: 'আগামীকালের পরিকল্পনা কোন বাক্যে সঠিকভাবে বলা হয়েছে?' },
        choices: [
          'We are going to visit the museum tomorrow.',
          'We is going to visited the museum tomorrow.',
          'We going to visit the museum yesterday.',
        ],
        answer: 0,
        feedback: { en: 'Use are going to with we, then the base verb visit.', bn: 'We-এর সঙ্গে are going to, এরপর মূল verb visit বসে।' },
      },
      {
        id: 'some-any',
        title: { en: 'Use some and any', bn: 'Some ও any ব্যবহার' },
        rule: {
          en: 'Use some in many positive statements and polite offers or requests. Use any in most questions and negative statements.',
          bn: 'অনেক ইতিবাচক বাক্য এবং ভদ্র প্রস্তাব বা অনুরোধে some বসে। অধিকাংশ প্রশ্ন ও নেতিবাচক বাক্যে any বসে।',
        },
        example: 'Could I have some water, please?',
        prompt: { en: 'Which sentence makes a polite request for water?', bn: 'পানি চেয়ে ভদ্র অনুরোধ কোন বাক্যে আছে?' },
        choices: [
          'Could I have any water, please?',
          'Could I have some water, please?',
          'Could I has some water, please?',
        ],
        answer: 1,
        feedback: { en: 'Some is natural in this polite request.', bn: 'এই ভদ্র অনুরোধে some স্বাভাবিকভাবে বসে।' },
      },
    ],
  },
  {
    id: 'advanced',
    title: { en: 'Advanced', bn: 'উন্নত' },
    lessons: [
      {
        id: 'present-continuous',
        title: { en: 'Describe what is happening', bn: 'এখন কী হচ্ছে বলা' },
        rule: {
          en: 'Use am, is, or are plus a verb ending in ing for an action happening now.',
          bn: 'এখন চলতে থাকা কাজ বোঝাতে am/is/are-এর সঙ্গে ing-যুক্ত verb ব্যবহার করো।',
        },
        example: 'The children are playing in the garden.',
        prompt: { en: 'Which sentence describes an action happening right now?', bn: 'কোন বাক্যটি এই মুহূর্তে চলতে থাকা কাজ বোঝায়?' },
        choices: [
          'The children play in the garden every day.',
          'The children are playing in the garden now.',
          'The children played in the garden yesterday.',
        ],
        answer: 1,
        feedback: { en: 'Are playing describes an action happening now.', bn: 'Are playing এখন চলতে থাকা কাজ বোঝায়।' },
      },
      {
        id: 'joining-ideas',
        title: { en: 'Connect ideas naturally', bn: 'স্বাভাবিকভাবে ভাব জোড়া' },
        rule: {
          en: 'Use because to give a reason, but to show contrast, and so to show a result.',
          bn: 'কারণ বোঝাতে because, বিপরীত ভাব বোঝাতে but, আর ফল বোঝাতে so ব্যবহার করো।',
        },
        example: 'I took a break because I felt tired.',
        prompt: { en: 'Which sentence clearly gives tiredness as the reason for taking a break?', bn: 'কোন বাক্যে ক্লান্তিকে বিরতি নেওয়ার কারণ বলা হয়েছে?' },
        choices: [
          'I took a break because I felt tired.',
          'I took a break, but I felt tired.',
          'I took a break, so I felt tired.',
        ],
        answer: 0,
        feedback: { en: 'Because introduces the reason: feeling tired.', bn: 'Because কারণটি জানায়: ক্লান্ত লাগা।' },
      },
      {
        id: 'first-conditional',
        title: { en: 'Describe a real possibility', bn: 'বাস্তব সম্ভাবনা বোঝানো' },
        rule: {
          en: 'For a likely future result, use present simple after if and will plus the base verb in the result.',
          bn: 'ভবিষ্যতের সম্ভাব্য ফল বোঝাতে if-এর পরে present simple এবং ফলের অংশে will-এর সঙ্গে মূল verb ব্যবহার করো।',
        },
        example: 'If we leave now, we will catch the earlier bus.',
        prompt: { en: 'Which sentence correctly describes a possible result?', bn: 'সম্ভাব্য ফল সঠিকভাবে কোন বাক্যে বলা হয়েছে?' },
        choices: [
          'If we will leave now, we catch the earlier bus.',
          'If we leave now, we will catch the earlier bus.',
          'If we left now, we will caught the earlier bus.',
        ],
        answer: 1,
        feedback: { en: 'Use present simple after if, then will plus catch.', bn: 'If-এর পরে present simple এবং will-এর পরে catch বসে।' },
      },
      {
        id: 'present-perfect-experience',
        title: { en: 'Talk about life experience', bn: 'অভিজ্ঞতা নিয়ে বলা' },
        rule: {
          en: 'Use have or has plus a past participle for experience when the exact finished time is not the focus.',
          bn: 'নির্দিষ্ট শেষ হওয়া সময় মুখ্য না হলে অভিজ্ঞতা বোঝাতে have/has-এর সঙ্গে past participle বসে।',
        },
        example: 'I have visited the new science museum.',
        prompt: { en: 'Which sentence correctly describes an experience?', bn: 'অভিজ্ঞতা সঠিকভাবে কোন বাক্যে বলা হয়েছে?' },
        choices: [
          'I have visit the new science museum.',
          'I have visited the new science museum.',
          'I has visited the new science museum.',
        ],
        answer: 1,
        feedback: { en: 'Use have with I and the past participle visited.', bn: 'I-এর সঙ্গে have এবং past participle visited বসে।' },
      },
    ],
  },
];

export function getGrammarLevelAvailability(completedCounts) {
  return GRAMMAR_LEVELS.map((level, index) => ({
    ...level,
    unlocked: index === 0 || completedCounts[GRAMMAR_LEVELS[index - 1].id] >= GRAMMAR_LEVELS[index - 1].lessons.length,
  }));
}

export function GrammarLessons({ lang = 'bn', stories = [] }) {
  const isBn = lang === 'bn';
  const [levelId, setLevelId] = useState('basic');
  const [lessonId, setLessonId] = useState(GRAMMAR_LEVELS[0].lessons[0].id);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [voiceStatus, setVoiceStatus] = useState('');
  const speechRef = useRef(null);
  const completedCounts = Object.fromEntries(GRAMMAR_LEVELS.map((level) => [
    level.id,
    completedLessons.filter((id) => level.lessons.some((lesson) => lesson.id === id)).length,
  ]));
  const levels = getGrammarLevelAvailability(completedCounts);
  const level = levels.find((item) => item.id === levelId) || levels[0];
  const lesson = level.lessons.find((item) => item.id === lessonId) || level.lessons[0];
  const correct = selectedAnswer === lesson.answer;
  const isCompleted = completedLessons.includes(lesson.id);

  useEffect(() => () => speechRef.current?.stop(), []);

  const chooseLevel = (nextLevel) => {
    const target = levels.find((item) => item.id === nextLevel);
    if (!target?.unlocked) return;
    speechRef.current?.stop();
    speechRef.current = null;
    setVoiceStatus('');
    setLevelId(nextLevel);
    setLessonId(target.lessons[0].id);
    setSelectedAnswer(null);
    setHasChecked(false);
  };

  const chooseLesson = (nextLesson) => {
    speechRef.current?.stop();
    speechRef.current = null;
    setVoiceStatus('');
    setLessonId(nextLesson.id);
    setSelectedAnswer(null);
    setHasChecked(false);
  };

  const playLesson = () => {
    speechRef.current?.stop();
    setVoiceStatus(isBn ? 'শুনছি…' : 'Playing…');
    try {
      speechRef.current = speakWithGoogleTts(
        `${lesson.title.en}. ${lesson.rule.en} For example: ${lesson.example}`,
        {
          lang: 'en',
          locale: 'en',
          onEnd: () => {
            speechRef.current = null;
            setVoiceStatus('');
          },
          onError: (error) => {
            speechRef.current = null;
            setVoiceStatus(error.message || (isBn ? 'ভয়েস চালানো যায়নি।' : 'Voice playback failed.'));
          },
        },
      );
    } catch (error) {
      speechRef.current = null;
      setVoiceStatus(error instanceof Error ? error.message : (isBn ? 'ভয়েস চালানো যায়নি।' : 'Voice playback failed.'));
    }
  };

  const stopLesson = () => {
    speechRef.current?.stop();
    speechRef.current = null;
    setVoiceStatus('');
  };

  const checkAnswer = () => {
    if (selectedAnswer === null) return;
    setHasChecked(true);
    if (!correct || isCompleted) return;
    setCompletedLessons((current) => (
      current.includes(lesson.id) ? current : [...current, lesson.id]
    ));
  };

  const nextLesson = () => {
    const next = level.lessons.find((item) => !completedLessons.includes(item.id));
    if (next) chooseLesson(next);
    else {
      const nextLevel = levels[levels.findIndex((item) => item.id === levelId) + 1];
      if (nextLevel?.unlocked) chooseLevel(nextLevel.id);
    }
  };

  return (
    <section className="grammar-lessons-section space-y-4" aria-label={isBn ? 'ইংরেজি Grammar পাঠ' : 'English grammar lessons'}>
      <Card className="surface-card space-y-5 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-sapphire-deep/20 via-paper to-gold/10 p-5 shadow-xl sm:p-7">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-3xl shadow-inner">📖</span>
          <div>
            <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">
              {isBn ? 'Building — ইংরেজি বাক্য অনুশীলন' : 'Building — English practice'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/75">
              {isBn
                ? 'সহজ নিয়ম শিখুন, ছোট অনুশীলন করুন, আর স্বাভাবিক ইংরেজি কণ্ঠে পাঠ শুনুন।'
                : 'Learn a clear rule, try a short exercise, and listen to each lesson in a natural English voice.'}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3" aria-label={isBn ? 'Grammar-এর স্তর' : 'Grammar levels'}>
          {levels.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!item.unlocked}
              aria-pressed={levelId === item.id}
              onClick={() => chooseLevel(item.id)}
              className={`min-h-12 rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                levelId === item.id
                  ? 'border-gold bg-gold/15 text-ink shadow-sm'
                  : 'border-sapphire/20 bg-paper/65 text-ink/75 hover:border-gold/50'
              }`}
            >
              <span className="block">{item.title[isBn ? 'bn' : 'en']}</span>
              <span className="mt-1 block text-[10px] font-semibold opacity-65">
                {completedCounts[item.id]}/{item.lessons.length} {isBn ? 'পাঠ শেষ' : 'lessons complete'}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" aria-label={isBn ? 'পাঠ বেছে নিন' : 'Choose a lesson'}>
          {level.lessons.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={lesson.id === item.id}
              onClick={() => chooseLesson(item)}
              className={`min-h-10 rounded-full border px-4 py-2 text-xs font-bold ${
                lesson.id === item.id
                  ? 'border-sapphire bg-sapphire/15 text-ink'
                  : 'border-sapphire/20 bg-paper/60 text-ink/75'
              }`}
            >
              {index + 1}. {item.title[isBn ? 'bn' : 'en']}
              {completedLessons.includes(item.id) ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <article className="space-y-4 rounded-2xl border border-sapphire/20 bg-paper/70 p-4 sm:p-5">
          <h3 className="text-lg font-extrabold text-ink">{lesson.title[isBn ? 'bn' : 'en']}</h3>
          <p className="text-sm leading-relaxed text-ink/80">{lesson.rule[isBn ? 'bn' : 'en']}</p>
          <p className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-base font-bold text-ink" lang="en">
            {lesson.example}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={playLesson} className="min-h-11 rounded-xl bg-gradient-to-r from-sapphire-deep to-sapphire px-4 py-2 text-sm font-extrabold text-white shadow-lg">
              🔊 {isBn ? 'স্বাভাবিক কণ্ঠে শুনুন' : 'Listen naturally'}
            </button>
            {voiceStatus === 'Playing…' || voiceStatus === 'শুনছি…' ? (
              <button type="button" onClick={stopLesson} className="min-h-11 rounded-xl border border-sapphire/25 bg-paper/70 px-4 py-2 text-sm font-bold text-ink">
                {isBn ? 'থামান' : 'Stop'}
              </button>
            ) : null}
            {voiceStatus ? <span role="status" className="text-xs font-semibold text-ink/70">{voiceStatus}</span> : null}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-extrabold text-ink">{lesson.prompt[isBn ? 'bn' : 'en']}</legend>
            {lesson.choices.map((choice, index) => (
              <label key={choice} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                selectedAnswer === index ? 'border-sapphire bg-sapphire/10' : 'border-sapphire/15 bg-paper/50'
              }`}>
                <input
                  type="radio"
                  name={`grammar-${lesson.id}`}
                  checked={selectedAnswer === index}
                  onChange={() => {
                    setSelectedAnswer(index);
                    setHasChecked(false);
                  }}
                />
                <span lang="en">{choice}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={checkAnswer}
              disabled={selectedAnswer === null || hasChecked || isCompleted}
              className="min-h-11 rounded-xl border border-gold/40 bg-gold/15 px-5 py-2 text-sm font-extrabold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBn ? 'উত্তর যাচাই' : 'Check answer'}
            </button>
            {selectedAnswer !== null && hasChecked ? (
              <p role="status" className={`text-sm font-bold ${correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                {correct
                  ? (isBn ? `ঠিক উত্তর! ${lesson.feedback.bn}` : `That's right! ${lesson.feedback.en}`)
                  : (isBn ? 'আবার চেষ্টা করুন। নিয়মটি মনে করুন।' : 'Not quite. Think about the rule and try again.')}
              </p>
            ) : null}
            {isCompleted ? (
              <button type="button" onClick={nextLesson} className="min-h-11 rounded-xl bg-sapphire px-4 py-2 text-sm font-extrabold text-white">
                {isBn ? 'পরের পাঠ →' : 'Next lesson →'}
              </button>
            ) : null}
          </div>
        </article>
      </Card>

      <details className="group">
        <summary className="cursor-pointer rounded-2xl border border-gold/25 bg-paper/80 px-4 py-3 font-extrabold text-ink shadow-sm">
          {isBn
            ? 'গল্প থেকে বাক্য সাজানোর অনুশীলন · ১০টি বাক্যে ৩০ পয়েন্ট'
            : 'Practice building sentences from stories · earn 30 points at 10'}
        </summary>
        <div className="pt-4">
          <SentenceBuilder lang={lang} stories={stories} />
        </div>
      </details>
    </section>
  );
}
