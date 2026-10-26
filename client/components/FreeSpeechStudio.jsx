'use client';

import { useEffect, useRef, useState } from 'react';
import { evaluateContextSpeech } from '../lib/contextSpeakingEvaluator.js';
import { isAndroidNativeApp, recognizeEnglishSpeech, stopEnglishSpeechRecognition } from '../lib/nativeSpeech.js';
import { announceLearningActivity } from '../lib/learningFeedback.js';
import { playCongratulationsSound } from '../lib/notificationSound.js';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

const MAX_DURATION_SECONDS = 300; // 5 minutes

const EXPRESSION_TOPICS = [
  {
    id: 'my-day',
    icon: '💭',
    title: { bn: 'আজকের অনুভূতি ও সারাদিন', en: 'My Day & Feelings' },
    prompts: {
      bn: ['আজকে আপনার দিনটি কেমন কেটেছে?', 'কোন বিষয়টি আপনাকে আনন্দ দিয়েছে?', 'আজকে নতুন কী করেছেন বা শিখেছেন?'],
      en: ['How was your day today?', 'What made you smile or feel happy?', 'What is one new thing you did or learned?'],
    },
    contextKeywords: ['today', 'morning', 'evening', 'work', 'study', 'feel', 'happy', 'busy', 'routine', 'family', 'walk', 'food', 'time', 'relax', 'thoughts', 'hope'],
  },
  {
    id: 'dreams-goals',
    icon: '🌟',
    title: { bn: 'স্বপ্ন, লক্ষ্য ও ভবিষ্যৎ', en: 'Dreams & Goals' },
    prompts: {
      bn: ['আপনার জীবনের সবচেয়ে বড় স্বপ্ন কী?', 'এই বছর আপনি কী অর্জন করতে চান?', 'সেই লক্ষ্য পূরণ করতে আপনি কী কী করছেন?'],
      en: ['What is your biggest dream in life?', 'What do you want to achieve this year?', 'What steps are you taking to reach your goal?'],
    },
    contextKeywords: ['dream', 'goal', 'future', 'career', 'study', 'learn', 'skill', 'improve', 'work', 'hard', 'success', 'achieve', 'plan', 'passion', 'grow', 'life'],
  },
  {
    id: 'special-memory',
    icon: '☕',
    title: { bn: 'প্রিয় স্মৃতি বা প্রিয় মানুষ', en: 'Memories & Loved Ones' },
    prompts: {
      bn: ['আপনার জীবনের একটি সুন্দর স্মৃতির কথা বলুন।', 'আপনার প্রিয় মানুষটি কে এবং কেন?', 'কোন ভ্রমণের স্মৃতি আপনার মনে দাগ কেটে আছে?'],
      en: ['Share a beautiful memory from your life.', 'Who is someone you admire and why?', 'What was a favorite trip or childhood moment?'],
    },
    contextKeywords: ['memory', 'friend', 'family', 'mother', 'father', 'travel', 'childhood', 'place', 'remember', 'love', 'special', 'fun', 'happy', 'smile', 'moment', 'story'],
  },
  {
    id: 'habits-routine',
    icon: '🎯',
    title: { bn: 'অভ্যাস ও প্রতিদিনের জীবন', en: 'Habits & Daily Routine' },
    prompts: {
      bn: ['প্রতিদিন সকালে আপনি কী দিয়ে দিন শুরু করেন?', 'কোন ভালো অভ্যাসটি আপনি নিয়মিত রাখতে চান?', 'সময় কীভাবে সঠিকভাবে কাজে লাগান?'],
      en: ['How do you start your morning every day?', 'What good habit do you want to keep?', 'How do you manage your time effectively?'],
    },
    contextKeywords: ['habit', 'routine', 'morning', 'wake', 'exercise', 'healthy', 'read', 'focus', 'sleep', 'discipline', 'daily', 'change', 'mind', 'schedule', 'energy', 'water'],
  },
  {
    id: 'open-topic',
    icon: '🕊️',
    title: { bn: 'সম্পূর্ণ উন্মুক্ত কথন', en: 'Open Free Expression' },
    prompts: {
      bn: ['যেকোনো বিষয়ে মনের মতো কথা বলুন—কোনো বাধা বা রুলস নেই!', 'আপনার প্রিয় শখ, বই, সিনেমা বা চিন্তা প্রকাশ করুন।'],
      en: ['Speak freely about anything on your mind—no rules, no limits!', 'Talk about your passions, thoughts, hobbies, or the world.'],
    },
    contextKeywords: ['think', 'believe', 'life', 'world', 'hobby', 'book', 'music', 'nature', 'technology', 'people', 'freedom', 'express', 'ideas', 'voice', 'experience', 'heart'],
  },
];

export function FreeSpeechStudio({ lang = 'bn' }) {
  const isBn = lang === 'bn';
  const [selectedTopicId, setSelectedTopicId] = useState(EXPRESSION_TOPICS[0].id);
  const [isRecording, setIsRecording] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(MAX_DURATION_SECONDS);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [errorNotice, setErrorNotice] = useState('');
  const [manualInputOpen, setManualInputOpen] = useState(false);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  const transcriptRef = useRef('');

  const selectedTopic = EXPRESSION_TOPICS.find((t) => t.id === selectedTopicId) || EXPRESSION_TOPICS[0];

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopActiveSpeech = async () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (isAndroidNativeApp()) {
      try {
        await stopEnglishSpeechRecognition();
      } catch {
        // ignore
      }
    }
  };

  const handleFinishSpeaking = async () => {
    stopTimer();
    await stopActiveSpeech();
    setIsRecording(false);

    const finalTranscript = (transcriptRef.current + ' ' + interimText).trim();
    setTranscript(finalTranscript);
    setInterimText('');

    const duration = Math.max(1, elapsedSecondsRef.current);
    const mockSituation = {
      id: selectedTopic.id,
      title: selectedTopic.title,
      description: selectedTopic.title,
      dialogue: selectedTopic.contextKeywords.join(' '),
    };

    const result = evaluateContextSpeech({
      transcript: finalTranscript,
      situation: mockSituation,
      durationSeconds: duration,
    });

    setEvaluation(result);
    if (result.score >= 35) {
      playCongratulationsSound();
      announceLearningActivity(15);
    }
  };

  const handleStartSpeaking = async () => {
    setErrorNotice('');
    setEvaluation(null);
    setTranscript('');
    setInterimText('');
    transcriptRef.current = '';
    setSecondsRemaining(MAX_DURATION_SECONDS);
    elapsedSecondsRef.current = 0;

    const SpeechRecognition = globalThis.window?.SpeechRecognition
      || globalThis.window?.webkitSpeechRecognition;
    const nativeApp = isAndroidNativeApp();

    if (!nativeApp && !SpeechRecognition) {
      setErrorNotice(
        isBn
          ? 'আপনার ডিভাইসে ব্রাউজার ভয়েস রিকগনিশন কাজ করছে না। আপনি নিচের বক্সে টাইপ করে যাচাই করতে পারেন।'
          : 'Speech recognition is not supported in this browser. You can type in the box below to test.',
      );
      setManualInputOpen(true);
      return;
    }

    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((current) => {
        const next = current - 1;
        elapsedSecondsRef.current = MAX_DURATION_SECONDS - next;
        if (next <= 0) {
          void handleFinishSpeaking();
          return 0;
        }
        return next;
      });
    }, 1000);

    if (nativeApp) {
      try {
        const nativeText = await recognizeEnglishSpeech();
        transcriptRef.current = nativeText;
        setTranscript(nativeText);
      } catch (err) {
        if (err?.code !== 'NO_MATCH') {
          setErrorNotice(err?.message || (isBn ? 'ভয়েস সনাক্ত করা যায়নি।' : 'Speech could not be recognized.'));
        }
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = 0; i < event.results.length; i += 1) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += ' ' + res[0].transcript;
          } else {
            interimChunk += ' ' + res[0].transcript;
          }
        }
        if (finalChunk) {
          transcriptRef.current = (transcriptRef.current + ' ' + finalChunk).trim();
          setTranscript(transcriptRef.current);
        }
        setInterimText(interimChunk.trim());
      };

      recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          setErrorNotice(isBn ? 'মাইক্রোফোনে সংযোগ বিঘ্নিত হয়েছে।' : `Microphone error: ${e.error}`);
        }
      };

      recognition.onend = () => {
        if (elapsedSecondsRef.current < MAX_DURATION_SECONDS && timerRef.current) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Could not start microphone.');
      setIsRecording(false);
      stopTimer();
    }
  };

  const handleReset = async () => {
    stopTimer();
    await stopActiveSpeech();
    setIsRecording(false);
    setSecondsRemaining(MAX_DURATION_SECONDS);
    setTranscript('');
    setInterimText('');
    setEvaluation(null);
    setErrorNotice('');
  };

  useEffect(() => {
    return () => {
      stopTimer();
      void stopActiveSpeech();
    };
  }, []);

  const spokenWordsCount = (transcript + ' ' + interimText).trim().split(/\s+/).filter(Boolean).length;

  return (
    <section className="free-speech-studio-section space-y-4" aria-label={isBn ? 'মুক্ত কথন স্টুডিও' : 'Free Speech Studio'}>
      {/* Studio Banner */}
      <Card className="surface-card overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-sapphire-deep/40 via-paper to-gold/15 p-4 shadow-xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/20 text-3xl shadow-inner">
              🕊️
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-ink">
                {isBn ? 'মুক্ত কথন ও আত্মপ্রকাশ স্টুডিও' : 'Free Speech & Expression Studio'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-ink/75">
                {isBn
                  ? 'কোনো স্ক্রিপ্ট বা ভুলের ভয় নেই—যেকোনো বিষয় নিয়ে ৫ মিনিট নিজের মতো কথা বলুন!'
                  : 'No scripts, no fear—speak freely in English for up to 5 minutes on any topic!'}
              </p>
            </div>
          </div>
          <span className="rounded-xl border border-gold/40 bg-gold/20 px-3 py-1.5 text-xs font-black text-gold-soft shadow-sm">
            🎯 {isBn ? '১০০ নম্বরে এআই মূল্যায়ন' : 'AI Score / 100'}
          </span>
        </div>

        {/* Expression Topic Selector Chips */}
        <div className="mt-4 space-y-2 border-t border-gold/15 pt-3">
          <p className="text-xs font-extrabold uppercase tracking-wider text-ink/65">
            {isBn ? 'অনুপ্রেরণামূলক বিষয় নির্বাচন করুন:' : 'Choose an inspiring topic:'}
          </p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={isBn ? 'কথনের বিষয়' : 'Speaking Topics'}>
            {EXPRESSION_TOPICS.map((topic) => {
              const active = selectedTopicId === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (!isRecording) {
                      setSelectedTopicId(topic.id);
                      setEvaluation(null);
                    }
                  }}
                  disabled={isRecording}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-all duration-200 ${
                    active
                      ? 'border-2 border-gold bg-gold text-on-gold shadow-md scale-105'
                      : 'border border-sapphire/20 bg-paper/80 text-ink/80 hover:bg-gold/10'
                  } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span aria-hidden="true">{topic.icon}</span>
                  <span>{topic.title[lang] || topic.title.en}</span>
                </button>
              );
            })}
          </div>

          {/* Inspiring Thought Starters for Selected Topic */}
          <div className="rounded-2xl border border-sapphire/20 bg-paper/60 p-3 text-xs">
            <p className="font-extrabold text-ink/85 flex items-center gap-1.5">
              <span>💡</span>
              <span>{isBn ? 'কথা বলার কিছু সুন্দর সূত্র:' : 'Thought starters to speak about:'}</span>
            </p>
            <ul className="mt-1.5 list-disc list-inside space-y-1 text-ink/75 font-semibold">
              {(selectedTopic.prompts[lang] || selectedTopic.prompts.en).map((cue, idx) => (
                <li key={idx}>{cue}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Live Speaking Stage */}
        <div className="mt-4 space-y-4 rounded-2xl border-2 border-sapphire/25 bg-paper/90 p-4 sm:p-5 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`grid size-14 place-items-center rounded-2xl font-mono text-xl font-black shadow-inner transition-all duration-300 ${
                  isRecording
                    ? 'border-2 border-rose-500 bg-rose-500/15 text-rose-600 animate-pulse scale-105'
                    : 'border border-gold/40 bg-gold/15 text-ink'
                }`}
              >
                {formatTime(secondsRemaining)}
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-ink/70">
                  {isRecording
                    ? (isBn ? '🔴 কথা বলা রেকর্ড হচ্ছে…' : '🔴 Recording in progress…')
                    : (isBn ? 'সর্বোচ্চ ৫:০০ মিনিট সময়' : 'Max 5:00 minutes')}
                </p>
                <p className="text-xs text-ink/75 font-medium">
                  {isBn
                    ? 'যেকোনো সময় আপনি কথা শেষ করতে পারেন।'
                    : 'Feel free to finish whenever you want.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isRecording ? (
                <Button
                  variant="primary"
                  onClick={handleStartSpeaking}
                  className="min-h-12 px-6 py-2.5 text-sm font-black shadow-lg bg-gradient-to-r from-sapphire to-sapphire-deep hover:brightness-105"
                >
                  <span aria-hidden="true">🎙️</span>
                  <span className="ml-2">{isBn ? 'কথা বলা শুরু করুন' : 'Start Speaking'}</span>
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishSpeaking}
                  className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-rose-500 bg-rose-600 px-6 py-2.5 text-sm font-black text-white shadow-xl hover:bg-rose-700 animate-pulse active:scale-95"
                >
                  <span aria-hidden="true">⏹️</span>
                  <span>{isBn ? 'কথা শেষ ও স্কোর দেখুন' : 'Finish & Get Score'}</span>
                </button>
              )}

              {(evaluation || transcript) && !isRecording ? (
                <Button
                  variant="secondary"
                  onClick={handleReset}
                  className="min-h-11 px-4 py-2 text-xs font-bold"
                >
                  <span aria-hidden="true">🔄</span>
                  <span className="ml-1">{isBn ? 'নতুন করে' : 'Reset'}</span>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Transcript Box */}
          <div className="rounded-2xl border border-sapphire/20 bg-paper/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-ink/70">
              <span>{isBn ? 'আপনার মুখে বলা কথা (লাইভ ট্রান্সক্রিপ্ট):' : 'Spoken words (live transcript):'}</span>
              <span>{spokenWordsCount} {isBn ? 'শব্দ' : 'words'}</span>
            </div>
            <div className="min-h-20 rounded-xl border border-ink/10 bg-paper p-3 text-sm text-ink leading-relaxed">
              {transcript || interimText ? (
                <p>
                  <span>{transcript}</span>
                  {interimText ? <span className="text-ink/50 italic"> {interimText}</span> : null}
                </p>
              ) : (
                <p className="text-xs italic text-ink/40">
                  {isRecording
                    ? (isBn ? 'কথা বলতে থাকুন, এখানে আপনার কথাগুলো দেখা যাবে...' : 'Keep speaking, your words will appear here...')
                    : (isBn ? 'কথা বলা শুরু করতে উপরের "কথা বলা শুরু করুন" বাটনে চাপুন।' : 'Press "Start Speaking" above to begin.')}
                </p>
              )}
            </div>
          </div>

          {errorNotice ? (
            <p role="alert" className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-ink">
              {errorNotice}
            </p>
          ) : null}
        </div>

        {/* AI Evaluation Result Card */}
        {evaluation ? (
          <div className="mt-4 enter-up space-y-3 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl border-2 border-emerald-500 bg-emerald-500/20 text-3xl font-black text-emerald-800">
                  {evaluation.score}
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-ink">
                    {evaluation.score >= 70
                      ? (isBn ? '🎉 অসাধারণ আত্মপ্রকাশ!' : '🎉 Outstanding Expression!')
                      : evaluation.score >= 40
                        ? (isBn ? '👏 দারুণ প্রচেষ্টা! চালিয়ে যান' : '👏 Great Effort! Keep going')
                        : (isBn ? '🌱 ভালো চেষ্টা—আরেকটু বলুন' : '🌱 Good Start—Speak more')}
                  </h3>
                  <p className="text-xs font-bold text-ink/75">
                    {isBn
                      ? `মোট শব্দ: ${evaluation.wordCount} · সময়: ${evaluation.durationSeconds} সেকেন্ড · গতি: ${evaluation.wpm} শব্দ/মিনিট`
                      : `Words: ${evaluation.wordCount} · Time: ${evaluation.durationSeconds}s · Speed: ${evaluation.wpm} WPM`}
                  </p>
                </div>
              </div>
              <span className="rounded-xl border border-gold bg-gold/20 px-3 py-1.5 text-xs font-black text-gold-soft">
                +15 XP {isBn ? 'অর্জিত!' : 'Earned!'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
              <div className="rounded-xl border border-sapphire/20 bg-paper/80 p-2">
                <p className="font-extrabold text-ink">{evaluation.relevanceScore} / 40</p>
                <p className="text-[10px] text-ink/70 font-semibold">{isBn ? 'প্রাসঙ্গিকতা' : 'Relevance'}</p>
              </div>
              <div className="rounded-xl border border-sapphire/20 bg-paper/80 p-2">
                <p className="font-extrabold text-ink">{evaluation.fluencyScore} / 30</p>
                <p className="text-[10px] text-ink/70 font-semibold">{isBn ? 'সাবলীলতা' : 'Fluency'}</p>
              </div>
              <div className="rounded-xl border border-sapphire/20 bg-paper/80 p-2">
                <p className="font-extrabold text-ink">{evaluation.vocabularyScore} / 30</p>
                <p className="text-[10px] text-ink/70 font-semibold">{isBn ? 'শব্দভাণ্ডার' : 'Vocabulary'}</p>
              </div>
            </div>

            <p className="rounded-xl border border-emerald-500/25 bg-paper/90 p-3 text-xs font-bold text-ink leading-relaxed">
              {evaluation.feedback?.[lang] || evaluation.feedback?.en}
            </p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
