'use client';

import { useEffect, useRef, useState } from 'react';
import {
  evaluateContextSpeech,
  extractContextKeywords,
} from '../lib/contextSpeakingEvaluator.js';
import { isAndroidNativeApp, recognizeEnglishSpeech, stopEnglishSpeechRecognition } from '../lib/nativeSpeech.js';
import { Card } from './ui/Card.jsx';

const MAX_DURATION_SECONDS = 300; // 5 minutes

export function ContextSpeakingPractice({
  situation,
  lang = 'bn',
  onFinish,
}) {
  const isBn = lang === 'bn';
  const [isRecording, setIsRecording] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(MAX_DURATION_SECONDS);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [errorNotice, setErrorNotice] = useState('');
  const [manualInputOpen, setManualInputOpen] = useState(false);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  const transcriptRef = useRef('');

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
    const result = evaluateContextSpeech({
      transcript: finalTranscript,
      situation,
      durationSeconds: duration,
    });
    setEvaluation(result);
    if (typeof onFinish === 'function') {
      onFinish(result);
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
    startTimeRef.current = Date.now();

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

    setIsRecording(true);

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
          setErrorNotice(isBn ? 'মাইক্রোফোনে কোনো সমস্যা হয়েছে।' : `Microphone error: ${e.error}`);
        }
      };

      recognition.onend = () => {
        // If still flagged as recording and not manually finished, restart to keep 5 min listening
        if (elapsedSecondsRef.current < MAX_DURATION_SECONDS && timerRef.current) {
          try {
            recognition.start();
          } catch {
            // Already started or terminated
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
    transcriptRef.current = '';
    elapsedSecondsRef.current = 0;
  };

  useEffect(() => () => {
    stopTimer();
    void stopActiveSpeech();
  }, []);

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
                ⏱️ {isBn ? '৫ মিনিট মুক্ত কথন' : '5-Min Free Speech'}
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
            🎯 {isBn ? '১০০ নম্বরে মূল্যায়ন' : 'Score out of 100'}
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
            ? 'এই পরিস্থিতিতে আপনি স্বাভাবিকভাবে কথা বলুন। আপনার পছন্দ, প্রশ্ন, প্রয়োজনীয়তা প্রকাশ করুন। যেকোনো সময় আপনি কথা শেষ করতে পারেন।'
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

      {/* Live Timer & Speaking Area */}
      <div className="space-y-4 rounded-2xl border-2 border-sapphire/25 bg-paper/85 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`grid size-12 place-items-center rounded-2xl font-mono text-lg font-black shadow-inner transition ${
              isRecording ? 'border-2 border-rose-500 bg-rose-500/15 text-rose-600 animate-pulse' : 'border border-gold/35 bg-gold/15 text-ink'
            }`}>
              {formatTime(secondsRemaining)}
            </div>
            <div>
              <p className="text-xs font-extrabold text-ink/65 uppercase tracking-wide">
                {isRecording
                  ? (isBn ? '🔴 কথা বলা রেকর্ড হচ্ছে…' : '🔴 Recording in progress…')
                  : (isBn ? 'বাকি সময় (সর্বোচ্চ ৫:০০ মিনিট)' : 'Time left (max 5:00 mins)')}
              </p>
              <p className="text-xs text-ink/75">
                {isBn
                  ? '৫ মিনিট পর্যন্ত বলতে পারেন, চাইলে আগেই "শেষ করুন" চাপুন।'
                  : 'Speak for up to 5 minutes, or tap "Finish" early anytime.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={handleStartSpeaking}
                className="primary-button inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-sapphire-deep via-sapphire to-sapphire px-5 py-2.5 text-sm font-extrabold text-white shadow-md hover:opacity-95"
              >
                <span>🎙️</span>
                <span>{isBn ? 'কথা বলা শুরু করুন' : 'Start Speaking'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishSpeaking}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-rose-500 bg-rose-600 px-5 py-2.5 text-sm font-black text-white shadow-lg hover:bg-rose-700 animate-pulse"
              >
                <span>⏹️</span>
                <span>{isBn ? 'কথা শেষ ও স্কোর দেখুন' : 'Finish & Get Score'}</span>
              </button>
            )}

            {evaluation || transcript ? (
              <button
                type="button"
                onClick={handleReset}
                className="secondary-button inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-sapphire/25 px-3.5 py-2 text-xs font-bold text-ink hover:bg-paper"
              >
                <span>🔄</span>
                <span>{isBn ? 'নতুন করে শুরু' : 'Reset'}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* 5-Min Timer Progress Bar */}
        <div className="duo-progress-track h-2 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              isRecording ? 'bg-gradient-to-r from-rose-500 to-gold' : 'bg-sapphire'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Live / Recorded Transcript Bubble */}
        <div className="min-h-24 rounded-2xl border-2 border-dashed border-sapphire/25 bg-paper/60 p-4">
          <span className="block text-[11px] font-extrabold uppercase tracking-wider text-ink/60 mb-1">
            📝 {isBn ? 'আপনার বলা কথা (Transcript):' : 'Spoken Transcript:'}
          </span>
          {transcript || interimText ? (
            <p className="text-sm font-semibold leading-relaxed text-ink" lang="en">
              {transcript}{' '}
              {interimText ? <span className="text-sapphire italic">{interimText}</span> : null}
            </p>
          ) : (
            <p className="text-xs text-ink/50 italic">
              {isRecording
                ? (isBn ? 'কথা বলুন, আপনার কথা এখানে সাথে সাথে দেখা যাবে…' : 'Start speaking, your words will appear here in real time…')
                : (isBn ? 'মাইক্রোফোন চালু করতে "কথা বলা শুরু করুন" চাপুন।' : 'Tap "Start Speaking" to begin.')}
            </p>
          )}
        </div>

        {errorNotice ? (
          <p role="alert" className="rounded-xl border border-rose-400 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-700">
            ⚠️ {errorNotice}
          </p>
        ) : null}

        {/* Fallback Manual Text Input */}
        {manualInputOpen ? (
          <div className="space-y-2 pt-2">
            <textarea
              rows={3}
              className="w-full rounded-xl border border-sapphire/30 bg-paper p-3 text-sm text-ink focus:border-sapphire focus:outline-none"
              placeholder={isBn ? 'এখানে ইংরেজিতে লিখুন...' : 'Type in English here...'}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                transcriptRef.current = e.target.value;
              }}
            />
            <button
              type="button"
              onClick={handleFinishSpeaking}
              className="rounded-xl bg-sapphire px-4 py-2 text-xs font-black text-on-sapphire"
            >
              {isBn ? 'লিখে যাচাই করুন' : 'Evaluate Typed Text'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Result & Evaluation Card (Out of 100) */}
      {evaluation && evaluation.score > 0 ? (
        <article className="space-y-4 rounded-2xl border-2 border-gold/40 bg-gradient-to-br from-gold/15 via-paper to-sapphire/10 p-4 sm:p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/25 pb-3">
            <div className="flex items-center gap-3">
              <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-gold/30 to-sapphire/20 text-3xl shadow-sm">
                🏆
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gold-soft">
                  {isBn ? 'কথনের সার্বিক মূল্যায়ন' : 'Overall Evaluation'}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-ink">{evaluation.score}</span>
                  <span className="text-sm font-extrabold text-ink/65">/ ১০০</span>
                  <span className="ml-2 rounded-full border border-gold/50 bg-gold/20 px-2.5 py-0.5 text-xs font-black text-ink">
                    {evaluation.score >= 80 ? '🌟 চমৎকার!' : evaluation.score >= 60 ? '👍 খুব ভালো!' : '💪 চালিয়ে যান!'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-ink/75">
              <p>⏱️ {isBn ? 'সময়:' : 'Duration:'} <strong>{Math.floor(evaluation.durationSeconds / 60)}মিনিট {evaluation.durationSeconds % 60}সেকেন্ড</strong></p>
              <p>💬 {isBn ? 'মোট শব্দ:' : 'Total words:'} <strong>{evaluation.wordCount}</strong> ({evaluation.wpm} WPM)</p>
            </div>
          </div>

          {/* 3 Metric Progress Cards */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-sapphire/20 bg-paper/85 p-3 text-center">
              <p className="text-[11px] font-bold text-ink/70">🎯 {isBn ? 'প্রসঙ্গের মিল' : 'Relevance'}</p>
              <p className="mt-1 text-lg font-black text-ink">{evaluation.relevanceScore} <span className="text-xs text-ink/50">/ ৪০</span></p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
                <div className="h-full rounded-full bg-sapphire" style={{ width: `${(evaluation.relevanceScore / 40) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-xl border border-sapphire/20 bg-paper/85 p-3 text-center">
              <p className="text-[11px] font-bold text-ink/70">🗣️ {isBn ? 'সাবলীলতা ও দৈর্ঘ্য' : 'Fluency & Pace'}</p>
              <p className="mt-1 text-lg font-black text-ink">{evaluation.fluencyScore} <span className="text-xs text-ink/50">/ ৩৫</span></p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(evaluation.fluencyScore / 35) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-xl border border-sapphire/20 bg-paper/85 p-3 text-center">
              <p className="text-[11px] font-bold text-ink/70">📚 {isBn ? 'শব্দভাণ্ডার ও গঠন' : 'Vocabulary'}</p>
              <p className="mt-1 text-lg font-black text-ink">{evaluation.vocabularyScore} <span className="text-xs text-ink/50">/ ২৫</span></p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(evaluation.vocabularyScore / 25) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Feedback & Improvement Tips */}
          <div className="rounded-xl border border-gold/30 bg-gold/10 p-3.5 space-y-1">
            <p className="text-xs font-black text-gold-soft">💡 {isBn ? 'পরামর্শ ও ফিডব্যাক:' : 'Feedback & Advice:'}</p>
            <p className="text-sm font-bold text-ink">{evaluation.feedback[isBn ? 'bn' : 'en']}</p>
            {evaluation.matchedKeywords.length > 0 ? (
              <p className="text-xs text-ink/80 pt-1">
                {isBn ? 'ব্যবহৃত প্রাসঙ্গিক শব্দ:' : 'Relevant words used:'}{' '}
                <strong>{evaluation.matchedKeywords.map((k) => `#${k}`).join(', ')}</strong>
              </p>
            ) : null}
          </div>
        </article>
      ) : null}
    </Card>
  );
}

