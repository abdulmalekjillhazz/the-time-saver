'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { buildDetailedRoutineBriefing, speakWithVoice } from '../lib/voiceBriefing.js';
import { apiRequest } from '../lib/apiClient.js';
import { formatNaturalTime } from '../lib/prayerAnchors.js';

export function VoiceBriefingModal({ user, routines = [], lang = 'bn', onClose }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [aiBriefText, setAiBriefText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const controllerRef = useRef(null);
  const isBn = lang === 'bn';
  const userName = user?.displayName || (isBn ? 'বন্ধু' : 'friend');

  const baseBriefing = useMemo(
    () => buildDetailedRoutineBriefing({ name: userName, timeZone: user?.timezone, routines, lang }),
    [userName, user?.timezone, routines, lang]
  );

  const activeText = aiBriefText || baseBriefing.text;
  const speechLang = isBn ? 'bn-BD' : 'en-US';

  const copy = {
    title: isBn ? '🎧 আপনার ব্যক্তিগত ভয়েস ব্রিফিং' : '🎧 Your Personal Voice Briefing',
    play: isBn ? '▶ ব্রিফিং শুনুন' : '▶ Play Briefing',
    pause: isBn ? '⏸ বিরতি' : '⏸ Pause',
    resume: isBn ? '▶ আবার চালান' : '▶ Resume',
    stop: isBn ? '⏹ বন্ধ করুন' : '⏹ Stop Audio',
    close: isBn ? 'বন্ধ করুন' : 'Close',
    generateAi: isBn ? '✨ Gemini AI দিয়ে রুটিন ধরে ব্রিফ তৈরি করুন' : '✨ Personalize with Gemini AI',
    generatingAi: isBn ? '🔄 Gemini আপনার রুটিনগুলো সাজাচ্ছে...' : '🔄 Gemini is crafting your routine briefing...',
    aiSuccess: isBn ? '✅ সফল হয়েছে! Gemini আপনার সব রুটিনের নাম ধরে নতুন ব্রিফ তৈরি করেছে।' : '✅ Success! Gemini created a custom briefing with all your routine names.',
    aiFailed: isBn ? '⚠️ অফলাইন বা সার্ভার ব্যস্ত—আপনার সব রুটিনের নামসহ লোকাল ব্রিফিং দেখানো হচ্ছে।' : '⚠️ Using local routine-by-routine briefing.',
    localNotice: isBn
      ? 'এই ব্রিফিংয়ে আপনার নাম ও প্রতিটি রুটিনের নাম ধরে ডাকা হবে—বিনামূল্যের ভয়েসে শোনা যাবে।'
      : 'This briefing calls out your name and each of your routines one by one.',
    hint: isBn
      ? `${baseBriefing.greeting}, ${baseBriefing.name}! আপনার আজকের ব্যক্তিগত রুটিন ব্রিফিং`
      : `${baseBriefing.greeting}, ${baseBriefing.name}! Listen to your personalized routine briefing`,
    sparkle: isBn ? '✨ আজকের রুটিন ব্রিফিং (প্রতিটি রুটিনসহ)' : '✨ Today’s Routine-by-Routine Briefing',
    routineListTitle: isBn ? '📋 আপনার আজকের রুটিনসমূহ (ট্যাপ করে শুনুন):' : '📋 Your Routines Today (Tap to hear):',
    speechUnavailable: isBn
      ? '❌ এই browser-এ ভয়েস চালানো যায়নি। নিচের লেখাটি পড়তে পারবেন।'
      : '❌ A voice is not available in this browser. You can still read the briefing.',
  };

  const fetchGeminiBriefing = useCallback(async () => {
    if (!user) return;
    setAiLoading(true);
    setStatusMsg(null);
    try {
      const payloadRoutines = routines.map((r) => ({
        title: r.title,
        startTime: r.startTime,
        endTime: r.endTime,
        completionStatus: r.completionStatus,
        isFrog: Boolean(r.isFrog),
        anchorHabit: r.anchorHabit || '',
      }));
      const res = await apiRequest('/api/assistant/briefing', {
        method: 'POST',
        body: {
          userName,
          lang,
          routines: payloadRoutines,
        },
      });
      if (res?.briefingText) {
        setAiBriefText(res.briefingText);
        setStatusMsg({ type: 'success', text: copy.aiSuccess });
      }
    } catch {
      setStatusMsg({ type: 'info', text: copy.aiFailed });
    } finally {
      setAiLoading(false);
    }
  }, [user, routines, userName, lang, copy.aiSuccess, copy.aiFailed]);

  useEffect(() => {
    if (user && routines.length > 0) {
      void fetchGeminiBriefing();
    }
  }, []);

  const startSpeech = (textToSpeak = activeText) => {
    controllerRef.current?.close();
    setSpeechError('');
    setSpeaking(true);
    setPaused(false);
    try {
      controllerRef.current = speakWithVoice(textToSpeak, {
        lang: speechLang,
        onEnd: () => {
          setSpeaking(false);
          setPaused(false);
        },
        onError: () => {
          setSpeaking(false);
          setPaused(false);
          setSpeechError(copy.speechUnavailable);
        },
      });
    } catch {
      setSpeaking(false);
      setPaused(false);
      setSpeechError(copy.speechUnavailable);
    }
  };

  useEffect(() => () => {
    controllerRef.current?.close();
    controllerRef.current = null;
  }, []);

  const handleSpeech = () => {
    if (!speaking) {
      startSpeech(activeText);
    } else if (paused) {
      controllerRef.current?.resume();
      setPaused(false);
    } else {
      controllerRef.current?.pause();
      setPaused(true);
    }
  };

  const handleStop = () => {
    controllerRef.current?.stop();
    setSpeaking(false);
    setPaused(false);
  };

  const handleClose = () => {
    handleStop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <Card className="surface-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b border-gold/25 pb-3">
          <h3 className="section-heading text-lg">{copy.title}</h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label={copy.close}
            className="secondary-button min-h-[38px] min-w-[38px] px-2.5 py-1 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <div className="my-4 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sapphire/15 text-2xl">
              {speaking ? <span className="animate-pulse" aria-label={isBn ? 'অডিও চলছে' : 'Audio playing'}>🔊</span> : '🎧'}
            </div>
            <div>
              <p className="text-sm font-extrabold text-gold-soft">{copy.hint}</p>
              <p className="mt-0.5 text-xs opacity-80">{copy.localNotice}</p>
            </div>
          </div>

          {statusMsg ? (
            <div
              role="status"
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
                statusMsg.type === 'success'
                  ? 'border-sapphire bg-sapphire/15 text-sapphire'
                  : 'border-gold/50 bg-gold/15 text-gold-soft'
              }`}
            >
              {statusMsg.text}
            </div>
          ) : null}

          <div className="routine-tile p-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold text-sapphire">{copy.sparkle}</p>
              <button
                type="button"
                disabled={aiLoading}
                onClick={fetchGeminiBriefing}
                className="secondary-button min-h-[36px] px-3 py-1 text-xs font-bold disabled:opacity-50"
              >
                {aiLoading ? copy.generatingAi : copy.generateAi}
              </button>
            </div>
            <p lang={isBn ? 'bn' : 'en'} className="text-sm leading-relaxed text-ink font-medium">
              {activeText}
            </p>
          </div>

          {routines.length > 0 ? (
            <div className="rounded-xl border border-gold/25 bg-paper/70 p-3.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-gold-soft mb-2">
                {copy.routineListTitle}
              </p>
              <ul className="space-y-1.5 text-xs sm:text-sm">
                {routines.map((r) => (
                  <li
                    key={r.id}
                    onClick={() => startSpeech(
                      isBn
                        ? `${userName}, আপনার রুটিন ${r.title}, শুরুর সময় ${formatNaturalTime(r.startTime, 'bn')}।`
                        : `${userName}, your routine is ${r.title}, starting at ${formatNaturalTime(r.startTime, 'en')}.`
                    )}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-sapphire/20 bg-paper px-3 py-2 transition hover:border-gold"
                  >
                    <span className="font-bold text-ink">
                      {r.completionStatus === 'done' ? '✅ ' : r.isFrog ? '⭐ ' : '🔊 '}
                      {r.title}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-gold-soft">
                      {formatNaturalTime(r.startTime, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {speechError ? (
            <p role="alert" className="rounded-xl border border-rose-400 bg-rose-500/10 p-3 text-xs font-bold text-rose-300">
              {speechError}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gold/20 pt-4 sm:grid-cols-3">
          <Button onClick={handleSpeech} className="min-h-[44px] w-full justify-center text-sm font-bold">
            {speaking ? (paused ? copy.resume : copy.pause) : copy.play}
          </Button>
          {speaking ? (
            <Button variant="secondary" onClick={handleStop} className="min-h-[44px] w-full justify-center text-sm font-bold">
              {copy.stop}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={handleClose} className="min-h-[44px] w-full justify-center text-sm font-bold">
            {copy.close}
          </Button>
        </div>
      </Card>
    </div>
  );
}
