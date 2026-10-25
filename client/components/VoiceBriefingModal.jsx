'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { buildDetailedRoutineBriefing, speakWithGoogleTts } from '../lib/voiceBriefing.js';
import { formatNaturalTime } from '../lib/prayerAnchors.js';

export function VoiceBriefingModal({ user, routines = [], lang = 'bn', autoPlay = false, onClose }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const controllerRef = useRef(null);
  const autoPlayStartedRef = useRef(false);
  const isBn = lang === 'bn';
  const userName = user?.displayName || (isBn ? 'বন্ধু' : 'friend');

  const baseBriefing = useMemo(
    () => buildDetailedRoutineBriefing({ name: userName, timeZone: user?.timezone, routines, lang }),
    [userName, user?.timezone, routines, lang]
  );

  const activeText = baseBriefing.text;
  const copy = {
    title: isBn ? '🎧 আপনার ব্যক্তিগত ভয়েস ব্রিফিং' : '🎧 Your Personal Voice Briefing',
    play: isBn ? '▶ ব্রিফিং শুনুন' : '▶ Play Briefing',
    pause: isBn ? '⏸ বিরতি' : '⏸ Pause',
    resume: isBn ? '▶ আবার চালান' : '▶ Resume',
    stop: isBn ? '⏹ বন্ধ করুন' : '⏹ Stop Audio',
    close: isBn ? 'বন্ধ করুন' : 'Close',
    providerNotice: isBn
      ? 'ফ্রি Google Translate voice ব্যবহার হবে। নাম ও রুটিনের লেখা Google-এ যায়; এই সেবা সীমিত বা পরিবর্তিত হতে পারে।'
      : 'Uses free Google Translate speech. Your name and routine text is sent to Google; this service may be limited or change.',
    hint: isBn
      ? `${baseBriefing.greeting}, ${baseBriefing.name}! আপনার আজকের ব্যক্তিগত রুটিন ব্রিফিং`
      : `${baseBriefing.greeting}, ${baseBriefing.name}! Listen to your personalized routine briefing`,
    sparkle: isBn ? '📋 আজকের রুটিন ব্রিফিং (প্রতিটি রুটিনসহ)' : '📋 Today’s Routine-by-Routine Briefing',
    routineListTitle: isBn ? '📋 আপনার আজকের রুটিনসমূহ (ট্যাপ করে শুনুন):' : '📋 Your Routines Today (Tap to hear):',
    speechUnavailable: isBn
      ? '❌ Google voice চালানো যায়নি। নেটওয়ার্ক যাচাই করে আবার চেষ্টা করুন।'
      : '❌ Google voice could not play. Check the network and try again.',
  };

  const startSpeech = useCallback((textToSpeak = activeText) => {
    controllerRef.current?.close();
    setSpeechError('');
    setSpeaking(true);
    setPaused(false);
    try {
      controllerRef.current = speakWithGoogleTts(textToSpeak, {
        lang: isBn ? 'bn' : 'en',
        locale: lang,
        onEnd: () => {
          setSpeaking(false);
          setPaused(false);
        },
        onError: (speechRequestError) => {
          setSpeaking(false);
          setPaused(false);
          setSpeechError(speechRequestError.message || copy.speechUnavailable);
        },
      });
    } catch (requestError) {
      setSpeaking(false);
      setPaused(false);
      setSpeechError(requestError?.message || copy.speechUnavailable);
    }
  }, [activeText, copy.speechUnavailable, isBn, lang]);

  useEffect(() => {
    if (!autoPlay || autoPlayStartedRef.current) return;
    autoPlayStartedRef.current = true;
    startSpeech();
  }, [autoPlay, startSpeech]);

  useEffect(() => {
    return () => {
      controllerRef.current?.close();
    };
  }, []);

  const handleSpeech = () => {
    if (!speaking) {
      startSpeech(activeText);
      return;
    }
    if (paused) {
      controllerRef.current?.resume();
      setPaused(false);
      return;
    }
    controllerRef.current?.pause();
    setPaused(true);
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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-briefing-title"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <Card className="surface-card modal-pop max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b border-gold/25 pb-3">
          <h2 id="voice-briefing-title" className="section-heading text-lg">{copy.title}</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label={copy.close}
            className="secondary-button inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
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
              <p className="mt-0.5 text-xs opacity-80">{copy.providerNotice}</p>
            </div>
          </div>

          <div className="routine-tile p-4 text-left">
            <p className="mb-2 text-xs font-bold text-sapphire">{copy.sparkle}</p>
            <p lang={isBn ? 'bn' : 'en'} className="text-sm font-medium leading-relaxed text-ink">
              {activeText}
            </p>
          </div>

          {routines.length > 0 ? (
            <div className="rounded-xl border border-gold/25 bg-paper/70 p-3.5">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-gold-soft">
                {copy.routineListTitle}
              </p>
              <ul className="space-y-1.5 text-xs sm:text-sm">
                {routines.map((r) => (
                  <li
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => startSpeech(
                      isBn
                        ? `${userName}, আপনার রুটিন ${r.title}, শুরুর সময় ${formatNaturalTime(r.startTime, 'bn')}।`
                        : `${userName}, your routine is ${r.title}, starting at ${formatNaturalTime(r.startTime, 'en')}.`
                    )}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        startSpeech(
                          isBn
                            ? `${userName}, আপনার রুটিন ${r.title}, শুরুর সময় ${formatNaturalTime(r.startTime, 'bn')}।`
                            : `${userName}, your routine is ${r.title}, starting at ${formatNaturalTime(r.startTime, 'en')}.`
                        );
                      }
                    }}
                    className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-lg border border-sapphire/20 bg-paper px-3 py-2 transition hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
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
