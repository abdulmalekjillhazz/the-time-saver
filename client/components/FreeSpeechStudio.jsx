'use client';

import { useEffect, useRef, useState } from 'react';
import {
  evaluateContextSpeech,
  evaluateContextSpeechWithServerAI,
} from '../lib/contextSpeakingEvaluator.js';
import { isAndroidNativeApp, recognizeEnglishSpeech, stopEnglishSpeechRecognition } from '../lib/nativeSpeech.js';
import { stopActiveAudioPlayback } from '../lib/audioPlayback.js';
import { apiRequest } from '../lib/apiClient.js';
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
  const [isFullscreenStudio, setIsFullscreenStudio] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(MAX_DURATION_SECONDS);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const [manualInputOpen, setManualInputOpen] = useState(false);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  const transcriptRef = useRef('');
  const isRecordingRef = useRef(false);
  const transcriptBottomRef = useRef(null);

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
    isRecordingRef.current = false;
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

    setIsEvaluating(true);
    try {
      const result = await evaluateContextSpeechWithServerAI({
        transcript: finalTranscript,
        situation: mockSituation,
        durationSeconds: duration,
        lang,
      });

      setEvaluation(result);
      const effectiveScore = Math.min(100, Math.round(result.score || 0));
      if (effectiveScore >= 30) {
        try {
          const gamificationResult = await apiRequest('/api/gamification/pronunciation', {
            method: 'POST',
            body: {
              slug: `free-speech-${selectedTopic.id}`,
              accuracy: effectiveScore,
            },
            locale: lang,
          });
          const earned = gamificationResult?.earnedPoints ?? 15;
          announceLearningActivity(earned);
        } catch {
          announceLearningActivity(15);
        }
        playCongratulationsSound();
      }
    } catch {
      const fallbackResult = evaluateContextSpeech({
        transcript: finalTranscript,
        situation: mockSituation,
        durationSeconds: duration,
      });
      setEvaluation(fallbackResult);
      const fallbackScore = Math.min(100, Math.round(fallbackResult.score || 0));
      if (fallbackScore >= 30) {
        try {
          await apiRequest('/api/gamification/pronunciation', {
            method: 'POST',
            body: {
              slug: `free-speech-${selectedTopic.id}`,
              accuracy: fallbackScore,
            },
            locale: lang,
          });
        } catch {
          // offline fallback
        }
        playCongratulationsSound();
        announceLearningActivity(15);
      }
    } finally {
      setIsEvaluating(false);
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

    // Silence any background playback before starting speech practice
    stopActiveAudioPlayback();
    if (typeof window !== 'undefined') {
      document.querySelectorAll('audio').forEach((a) => {
        try { a.pause(); } catch { /* ignore */ }
      });
      if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      }
    }

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

    isRecordingRef.current = true;
    setIsRecording(true);
    setIsFullscreenStudio(true);

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
      (async () => {
        while (isRecordingRef.current) {
          try {
            const chunk = await recognizeEnglishSpeech();
            if (!isRecordingRef.current) break;
            if (chunk && chunk.trim()) {
              const cleanChunk = chunk.trim();
              transcriptRef.current = transcriptRef.current
                ? `${transcriptRef.current} ${cleanChunk}`
                : cleanChunk;
              setTranscript(transcriptRef.current);
            }
          } catch (err) {
            if (!isRecordingRef.current || err?.code === 'CANCELED') {
              break;
            }
            // Yield briefly and continue listening while isRecording is true
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      })();
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript.trim();
            if (text) {
              transcriptRef.current = transcriptRef.current ? `${transcriptRef.current} ${text}` : text;
              setTranscript(transcriptRef.current);
            }
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimText(interim.trim());
      };

      recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          setErrorNotice(isBn ? 'মাইক্রোফোনে সংযোগ বিঘ্নিত হয়েছে।' : `Microphone error: ${e.error}`);
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch {
            // ignore if already active
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Could not start microphone.');
      setIsRecording(false);
      isRecordingRef.current = false;
      stopTimer();
    }
  };

  const handleReset = async () => {
    stopTimer();
    await stopActiveSpeech();
    setIsRecording(false);
    isRecordingRef.current = false;
    setSecondsRemaining(MAX_DURATION_SECONDS);
    setTranscript('');
    setInterimText('');
    setEvaluation(null);
    setIsEvaluating(false);
    setErrorNotice('');
  };

  const handleExitFullscreen = async () => {
    if (isRecording) {
      await handleFinishSpeaking();
    }
    setIsFullscreenStudio(false);
  };

  useEffect(() => {
    return () => {
      stopTimer();
      void stopActiveSpeech();
    };
  }, []);

  // Auto-scroll transcript container as speech flows
  useEffect(() => {
    if (transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, interimText]);

  const spokenWordsCount = (transcript + ' ' + interimText).trim().split(/\s+/).filter(Boolean).length;
  const progressPct = ((MAX_DURATION_SECONDS - secondsRemaining) / MAX_DURATION_SECONDS) * 100;

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
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider text-gold-soft uppercase">SMART ROUTINE</span>
                <span className="rounded-full bg-sapphire/20 px-2 py-0.5 text-[10px] font-extrabold text-sapphire uppercase">STUDIO</span>
              </div>
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

        {/* Action Button to Open Studio */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sapphire/20 bg-paper/80 p-4">
          <div>
            <p className="text-xs font-extrabold text-ink/75 uppercase tracking-wide">
              {isBn ? 'পূর্ণ স্ক্রিন স্পিকিং স্টুডিও' : 'Full Screen Voice Studio'}
            </p>
            <p className="text-xs text-ink/65">
              {isBn
                ? 'মাইক্রোফোন চালু করলেই পূর্ণ স্ক্রিন ভয়েস স্টুডিও খুলবে।'
                : 'Tap to launch the full-screen speech studio with continuous live transcription.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={handleStartSpeaking}
              className="min-h-12 px-6 py-2.5 text-sm font-black shadow-lg bg-gradient-to-r from-sapphire to-sapphire-deep hover:brightness-105"
            >
              <span aria-hidden="true">🎙️</span>
              <span className="ml-2">{isBn ? '৫ মিনিট স্পিকিং শুরু করুন' : 'Start 5-Min Speaking'}</span>
            </Button>
            {evaluation ? (
              <Button
                variant="secondary"
                onClick={() => setIsFullscreenStudio(true)}
                className="min-h-12 px-4 py-2 text-xs font-bold"
              >
                <span>📊 {isBn ? 'ফলাফল দেখুন' : 'View Results'}</span>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* FULL SCREEN VOICE STUDIO OVERLAY */}
      {isFullscreenStudio ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isBn ? 'স্মার্ট রুটিন মুক্ত কথন স্টুডিও' : 'Smart Routine Free Speech Studio'}
          className="fixed inset-0 z-[120] flex flex-col bg-paper text-ink overflow-hidden animate-fade-in"
        >
          {/* Top Branding Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-sapphire/20 bg-paper/95 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-gold/20 text-gold-soft font-black shadow-inner">
                <span className="text-xl">✨</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-black tracking-wider text-gold-soft uppercase">SMART ROUTINE</span>
                  <span className="rounded-full bg-sapphire/20 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-sapphire uppercase">STUDIO</span>
                </div>
                <h1 className="text-xs sm:text-sm font-black text-ink">
                  {isBn ? '৫ মিনিট ইংলিশ মুক্ত কথন স্টুডিও' : '5-Min English Voice Studio'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-black text-gold-soft">
                {selectedTopic.icon} {selectedTopic.title[lang] || selectedTopic.title.en}
              </span>
              <button
                type="button"
                onClick={handleExitFullscreen}
                aria-label={isBn ? 'স্টুডিও বন্ধ করুন' : 'Exit Studio'}
                title={isBn ? 'স্টুডিও বন্ধ করুন' : 'Exit Studio'}
                className="grid size-10 place-items-center rounded-xl border border-sapphire/25 bg-paper hover:bg-ink/5 text-ink text-lg font-black transition active:scale-95"
              >
                ✕
              </button>
            </div>
          </header>

          {/* Subheader: Timer & Topic Cues Bar */}
          <div className="shrink-0 border-b border-sapphire/15 bg-paper/60 px-4 py-2.5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`grid h-9 px-3 place-items-center rounded-xl font-mono text-sm font-black shadow-inner transition ${
                    isRecording
                      ? 'border-2 border-rose-500 bg-rose-500/15 text-rose-600 animate-pulse'
                      : 'border border-gold/40 bg-gold/15 text-ink'
                  }`}
                >
                  ⏱️ {formatTime(secondsRemaining)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block size-2.5 rounded-full ${
                      isRecording ? 'bg-rose-500 animate-ping' : 'bg-ink/30'
                    }`}
                  />
                  <span className="text-xs font-bold text-ink/75">
                    {isRecording
                      ? (isBn ? 'লাইভ মাইক্রোফোন সক্রিয়' : 'Live Microphone Active')
                      : (isBn ? 'রেকর্ডিং শেষ' : 'Recording Finished')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-ink/70">
                <span>💬 {spokenWordsCount} {isBn ? 'শব্দ' : 'words'}</span>
              </div>
            </div>

            {/* Progress Track */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  isRecording ? 'bg-gradient-to-r from-rose-500 via-gold to-sapphire' : 'bg-sapphire'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Center Main Canvas: Live Scrolling Transcript Area */}
          <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Thought-starter prompts badge */}
            <div className="rounded-2xl border border-sapphire/20 bg-paper/80 p-3 text-xs">
              <span className="font-extrabold text-ink/80">
                💡 {isBn ? 'এই বিষয়ে বলতে পারেন:' : 'Ideas to talk about:'}
              </span>{' '}
              <span className="text-ink/70">
                {(selectedTopic.prompts[lang] || selectedTopic.prompts.en).join(' · ')}
              </span>
            </div>

            {/* Spacious Streaming Transcript Container */}
            <div className="min-h-[260px] rounded-3xl border-2 border-sapphire/20 bg-paper/90 p-5 sm:p-7 shadow-inner">
              <div className="flex items-center justify-between border-b border-sapphire/15 pb-2.5 mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/65">
                  📝 {isBn ? 'আপনার মুখে বলা কথা (ধারাবাহিক লাইভ ট্রান্সক্রিপ্ট):' : 'Spoken Speech (Continuous Live Transcript):'}
                </span>
                {isRecording ? (
                  <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 animate-pulse">
                    ● {isBn ? 'শুনছে...' : 'Listening...'}
                  </span>
                ) : null}
              </div>

              {transcript || interimText ? (
                <div className="text-base sm:text-xl font-medium leading-relaxed text-ink select-text" lang="en">
                  <span>{transcript}</span>
                  {interimText ? (
                    <span className="ml-1.5 rounded bg-sapphire/10 px-1 text-sapphire italic underline decoration-sapphire/40">
                      {interimText}
                    </span>
                  ) : null}
                  <div ref={transcriptBottomRef} />
                </div>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center text-center p-6 space-y-3 text-ink/60">
                  <div className="grid size-14 place-items-center rounded-2xl bg-sapphire/10 text-3xl">
                    🎙️
                  </div>
                  <h3 className="text-base font-extrabold text-ink">
                    {isBn ? 'ইংরেজিতে স্বাভাবিকভাবে বলতে থাকুন' : 'Start speaking in English'}
                  </h3>
                  <p className="max-w-md text-xs sm:text-sm text-ink/70 leading-relaxed">
                    {isBn
                      ? 'ভুল হোক বা শুদ্ধ, ৫ মিনিট মনের কথা বলুন। আপনার প্রতিটি শব্দ এখানে অবিচ্ছিন্নভাবে যুক্ত হতে থাকবে।'
                      : 'Speak freely for up to 5 minutes without fear of mistakes. All your sentences will stream here continuously.'}
                  </p>
                </div>
              )}
            </div>

            {errorNotice ? (
              <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-bold text-rose-700">
                ⚠️ {errorNotice}
              </p>
            ) : null}

            {/* AI Evaluating State */}
            {isEvaluating ? (
              <div className="rounded-2xl border-2 border-gold/40 bg-gold/15 p-6 text-center space-y-3 animate-pulse">
                <div className="mx-auto size-10 rounded-full border-4 border-gold border-t-transparent animate-spin" />
                <h3 className="text-sm sm:text-base font-black text-ink">
                  {isBn ? '🤖 এআই স্পিকিং কোচ আপনার কথা যাচাই করছে...' : '🤖 AI Coach is evaluating your speech...'}
                </h3>
                <p className="text-xs text-ink/75">
                  {isBn
                    ? 'ব্যাকরণ, প্রাসঙ্গিক শব্দভাণ্ডার, সাবলীলতা ও গতি বিশ্লেষণ হচ্ছে।'
                    : 'Analyzing grammar, situational vocabulary, fluency, and delivery.'}
                </p>
              </div>
            ) : null}

            {/* Full AI Evaluation Results Modal/View */}
            {evaluation && !isEvaluating ? (
              <div className="enter-up space-y-4 rounded-3xl border-2 border-gold/40 bg-gradient-to-br from-gold/15 via-paper to-sapphire/10 p-5 sm:p-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/25 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-16 place-items-center rounded-2xl border-2 border-gold bg-gold/25 text-3xl font-black text-ink shadow-sm">
                      {evaluation.score}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wide text-gold-soft">
                          {isBn ? 'সার্বিক মূল্যায়ন' : 'Overall Evaluation'}
                        </span>
                        {evaluation.aiEvaluated ? (
                          <span className="rounded-full bg-sapphire/20 px-2 py-0.5 text-[10px] font-extrabold text-sapphire">
                            ✨ {isBn ? 'এআই যাচাইকৃত' : 'AI Verified'}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-lg font-black text-ink">
                        {evaluation.score >= 80
                          ? (isBn ? '🌟 চমৎকার সাবলীলতা!' : '🌟 Excellent Fluency!')
                          : evaluation.score >= 60
                            ? (isBn ? '👍 খুব ভালো অগ্রগতি!' : '👍 Solid Progress!')
                            : (isBn ? '💪 চালিয়ে যান, উন্নতি হবে!' : '💪 Keep Practicing!')}
                      </h3>
                      <p className="text-xs text-ink/75 font-semibold">
                        ⏱️ {Math.floor((evaluation.durationSeconds || 0) / 60)}m {(evaluation.durationSeconds || 0) % 60}s · 💬 {evaluation.wordCount} {isBn ? 'শব্দ' : 'words'} ({evaluation.wpm || 0} WPM)
                      </p>
                    </div>
                  </div>
                  <span className="rounded-xl border border-gold bg-gold/20 px-3.5 py-1.5 text-xs font-black text-gold-soft">
                    +15 XP {isBn ? 'অর্জিত!' : 'Earned!'}
                  </span>
                </div>

                {/* 3 Metric Breakdown Cards */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-2xl border border-sapphire/20 bg-paper/90 p-3 text-center">
                    <p className="text-xs font-bold text-ink/70">🎯 {isBn ? 'প্রাসঙ্গিকতা' : 'Relevance'}</p>
                    <p className="mt-1 text-lg font-black text-ink">{evaluation.relevanceScore} <span className="text-xs text-ink/50">/ ৪০</span></p>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
                      <div className="h-full rounded-full bg-sapphire" style={{ width: `${((evaluation.relevanceScore || 0) / 40) * 100}%` }} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-sapphire/20 bg-paper/90 p-3 text-center">
                    <p className="text-xs font-bold text-ink/70">🗣️ {isBn ? 'সাবলীলতা ও গতি' : 'Fluency & Pace'}</p>
                    <p className="mt-1 text-lg font-black text-ink">{evaluation.fluencyScore} <span className="text-xs text-ink/50">/ ৩৫</span></p>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${((evaluation.fluencyScore || 0) / 35) * 100}%` }} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-sapphire/20 bg-paper/90 p-3 text-center">
                    <p className="text-xs font-bold text-ink/70">📚 {isBn ? 'শব্দভাণ্ডার ও ব্যাকরণ' : 'Vocabulary & Grammar'}</p>
                    <p className="mt-1 text-lg font-black text-ink">{evaluation.vocabularyScore} <span className="text-xs text-ink/50">/ ২৫</span></p>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${((evaluation.vocabularyScore || 0) / 25) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* AI Coach Feedback */}
                <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 space-y-1.5">
                  <p className="text-xs font-black text-gold-soft flex items-center gap-1.5">
                    <span>💡</span>
                    <span>{isBn ? 'এআই কোচের পরামর্শ:' : 'AI Coach Feedback:'}</span>
                  </p>
                  <p className="text-sm font-bold text-ink leading-relaxed">
                    {evaluation.feedback?.[lang] || evaluation.feedback?.en || evaluation.feedback?.bn}
                  </p>
                </div>

                {/* AI Grammar Suggestions if available */}
                {Array.isArray(evaluation.grammarTips) && evaluation.grammarTips.length > 0 ? (
                  <div className="rounded-2xl border border-sapphire/20 bg-paper/90 p-4 space-y-2">
                    <p className="text-xs font-black text-ink">
                      📝 {isBn ? 'ব্যাকরণ ও বাক্য সংশোধনের পরামর্শ:' : 'Grammar & Phrasing Suggestions:'}
                    </p>
                    <div className="space-y-2 text-xs">
                      {evaluation.grammarTips.map((tip, idx) => (
                        <div key={idx} className="rounded-xl border border-sapphire/15 bg-paper p-2.5 space-y-1">
                          {tip.original ? (
                            <p className="text-rose-600 line-through">❌ &ldquo;{tip.original}&rdquo;</p>
                          ) : null}
                          <p className="font-bold text-emerald-700">✅ &ldquo;{tip.suggestion}&rdquo;</p>
                          {tip.explanation ? (
                            <p className="text-ink/70 text-[11px]">{tip.explanation}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Suggested Natural Phrases */}
                {Array.isArray(evaluation.suggestedPhrases) && evaluation.suggestedPhrases.length > 0 ? (
                  <div className="rounded-2xl border border-sapphire/20 bg-paper/90 p-4 space-y-2">
                    <p className="text-xs font-black text-ink">
                      💎 {isBn ? 'আরও স্মার্ট ও ন্যাচারাল অভিব্যক্তি:' : 'More Natural Expressions to Try:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {evaluation.suggestedPhrases.map((phrase, idx) => (
                        <span key={idx} className="rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs font-bold text-ink">
                          &ldquo;{phrase}&rdquo;
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </main>

          {/* Bottom Dock Controls */}
          <footer className="shrink-0 border-t border-sapphire/20 bg-paper/95 p-4 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <button
                    type="button"
                    onClick={handleFinishSpeaking}
                    className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-rose-500 bg-rose-600 px-6 py-2.5 text-sm font-black text-white shadow-xl hover:bg-rose-700 active:scale-95 animate-pulse"
                  >
                    <span>⏹️</span>
                    <span>{isBn ? 'কথা শেষ ও এআই মূল্যায়ন দেখুন' : 'Finish & Get AI Evaluation'}</span>
                  </button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleStartSpeaking}
                    className="min-h-12 px-6 py-2.5 text-sm font-black shadow-lg bg-gradient-to-r from-sapphire to-sapphire-deep hover:brightness-105"
                  >
                    <span>🎙️</span>
                    <span className="ml-2">{isBn ? 'আবার কথা বলা শুরু' : 'Speak Again'}</span>
                  </Button>
                )}

                {(evaluation || transcript) && !isRecording ? (
                  <Button
                    variant="secondary"
                    onClick={handleReset}
                    className="min-h-11 px-4 py-2 text-xs font-bold"
                  >
                    <span>🔄</span>
                    <span className="ml-1">{isBn ? 'রিসেট' : 'Reset'}</span>
                  </Button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleExitFullscreen}
                className="rounded-xl border border-sapphire/25 bg-paper px-4 py-2.5 text-xs font-bold text-ink hover:bg-ink/5"
              >
                {isBn ? 'স্টুডিও বন্ধ করুন' : 'Close Studio'}
              </button>
            </div>
          </footer>
        </div>
      ) : null}
    </section>
  );
}
