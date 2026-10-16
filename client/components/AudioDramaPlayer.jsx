'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseStoryScript, playDrama } from '../lib/audioDrama.js';
import { lookupStoryWordMeaning, normalizeWord } from './StoryReader.jsx';

function characterIcon(role) {
  if (role === 'male') return '👨';
  if (role === 'female') return '👩';
  if (role === 'child') return '🧒';
  return '🎙️';
}

export function spokenTextParts(text, fraction, completed, onWordClick, selectedWordState = null, lineIndex = 0) {
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
    const keyId = `${lineIndex}-${index}`;
    const selectedTerm = typeof selectedWordState === 'string'
      ? selectedWordState
      : selectedWordState?.term || '';
    const isSelected = Boolean(
      clean && (
        (selectedWordState?.keyId && selectedWordState.keyId === keyId) ||
        (!selectedWordState?.keyId && selectedTerm && selectedTerm === clean)
      )
    );

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
        className: 'relative inline-block',
      },
      isSelected && selectedWordState?.meaning
        ? React.createElement(
            'span',
            {
              role: 'status',
              className:
                'absolute bottom-full left-1/2 z-50 mb-2 min-w-[170px] max-w-[260px] -translate-x-1/2 rounded-xl border-2 border-gold bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-2xl',
            },
            React.createElement(
              'span',
              { className: 'flex items-start justify-between gap-2' },
              React.createElement(
                'span',
                { className: 'min-w-0 flex-1' },
                React.createElement('strong', { className: 'block text-gold-soft' }, selectedWordState.term),
                React.createElement('span', { className: 'mt-0.5 block leading-snug text-ink' }, selectedWordState.meaning),
              ),
            ),
          )
        : null,
      React.createElement(
        'span',
        {
          role: 'button',
          tabIndex: 0,
          onClick: () => onWordClick(part, keyId),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onWordClick(part, keyId);
            }
          },
          className: [
            baseClass || 'rounded px-1 py-0.5',
            'cursor-pointer transition hover:bg-gold/30',
            isSelected ? 'bg-gold text-on-gold font-extrabold ring-2 ring-gold' : '',
          ].filter(Boolean).join(' '),
        },
        part,
      ),
    );
  });
}

export function AudioDramaPlayer({
  title = '',
  content = '',
  audioUrl = '',
  vocabulary = [],
  lang = 'bn',
  autoPlaySignal = 0,
  onClose,
}) {
  const isBn = lang === 'bn';
  const lines = useMemo(() => parseStoryScript(content, isBn ? 'বর্ণনাকারী' : 'Narrator'), [content, isBn]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const controllerRef = useRef(null);
  const lineRefs = useRef([]);
  const isPlayingRef = useRef(false);
  const positionRef = useRef(0);
  const pausedRef = useRef(false);
  const playbackSettingsRef = useRef({ lines, lang, audioUrl });
  const lastAutoPlayRef = useRef(0);

  const copy = {
    title: isBn ? 'গল্পের মাধ্যমে ইংরেজি শিখুন' : 'Learn English by Story',
    play: isBn ? '▶ গল্প শুনুন' : '▶ Listen to Story',
    pause: isBn ? '⏸ বিরতি' : '⏸ Pause',
    resume: isBn ? '▶ চালান' : '▶ Resume',
    seek: isBn ? 'গল্পে এগিয়ে যান' : 'Seek through the story',
    close: isBn ? '✕ বন্ধ' : '✕ Close',
    story: isBn ? 'গল্পের সংলাপ' : 'Story dialogue',
    loading: isBn ? 'পাঠ প্রস্তুত হচ্ছে…' : 'Preparing lesson audio…',
    friendlyError: isBn ? 'অডিও এখন চালানো যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।' : 'Audio cannot play right now. Check your connection and try again.',
  };

  const handleWordLookup = async (rawWord, keyId) => {
    const clean = normalizeWord(rawWord);
    if (!clean) return;

    setSelectedWord((prev) => (prev?.keyId === keyId && prev?.meaning ? prev : {
      keyId,
      term: clean,
      meaning: '...',
      loading: true,
    }));
    try {
      const result = await lookupStoryWordMeaning(clean, vocabulary, lang);
      if (result) setSelectedWord({ ...result, keyId });
    } catch (lookupError) {
      setSelectedWord({
        keyId,
        term: clean,
        meaning: isBn
          ? `শব্দার্থ লোড করা যায়নি: ${lookupError.message}`
          : `Meaning could not be loaded: ${lookupError.message}`,
        isOffline: false,
      });
    }
  };

  const startPlayback = (startAt = 0) => {
    controllerRef.current?.close();
    setError('');
    setNotice('');
    isPlayingRef.current = true;
    pausedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);
    setIsFullscreen(true);

    controllerRef.current = playDrama(
      lines,
      (progress) => {
        positionRef.current = progress.index + progress.fraction;
        setPosition(positionRef.current);
      },
      () => {
        isPlayingRef.current = false;
        pausedRef.current = false;
        positionRef.current = 0;
        setPosition(0);
        setIsPlaying(false);
        setIsPaused(false);
        setNotice('');
      },
      {
        lang,
        volume: 0.9,
        spatial: false,
        audioUrl,
        storyContent: content,
        onError: (message) => {
          isPlayingRef.current = false;
          pausedRef.current = false;
          setIsPlaying(false);
          setIsPaused(false);
          setNotice('');
          setError(message || copy.friendlyError);
        },
        onNotice: setNotice,
      },
    );
    controllerRef.current.play(startAt);
  };

  useEffect(() => {
    if (autoPlaySignal > 0 && autoPlaySignal !== lastAutoPlayRef.current && lines.length > 0) {
      lastAutoPlayRef.current = autoPlaySignal;
      startPlayback(0);
    }
  }, [autoPlaySignal, lines]);

  useEffect(() => {
    const changed = playbackSettingsRef.current.lines !== lines
      || playbackSettingsRef.current.lang !== lang
      || playbackSettingsRef.current.audioUrl !== audioUrl;
    playbackSettingsRef.current = { lines, lang, audioUrl };
    if (!changed) return;
    const restartAt = isPlayingRef.current ? positionRef.current : null;
    controllerRef.current?.close();
    controllerRef.current = null;
    setError('');
    setNotice('');
    if (restartAt !== null) startPlayback(Math.floor(restartAt));
  }, [lines, lang, audioUrl]);

  useEffect(() => () => {
    isPlayingRef.current = false;
    controllerRef.current?.close();
    controllerRef.current = null;
  }, []);

  const handlePlayPause = () => {
    if (!controllerRef.current || (!isPlaying && !isPaused)) {
      startPlayback(position);
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
    setIsFullscreen(false);
    setNotice('');
  };

  const handleSeek = (value) => {
    const nextPosition = Number(value);
    positionRef.current = nextPosition;
    setPosition(nextPosition);
    controllerRef.current?.seek(nextPosition);
  };

  const currentLineIndex = Math.min(Math.floor(position), Math.max(lines.length - 1, 0));
  const currentLineFraction = Math.min(1, Math.max(0, position - currentLineIndex));

  useEffect(() => {
    if (!isPlaying) return;
    lineRefs.current[currentLineIndex]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [currentLineIndex, isPlaying]);

  return (
    <section
      aria-label={copy.title}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto bg-paper p-4 sm:p-8'
          : 'w-full'
      }
    >
      <div className={isFullscreen ? 'mx-auto max-w-4xl space-y-4' : 'space-y-3'}>
        <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold/40 bg-paper/95 p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={!lines.length}
              className="primary-button min-h-[42px] bg-sapphire px-4 py-1.5 text-xs font-extrabold text-on-sapphire sm:text-sm"
            >
              {isPaused ? copy.resume : isPlaying ? copy.pause : copy.play}
            </button>
            {(isPlaying || isPaused || isFullscreen) ? (
              <button
                type="button"
                onClick={() => {
                  handleStop();
                  onClose?.();
                }}
                aria-label={copy.close}
                className="secondary-button min-h-[42px] px-3.5 py-1.5 text-xs font-bold sm:text-sm"
              >
                {copy.close}
              </button>
            ) : null}
          </div>

          {notice ? <p role="status" className="w-full text-xs font-medium text-gold-soft">{notice}</p> : null}

          {lines.length ? (
            <input
              type="range"
              min="0"
              max={lines.length}
              step="0.01"
              value={Math.min(position, lines.length)}
              onChange={(event) => handleSeek(event.target.value)}
              aria-label={copy.seek}
              className="h-2 w-full cursor-pointer accent-gold"
            />
          ) : null}

          {selectedWord ? (
            <button
              type="button"
              onClick={() => setSelectedWord(null)}
              className="rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold-soft"
            >
              ✕ {isBn ? 'অর্থ লুকান' : 'Hide meaning'}
            </button>
          ) : null}
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
                      : 'border-gold/20 bg-paper/75'
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
                    {spokenTextParts(line.text, fraction, isCompletedLine, handleWordLookup, selectedWord, lineIndex)}
                  </p>
                </div>
              </div>
            );
          })}
          {!lines.length ? <p className="min-h-10 text-sm leading-relaxed opacity-80">{copy.loading}</p> : null}
        </div>

        {error ? <p role="alert" className="text-sm font-medium text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
