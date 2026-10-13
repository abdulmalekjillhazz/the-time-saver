'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { buildVoiceBriefing, speakWithVoice } from '../lib/voiceBriefing.js';

export function VoiceBriefingModal({ user, routines = [], lang = 'bn', onClose }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const controllerRef = useRef(null);
  const isBn = lang === 'bn';
  const userName = user?.displayName || 'friend';
  const briefing = buildVoiceBriefing({ name: userName, timeZone: user?.timezone, routines, lang });
  const speechLang = isBn ? 'bn-BD' : 'en-US';

  const copy = {
    title: isBn ? '🎧 আপনার ভয়েস ব্রিফিং' : '🎧 Your Voice Briefing',
    play: isBn ? '▶ ব্রিফিং শুনুন' : '▶ Play Briefing',
    pause: isBn ? '⏸ বিরতি' : '⏸ Pause',
    resume: isBn ? '▶ আবার চালান' : '▶ Resume',
    stop: isBn ? '⏹ বন্ধ করুন' : '⏹ Stop Audio',
    close: isBn ? 'বন্ধ করুন' : 'Close',
    localNotice: isBn
      ? 'এই ব্রিফিং Google ভয়েসে (থাকলে) পড়া হয়, নইলে browser-এর বিনামূল্যের ভয়েসে—ElevenLabs credit খরচ হবে না।'
      : 'This briefing is read by the Google voice when available, otherwise the browser’s free voice. It does not use ElevenLabs credits.',
    hint: isBn
      ? `${briefing.greeting}, ${briefing.name}! আপনার আজকের বাংলা ব্রিফিং শুনুন`
      : `${briefing.greeting}, ${briefing.name}! Listen to your daily focus briefing`,
    sparkle: isBn ? '✨ আজকের ছোট পদক্ষেপ' : '✨ Your small step for today',
    speechUnavailable: isBn
      ? 'এই browser-এ ভয়েস চালানো যায়নি। লেখাটি পড়তে পারবেন।'
      : 'A voice is not available in this browser. You can still read the briefing.',
  };

  const startSpeech = () => {
    controllerRef.current?.close();
    setSpeechError('');
    setSpeaking(true);
    setPaused(false);
    try {
      controllerRef.current = speakWithVoice(briefing.text, {
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
      startSpeech();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <Card className="surface-card w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gold/20 pb-3">
          <h3 className="section-heading text-lg">{copy.title}</h3>
          <button type="button" onClick={handleClose} aria-label={copy.close} className="rounded p-1 text-ink/60 hover:text-ink">✕</button>
        </div>

        <div className="my-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sapphire/10 text-4xl shadow-inner">
            {speaking ? <span className="animate-pulse" aria-label={isBn ? 'অডিও চলছে' : 'Audio playing'}>✨🔊✨</span> : '🎧'}
          </div>
          <p className="mt-3 text-sm font-semibold text-sapphire">{copy.hint}</p>
          <div className="routine-tile mt-4 p-4 text-left">
            <p className="mb-1 text-xs font-bold text-sapphire">{copy.sparkle}</p>
            <p lang={isBn ? 'bn' : 'en'} className="text-sm leading-relaxed text-ink/90">{briefing.text}</p>
          </div>
          <p className="mt-2 text-xs text-ink/70">{copy.localNotice}</p>
          {speechError ? <p role="alert" className="mt-3 text-sm text-red-700">{speechError}</p> : null}
        </div>

        <div className="flex items-center justify-center gap-3 border-t pt-4">
          <Button onClick={handleSpeech} className="px-6 py-2.5">
            {speaking ? (paused ? copy.resume : copy.pause) : copy.play}
          </Button>
          {speaking ? <Button variant="secondary" onClick={handleStop}>{copy.stop}</Button> : null}
          <Button variant="secondary" onClick={handleClose}>{copy.close}</Button>
        </div>
      </Card>
    </div>
  );
}
