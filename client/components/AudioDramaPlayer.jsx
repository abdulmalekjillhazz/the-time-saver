'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseStoryScript, playDrama } from '../lib/audioDrama.js';
import { fetchOnlineWordMeaning, normalizeWord } from './StoryReader.jsx';

function characterIcon(role) {
  if (role === 'male') return '👨';
  if (role === 'female') return '👩';
  if (role === 'child') return '🧒';
  return '🎙️';
}

export function spokenTextParts(text, fraction, completed, onWordClick, selectedTerm = '') {
  const parts = String(text || '').split(/(\s+)/);
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
    const clean = normalizeWord(part);
    const isSelected = Boolean(selectedTerm && clean && selectedTerm === clean);

    const baseClass = highlighted ? 'rounded bg-gold/40 px-0.5 text-ink' : undefined;
    if (!onWordClick) {
      return React.createElement('span', {
        key: index,
        className: baseClass,
      }, part);
    }

    return React.createElement(
      'span',
      {
        key: index,
        role: 'button',
        tabIndex: 0,
        onClick: () => onWordClick(part),
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onWordClick(part);
          }
        },
        className: [
          baseClass || 'rounded px-0.5',
          'cursor-pointer underline decoration-dotted decoration-gold/50 underline-offset-4 transition hover:bg-gold/30',
          isSelected ? 'bg-gold text-on-gold font-extrabold ring-2 ring-gold' : '',
        ].filter(Boolean).join(' '),
      },
      part
    );
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
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
    fullscreen: isBn ? '⛶ ফুলস্ক্রিন' : '⛶ Full screen',
    exitFullscreen: isBn ? '✕ সাধারণ ভিউ' : '✕ Exit full screen',
    tapWordHint: isBn ? '💡 যেকোনো শব্দে ক্লিক করলে সাথে সাথে অর্থ হাইলাইট হয়ে দেখাবে' : '💡 Click any word to highlight and see its meaning',
    searching: isBn ? 'অনলাইন থেকে অর্থ খোঁজা হচ্ছে...' : 'Fetching meaning online...',
  };

  const handleWordLookup = async (rawWord) => {
    const clean = normalizeWord(rawWord);
    if (!clean || clean.length < 2) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSelectedWord({
        term: clean,
        meaning: isBn ? '⚠️ অফলাইন: শব্দার্থ দেখতে ইন্টারনেট সংযোগ প্রয়োজন।' : '⚠️ Offline: Internet connection required.',
        isOffline: true,
      });
      return;
    }
    setSelectedWord({ term: clean, meaning: copy.searching, loading: true });
    const res = await fetchOnlineWordMeaning(clean, lang);
    if (res) setSelectedWord(res);
  };

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
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto bg-paper p-4 sm:p-8'
          : 'surface-card my-4 w-full p-4 sm:p-6'
      }
    >
      <div className={isFullscreen ? 'mx-auto max-w-5xl space-y-4' : 'space-y-4'}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/35 bg-paper/90 p-3.5">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold tracking-wide text-gold-soft">{copy.title}</h3>
            {title ? <p className="mt-0.5 text-base font-bold text-ink">{title}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="secondary-button min-h-[42px] px-3.5 py-1.5 text-xs font-bold"
            >
              {isFullscreen ? copy.exitFullscreen : copy.fullscreen}
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={copy.close}
                className="secondary-button min-h-[42px] px-3 py-1.5 text-xs font-bold"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>

        <div className="sticky top-2 z-30 space-y-2 rounded-2xl border border-gold/40 bg-paper/95 p-3.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={!lines.length}
                className="primary-button min-h-[44px] min-w-[130px] bg-sapphire px-4 py-2 text-sm font-extrabold text-on-sapphire disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPaused ? `▶ ${copy.resume}` : isPlaying ? `⏸ ${copy.pause}` : `▶ ${copy.play}`}
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={!isPlaying && !isPaused}
                className="secondary-button min-h-[44px] min-w-[110px] px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                ■ {copy.stop}
              </button>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold-soft">
                <span aria-hidden="true">{currentLine ? characterIcon(currentLine.role) : '🎙️'}</span>
                {currentCharacter}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sapphire/50 bg-sapphire/15 px-3 py-1 text-xs font-bold text-sapphire" role="status">
                <span aria-hidden="true">🌿</span>
                {isPlaying ? (isBn ? 'শুনুন ও রিলাক্স করুন' : 'Listen & relax') : (isBn ? 'শান্ত গল্প' : 'Calm story')}
              </span>
              <span className="text-xs font-bold tabular-nums opacity-85">
                {lines.length ? `${Math.min(Math.floor(position) + 1, lines.length)} / ${lines.length}` : '0 / 0'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <input
              aria-label={isBn ? 'পাঠে এগোন' : 'Seek lesson audio'}
              type="range"
              min="0"
              max={progressMax}
              step="0.01"
              value={Math.min(position, progressMax)}
              onChange={handleSeek}
              className="h-2 flex-1 cursor-pointer accent-sapphire"
            />
            <label className="flex min-w-36 items-center gap-2 text-xs opacity-85">
              <span>{copy.volume}</span>
              <input
                aria-label={copy.volume}
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="h-2 w-24 cursor-pointer accent-gold"
              />
            </label>
          </div>

          {selectedWord ? (
            <div className="flex items-center justify-between rounded-xl border-2 border-gold bg-gold/15 p-3 text-sm">
              <div className="min-w-0 flex-1 pr-2">
                <span className="mr-2 inline-block rounded bg-gold px-2 py-0.5 text-xs font-extrabold text-on-gold">
                  {selectedWord.term}
                </span>
                <span className="font-semibold text-ink">{selectedWord.meaning}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWord(null)}
                className="shrink-0 rounded-lg border border-gold/50 px-2.5 py-1 text-xs font-bold text-gold-soft"
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="text-xs font-semibold text-sapphire">{copy.tapWordHint}</p>
          )}
        </div>

        <div
          role="list"
          aria-label={copy.story}
          tabIndex={0}
          className="w-full space-y-3"
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
                className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-colors duration-200 ${
                  isCurrentLine
                    ? 'border-sapphire bg-sapphire/15 ring-2 ring-sapphire'
                    : isCompletedLine
                      ? 'border-gold/25 bg-sapphire-deep/20'
                      : 'border-gold/15 bg-paper/60 opacity-85'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${
                    isCurrentLine
                      ? 'bg-sapphire text-on-sapphire'
                      : 'bg-paper border border-gold/30'
                  }`}
                >
                  {characterIcon(line.role)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gold-soft">{line.character}</p>
                  <p className="mt-1 text-base leading-relaxed">
                    {spokenTextParts(line.text, fraction, isCompletedLine, handleWordLookup, selectedWord?.term)}
                  </p>
                </div>
              </div>
            );
          })}
          {!lines.length ? <p className="min-h-10 text-sm leading-relaxed opacity-80">{copy.loading}</p> : null}
        </div>

        {notice ? <p role="status" className="inline-flex items-center gap-2 rounded-full border border-sapphire/50 bg-sapphire/15 px-3 py-1 text-sm font-semibold text-sapphire">{notice}</p> : null}
        {error ? <p role="alert" className="text-sm font-medium text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
