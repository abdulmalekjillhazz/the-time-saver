'use client';

import { useEffect, useRef, useState } from 'react';
import {
  evaluateContextSpeech,
  evaluateContextSpeechWithServerAI,
  extractContextKeywords,
} from '../lib/contextSpeakingEvaluator.js';
import { isAndroidNativeApp, recognizeEnglishSpeech, stopEnglishSpeechRecognition } from '../lib/nativeSpeech.js';
import { stopActiveAudioPlayback } from '../lib/audioPlayback.js';
import { apiRequest } from '../lib/apiClient.js';
import { announceLearningActivity } from '../lib/learningFeedback.js';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

const MAX_DURATION_SECONDS = 300; // 5 minutes

export function ContextSpeakingPractice({
  situation,
  lang = 'bn',
  onFinish,
}) {
  const isBn = lang === 'bn';
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

  const keywords = extractContextKeywords(situation);

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
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
    if (isAndroidNativeApp()) {
      try {
        await stopEnglishSpeechRecognition();
      } catch {
        // Ignore native stop errors
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

    setIsEvaluating(true);
    try {
      const result = await evaluateContextSpeechWithServerAI({
        transcript: finalTranscript,
        situation,
        durationSeconds: duration,
        lang,
      });
      setEvaluation(result);
      const effectiveScore = Math.min(100, Math.round(result.score || 0));
      if (effectiveScore >= 30) {
        try {
          const situationSlug = situation?.slug || situation?.id || 'context-practice';
          const gamificationResult = await apiRequest('/api/gamification/pronunciation', {
            method: 'POST',
            body: {
              slug: `context-${situationSlug}`,
              accuracy: effectiveScore,
            },
            locale: lang,
          });
          const earned = gamificationResult?.earnedPoints ?? Math.round(effectiveScore / 2);
          if (earned > 0) {
            announceLearningActivity(earned);
          }
        } catch {
          // offline fallback
        }
      }
      if (typeof onFinish === 'function') {
        onFinish(result);
      }
    } catch {
      const fallback = evaluateContextSpeech({
        transcript: finalTranscript,
        situation,
        durationSeconds: duration,
      });
      setEvaluation(fallback);
      const fallbackScore = Math.min(100, Math.round(fallback.score || 0));
      if (fallbackScore >= 30) {
        try {
          const situationSlug = situation?.slug || situation?.id || 'context-practice';
          const gamificationResult = await apiRequest('/api/gamification/pronunciation', {
            method: 'POST',
            body: {
              slug: `context-${situationSlug}`,
              accuracy: fallbackScore,
            },
            locale: lang,
          });
          const earned = gamificationResult?.earnedPoints ?? Math.round(fallbackScore / 2);
          if (earned > 0) {
            announceLearningActivity(earned);
          }
        } catch {
          // offline fallback
        }
      }
      if (typeof onFinish === 'function') {
        onFinish(fallback);
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
          ? 'আপনার ব্রাউজারে ভয়েস রেকর্ডিং সমর্থিত নয়। নিচের টেক্সট বক্সে টাইপ করে যাচাই করতে পারেন।'
          : 'Speech recognition is not supported in this browser. You can type in the box below to test.',
      );
      setManualInputOpen(true);
      return;
    }

    isRecordingRef.current = true;
    setIsRecording(true);
    setIsFullscreenStudio(true);

    // Start 5-minute countdown timer
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
              transcriptRef.current = transcriptRef.current
                ? `${transcriptRef.current} ${text}`
                : text;
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
          setErrorNotice(isBn ? 'মাইক্রোফোনে কোনো সমস্যা হয়েছে।' : `Microphone error: ${e.error}`);
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch {
            // Already active
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
    transcriptRef.current = '';
    elapsedSecondsRef.current = 0;
  };

  const handleExitFullscreen = async () => {
    if (isRecording) {
      await handleFinishSpeaking();
    }
    setIsFullscreenStudio(false);
  };

  useEffect(() => () => {
    stopTimer();
    void stopActiveSpeech();
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
    <Card className="surface-card context-speaking-card space-y-5 rounded-3xl border-2 border-gold/30 bg-gradient-to-br from-sapphire-deep/20 via-paper to-gold/10 p-4 shadow-xl sm:p-6">
      {/* Header Context Banner */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gold/20 pb-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl border border-gold/35 bg-gold/15 text-3xl shadow-inner">
            {situation?.icon || '🗣️'}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sapphire/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-sapphire">
                ⏱️ {isBn ? '৫ মিনিট স্পিকিং' : '5-Min Speech'}
              </span>
              <span className="text-xs font-bold text-ink/60">
                {situation?.category?.[isBn ? 'bn' : 'en'] || situation?.category?.en}
              </span>
            </div>
            <h3 className="mt-1 text-xl font-black text-ink">
              {situation?.title?.[isBn ? 'bn' : 'en'] || situation?.title?.en}
            </h3>
            <p className="mt-0.5 text-xs text-ink/75 sm:text-sm">
              {situation?.description?.[isBn ? 'bn' : 'en'] || situation?.description?.en}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-black text-gold-soft">
            🎯 {isBn ? '১০০ নম্বরে এআই মূল্যায়ন' : 'Score out of 100'}
          </span>
        </div>
      </div>

      {/* Suggested Context Keywords & Talking Tips */}
      <div className="rounded-2xl border border-sapphire/20 bg-paper/70 p-3.5 space-y-2.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-black text-ink">
          <span>💡 {isBn ? 'কীভাবে বলবেন ও মূল শব্দসমূহ:' : 'Tips & Context Keywords:'}</span>
        </div>
        <p className="text-ink/80 text-[13px]">
          {isBn
            ? 'এই পরিস্থিতিতে আপনি স্বাভাবিকভাবে কথা বলুন। আপনার পছন্দ, প্রশ্ন, প্রয়োজনীয়তা প্রকাশ করুন। যেকোনো সময় আপনি কথা শেষ করতে পারেন।'
            : 'Speak naturally in this situation. Express your wishes, ask questions, or order items. You can finish at any time.'}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {keywords.slice(0, 12).map((word) => (
            <span
              key={word}
              className={`rounded-lg border px-2 py-0.5 text-xs font-bold transition ${
                evaluation?.matchedKeywords?.includes(word)
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-800 font-extrabold shadow-sm'
                  : 'border-gold/30 bg-gold/10 text-ink/80'
              }`}
            >
              #{word}
            </span>
          ))}
        </div>
      </div>

      {/* Launcher Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sapphire/25 bg-paper/85 p-4 sm:p-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink/75">
            {isBn ? 'পূর্ণ স্ক্রিন স্পিকিং স্টুডিও' : 'Full Screen Voice Studio'}
          </p>
          <p className="text-xs text-ink/65">
            {isBn
              ? 'কথা বলা শুরু করলে পূর্ণ স্ক্রিন স্টুডিও খুলবে যেখানে ৫ মিনিট অবিরাম কথা বলতে পারবেন।'
              : 'Launch the full-screen speech studio with continuous live transcription.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleStartSpeaking}
            className="min-h-12 px-6 py-2.5 text-sm font-black shadow-lg bg-gradient-to-r from-sapphire to-sapphire-deep hover:brightness-105"
          >
            <span>🎙️</span>
            <span className="ml-2">{isBn ? 'স্পিকিং শুরু করুন' : 'Start Speaking'}</span>
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

      {/* FULL SCREEN VOICE STUDIO OVERLAY */}
      {isFullscreenStudio ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isBn ? 'স্মার্ট রুটিন স্পিকিং স্টুডিও' : 'Smart Routine Speech Studio'}
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
                  {isBn ? '৫ মিনিট পরিস্থিতি ভিত্তিক স্পিকিং স্টুডিও' : '5-Min Context Speech Studio'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-black text-gold-soft">
                {situation?.icon || '🗣️'} {situation?.title?.[isBn ? 'bn' : 'en'] || situation?.title?.en}
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

          {/* Subheader: Timer & Status Bar */}
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
                      : (isBn ? 'রেকর্ডিং সমাপ্ত' : 'Recording Completed')}
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
            {/* Situation context pill */}
            <div className="rounded-2xl border border-sapphire/20 bg-paper/80 p-3 text-xs">
              <span className="font-extrabold text-ink/80">
                {situation?.icon || '🗣️'} {situation?.title?.[isBn ? 'bn' : 'en'] || situation?.title?.en}:
              </span>{' '}
              <span className="text-ink/70">
                {situation?.description?.[isBn ? 'bn' : 'en'] || situation?.description?.en}
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
                    {isBn ? 'পরিস্থিতি নিয়ে স্বাভাবিকভাবে কথা বলুন' : 'Start speaking about this situation'}
                  </h3>
                  <p className="max-w-md text-xs sm:text-sm text-ink/70 leading-relaxed">
                    {isBn
                      ? 'ভুল হতে পারে ভেবে দ্বিধা করবেন না। ৫ মিনিট ধরে আপনার প্রতিটি কথা এখানে যুক্ত হতে থাকবে।'
                      : 'Speak freely for up to 5 minutes without fear of mistakes. Your speech will stream here continuously.'}
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
                  {Array.isArray(evaluation.matchedKeywords) && evaluation.matchedKeywords.length > 0 ? (
                    <p className="text-xs text-ink/80 pt-1">
                      {isBn ? 'ব্যবহৃত প্রাসঙ্গিক শব্দ:' : 'Relevant words used:'}{' '}
                      <strong>{evaluation.matchedKeywords.map((k) => `#${k}`).join(', ')}</strong>
                    </p>
                  ) : null}
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
    </Card>
  );
}
