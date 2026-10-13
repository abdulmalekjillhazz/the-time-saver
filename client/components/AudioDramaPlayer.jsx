'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseStoryScript, playDrama } from '../lib/audioDrama.js';

function characterIcon(role) {
  if (role === 'male') return '👨';
  if (role === 'female') return '👩';
  if (role === 'child') return '🧒';
  return '🎙️';
}

export function spokenTextParts(text, fraction, completed) {
  const parts = text.split(/(\s+)/);
  const wordCount = parts.filter((part) => /\S/.test(part)).length;
  const revealedWords = completed
    ? wordCount
    : fraction > 0
      ? Math.min(wordCount, Math.max(1, Math.ceil(fraction * wordCount)))
      : 0;
  let wordIndex = 0;

  return parts.map((part, index) => {
    if (!/\S/.test(part)) return part;
    wordIndex += 1;
    const highlighted = wordIndex <= revealedWords;
    return React.createElement('span', {
      key: index,
      className: highlighted ? 'rounded bg-gold/40 px-0.5 text-ink' : undefined,
    }, part);
  });
}

export function AudioDramaPlayer({ title = '', content = '', lang = 'bn', onClose }) {
  const isBn = lang === 'bn';
  const lines = useMemo(() => parseStoryScript(content, isBn ? 'বর্ণনাকারী' : 'Narrator'), [content, isBn]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(85);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controllerRef = useRef(null);
  const lineRefs = useRef([]);
  const isPlayingRef = useRef(false);
  const positionRef = useRef(0);
  const pausedRef = useRef(false);
  const volumeRef = useRef(volume);
  const playbackSettingsRef = useRef({ lines, lang });

  const copy = {
    title: isBn ? 'গল্পের মাধ্যমে ইংরেজি শিখুন' : 'Learn English by Story',
    play: isBn ? 'চালান' : 'Play',
    pause: isBn ? 'বিরতি' : 'Pause',
    resume: isBn ? 'আবার চালান' : 'Resume',
    stop: isBn ? 'বন্ধ' : 'Stop',
    close: isBn ? 'বন্ধ করুন' : 'Close player',
    story: isBn ? 'গল্পের সংলাপ' : 'Story dialogue',
    volume: isBn ? 'ভলিউম' : 'Volume',
    loading: isBn ? 'পাঠ প্রস্তুত হচ্ছে…' : 'Preparing lesson audio…',
    narrator: isBn ? 'বর্ণনাকারী' : 'Narrator',
    relaxing: isBn ? '🌿 আরাম করে শুনুন — গল্প চলছে' : '🌿 Sit back and relax — story playing',
    ready: isBn ? '🌿 গল্প প্রস্তুত — শুনতে চাপ দিন' : '🌿 Story ready — press play to listen',
    friendlyError: isBn ? 'অডিও এখন চালানো যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।' : 'Audio cannot play right now. Check your connection and try again.',
  };

  // Keep users relaxed: never show technical backend details, only a calm green sign.
  const showCalmNotice = () => {
    setNotice(copy.relaxing);
  };
  const showFriendlyError = (message) => {
    console.error('Story audio playback failed', message);
    setError(copy.friendlyError);
  };

  const startPlayback = (startAt = 0) => {
    controllerRef.current?.close();
    setError('');
    setNotice('');
    setSource('');
    isPlayingRef.current = true;
    pausedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);

    controllerRef.current = playDrama(
      lines,
      (progress) => {
        positionRef.current = progress.index + progress.fraction;
        setPosition(positionRef.current);
        setSource(progress.source || '');
      },
      () => {
        isPlayingRef.current = false;
        pausedRef.current = false;
        positionRef.current = 0;
        setPosition(0);
        setIsPlaying(false);
        setIsPaused(false);
      },
      {
        lang,
        volume: volumeRef.current / 100,
        spatial: false,
        onError: (message) => {
          isPlayingRef.current = false;
          pausedRef.current = false;
          setIsPlaying(false);
          setIsPaused(false);
          showFriendlyError(message);
        },
        onNotice: () => showCalmNotice(),
      },
    );
    controllerRef.current.play(startAt);
  };

  useEffect(() => {
    const changed = playbackSettingsRef.current.lines !== lines || playbackSettingsRef.current.lang !== lang;
    playbackSettingsRef.current = { lines, lang };
    if (!changed) return;
    const restartAt = isPlayingRef.current ? positionRef.current : null;
    controllerRef.current?.close();
    controllerRef.current = null;
    if (restartAt !== null) startPlayback(Math.floor(restartAt));
  }, [lines, lang]);

  useEffect(() => {
    volumeRef.current = volume;
    controllerRef.current?.setVolume(volume / 100);
  }, [volume]);

  useEffect(() => () => {
    isPlayingRef.current = false;
    controllerRef.current?.close();
    controllerRef.current = null;
  }, []);

  const handlePlayPause = () => {
    if (!controllerRef.current || (!isPlaying && !isPaused)) {
      startPlayback(Math.floor(position));
      return;
    }
    if (isPaused) {
      controllerRef.current.resume();
      pausedRef.current = false;
      setIsPaused(false);
    } else {
      controllerRef.current.pause();
      pausedRef.current = true;
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    controllerRef.current?.stop();
    isPlayingRef.current = false;
    pausedRef.current = false;
    positionRef.current = 0;
    setPosition(0);
    setIsPlaying(false);
    setIsPaused(false);
    setSource('');
  };

  const handleSeek = (event) => {
    const target = Number(event.target.value);
    positionRef.current = target;
    setPosition(target);
    controllerRef.current?.seek(target);
  };

  const currentLine = lines[Math.min(Math.floor(position), lines.length - 1)];
  const currentLineIndex = Math.min(Math.floor(position), Math.max(lines.length - 1, 0));
  const currentLineFraction = Math.min(1, Math.max(0, position - currentLineIndex));
  const currentCharacter = currentLine?.character || copy.narrator;
  const progressMax = Math.max(0, lines.length - 0.01);

  useEffect(() => {
    if (!isPlaying) return;
    lineRefs.current[currentLineIndex]?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [currentLineIndex, isPlaying]);

  return (
    <section
      aria-label={copy.title}
      className="surface-card my-5 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold tracking-wide text-gold-soft">{copy.title}</h3>
          {title ? <p className="mt-1 truncate text-sm opacity-70">{title}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {onClose ? (
            <button type="button" onClick={onClose} aria-label={copy.close} className="rounded-full px-2 py-1 opacity-70 hover:bg-sapphire/10 hover:text-ink">
              ✕
            </button>
          ) : null}
        </div>
      </div>

      <div className="routine-tile mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex max-w-[70%] items-center gap-2 truncate rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-soft">
            <span aria-hidden="true">{currentLine ? characterIcon(currentLine.role) : '🎙️'}</span>
            {currentCharacter}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sapphire/50 bg-sapphire/15 px-3 py-1 text-xs font-bold text-sapphire" role="status">
            <span aria-hidden="true">🌿</span>
            {isPlaying ? (isBn ? 'শুনুন ও রিলাক্স করুন' : 'Listen & relax') : (isBn ? 'শান্ত গল্প' : 'Calm story')}
          </span>
          <span className="text-xs tabular-nums opacity-75">
            {lines.length ? `${Math.min(Math.floor(position) + 1, lines.length)} / ${lines.length}` : '0 / 0'}
          </span>
        </div>
        <div
          role="list"
          aria-label={copy.story}
          tabIndex={0}
          className="mt-3 max-h-72 space-y-2 overflow-y-auto scroll-smooth pr-1"
        >
          {lines.map((line, lineIndex) => {
            const isCurrentLine = lineIndex === currentLineIndex;
            const isCompletedLine = lineIndex < currentLineIndex;
            const fraction = isCurrentLine ? currentLineFraction : 0;
            return (
              <div
                key={`${lineIndex}-${line.character}`}
                ref={(element) => { lineRefs.current[lineIndex] = element; }}
                role="listitem"
                aria-current={isCurrentLine ? 'step' : undefined}
                aria-label={`${line.character}: ${line.text}`}
                className={`flex items-start gap-2 rounded-xl p-2 transition-colors duration-300 ${
                  isCurrentLine
                    ? 'bg-sapphire/15 ring-2 ring-sapphire'
                    : isCompletedLine
                      ? 'bg-sapphire-deep/20'
                      : 'opacity-60'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg ${
                    isCurrentLine
                      ? 'bg-sapphire text-on-sapphire'
                      : 'bg-paper border border-gold/30'
                  }`}
                >
                  {characterIcon(line.role)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gold-soft">{line.character}</p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {spokenTextParts(line.text, fraction, isCompletedLine)}
                  </p>
                </div>
              </div>
            );
          })}
          {!lines.length ? <p className="min-h-10 text-sm leading-relaxed opacity-80">{copy.loading}</p> : null}
        </div>
        <input
          aria-label={isBn ? 'পাঠে এগোন' : 'Seek lesson audio'}
          type="range"
          min="0"
          max={progressMax}
          step="0.01"
          value={Math.min(position, progressMax)}
          onChange={handleSeek}
          className="mt-3 h-2 w-full cursor-pointer accent-sapphire"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={!lines.length}
          className="primary-button bg-sapphire px-4 py-2 text-sm font-extrabold text-on-sapphire disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPaused ? `▶ ${copy.resume}` : isPlaying ? `⏸ ${copy.pause}` : `▶ ${copy.play}`}
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={!isPlaying && !isPaused}
          className="secondary-button px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          ■ {copy.stop}
        </button>
        <label className="ml-auto flex min-w-40 flex-1 items-center gap-2 text-xs opacity-80">
          <span>{copy.volume}</span>
          <input
            aria-label={copy.volume}
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="h-2 min-w-20 flex-1 cursor-pointer accent-gold"
          />
        </label>
      </div>

      {notice ? <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-full border border-sapphire/50 bg-sapphire/15 px-3 py-1 text-sm font-semibold text-sapphire">{notice}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-red-400">{error}</p> : null}
    </section>
  );
}
