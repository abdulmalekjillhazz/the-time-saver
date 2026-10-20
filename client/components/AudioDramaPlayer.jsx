'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseStoryScript, playDrama } from '../lib/audioDrama.js';
import { apiRequestAudio } from '../lib/apiClient.js';
import {
  canAttemptSpeechPractice,
  compareSpeechText,
  MAX_SPEECH_PRACTICE_ATTEMPTS,
} from '../lib/speechPractice.js';
import { isAndroidNativeApp, recognizeEnglishSpeech, stopEnglishSpeechRecognition } from '../lib/nativeSpeech.js';
import { lookupStoryWordMeaning, normalizeWord } from './StoryReader.jsx';
import {
  getOfflineStoryAudio,
  saveOfflineMeanings,
  saveOfflineStoryAudio,
} from '../lib/offlineStoryCache.js';

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
  slug = '',
  content = '',
  practiceContent,
  audioUrl = '',
  vocabulary = [],
  lang = 'bn',
  autoPlaySignal = 0,
  onClose,
  startInPracticeMode = false,
}) {
  const isBn = lang === 'bn';
  const lines = useMemo(() => parseStoryScript(content, isBn ? 'বর্ণনাকারী' : 'Narrator'), [content, isBn]);
  const englishPracticeContent = practiceContent === undefined
    ? (lang === 'en' ? content : '')
    : practiceContent;
  const practiceLines = useMemo(
    () => parseStoryScript(englishPracticeContent, 'Narrator'),
    [englishPracticeContent],
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [chunkMode, setChunkMode] = useState(true);
  const [offlineAudio, setOfflineAudio] = useState(null);
  const [offlineAudioSaving, setOfflineAudioSaving] = useState(false);
  const [offlineAudioStatus, setOfflineAudioStatus] = useState('');
  const [offlineAudioError, setOfflineAudioError] = useState('');
  const [speechPracticeOpen, setSpeechPracticeOpen] = useState(startInPracticeMode);
  const [attemptsByLine, setAttemptsByLine] = useState({});
  const [speechPractice, setSpeechPractice] = useState({
    lineIndex: -1,
    status: 'idle',
    transcript: '',
    comparison: null,
    message: '',
  });

  useEffect(() => {
    if (vocabulary?.length) {
      const vocabList = vocabulary.map((v) => {
        const raw = v.definition || v.meaning || "";
        const meaning = typeof raw === "string" ? raw : (raw?.bn || raw?.en || "");
        return { term: normalizeWord(v.term || v.word), meaning };
      }).filter((v) => v.term && v.meaning);
      saveOfflineMeanings(vocabList, lang).catch(() => {});
    }
  }, [vocabulary, lang]);
  const controllerRef = useRef(null);
  const lineRefs = useRef([]);
  const isPlayingRef = useRef(false);
  const positionRef = useRef(0);
  const pausedRef = useRef(false);
  const playbackSettingsRef = useRef({ lines, lang, audioUrl });
  const lastAutoPlayRef = useRef(0);
  const recognitionRef = useRef(null);
  const activeRecognitionRef = useRef(false);
  const recognizedTextRef = useRef('');

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
    saveOfflineAudio: isBn ? 'অফলাইনে অডিও রাখুন' : 'Save audio offline',
    offlineAudioSaved: isBn ? 'এই গল্পের অডিও এই ডিভাইসে রাখা হয়েছে।' : 'Story audio is saved on this device.',
    offlineAudioSaving: isBn ? 'অডিও এই ডিভাইসে সংরক্ষণ হচ্ছে…' : 'Saving audio on this device…',
    offlineAudioSaveFailed: isBn ? 'অফলাইনে অডিও রাখা যায়নি। আবার চেষ্টা করুন।' : 'Could not save audio offline. Please try again.',
    practice: isBn ? '🎙 উচ্চারণ অনুশীলন' : '🎙 Practice pronunciation',
    closePractice: isBn ? '✕ অনুশীলন বন্ধ' : '✕ Close practice',
    practiceTitle: isBn ? 'গল্পের লাইন পড়ে উচ্চারণ অনুশীলন করুন' : 'Practice speaking story lines',
    practiceHelp: isBn
      ? 'একটি ইংরেজি লাইন পড়ুন। ব্রাউজারের speech recognition আপনার বলা শব্দের সঙ্গে লাইনটি মেলাবে—এটি নিখুঁত phonetic score নয়। ব্রাউজারভেদে ফল বদলাতে পারে এবং অডিও অনলাইনে প্রক্রিয়াকৃত হতে পারে।'
      : 'Read an English line aloud. Browser speech recognition compares the words it hears with the story; this is an estimate, not a phonetic pronunciation score. Results vary by browser, and audio may be processed online.',
    speakLine: isBn ? '🎤 পড়ে যাচাই করুন' : '🎤 Read and check',
    stopSpeaking: isBn ? '⏹ থামান' : '⏹ Stop',
    retrySpeaking: isBn ? '🔁 আবার চেষ্টা' : '🔁 Try again',
    listening: isBn ? 'শুনছি—এখন লাইনটি পড়ুন…' : 'Listening—read the line aloud…',
    recognized: isBn ? 'আপনার বলা কথা' : 'What we heard',
    wordMatch: isBn ? 'শব্দের মিল' : 'Word match',
    matchedWord: isBn ? 'মেলা শব্দ' : 'Recognized word',
    missedWord: isBn ? 'না-মেলা শব্দ' : 'Unmatched word',
    speechUnsupported: isBn
      ? 'এই ব্রাউজারে speech recognition সমর্থিত নয়। Chrome বা Edge-এ চেষ্টা করুন।'
      : 'Speech recognition is not supported in this browser. Try Chrome or Edge.',
    speechPermission: isBn
      ? 'মাইক্রোফোন ব্যবহারের অনুমতি দিন, তারপর আবার চেষ্টা করুন।'
      : 'Allow microphone access, then try again.',
    speechNoAudio: isBn ? 'কোনো কথা শোনা যায়নি। আবার চেষ্টা করুন।' : 'No speech was heard. Please try again.',
    speechMicMissing: isBn ? 'মাইক্রোফোন পাওয়া যায়নি।' : 'No microphone was found.',
    speechUnavailable: isBn ? 'কথা শনাক্ত করা যায়নি। আবার চেষ্টা করুন।' : 'Speech could not be recognized. Please try again.',
    attempts: isBn ? 'চেষ্টা' : 'Attempt',
    attemptsLimit: isBn ? 'এই লাইনে ৩টি চেষ্টা শেষ। পরের লাইনে যান।' : 'All 3 tries used for this line. Move to the next line.',
    nextLine: isBn ? 'পরের লাইন →' : 'Next line →',
    speakingAnimation: isBn ? 'মাইক্রোফোন শুনছে' : 'Microphone listening',
  };

  useEffect(() => {
    let active = true;
    setOfflineAudio(null);
    setOfflineAudioStatus('');
    setOfflineAudioError('');
    if (!slug || !content || typeof globalThis.indexedDB === 'undefined') return () => { active = false; };
    getOfflineStoryAudio(slug, content)
      .then((audio) => {
        if (active && audio) {
          setOfflineAudio(audio);
          setOfflineAudioStatus(copy.offlineAudioSaved);
        }
      })
      .catch((error) => {
        if (active) setOfflineAudioError(error.message || copy.offlineAudioSaveFailed);
      });
    return () => { active = false; };
  }, [copy.offlineAudioSaveFailed, copy.offlineAudioSaved, content, slug]);

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

  const saveAudioOffline = async () => {
    if (!slug || !content || offlineAudioSaving) return;
    setOfflineAudioSaving(true);
    setOfflineAudioStatus(copy.offlineAudioSaving);
    setOfflineAudioError('');
    try {
      if (globalThis.navigator?.onLine === false) {
        throw new Error(isBn
          ? 'অডিও ডাউনলোড করতে আগে ইন্টারনেটে যুক্ত হতে হবে।'
          : 'Connect to the internet before downloading story audio.');
      }
      const buffer = await apiRequestAudio('/api/speech/audio-drama/offline', {
        body: { content },
        locale: lang,
      });
      const audio = new Blob([buffer], { type: 'audio/mpeg' });
      await saveOfflineStoryAudio(slug, content, audio);
      setOfflineAudio(audio);
      setOfflineAudioStatus(copy.offlineAudioSaved);
    } catch (saveError) {
      setOfflineAudioStatus('');
      setOfflineAudioError(globalThis.navigator?.onLine === false
        ? (isBn
          ? 'অডিও সংরক্ষণ করতে ইন্টারনেটে যুক্ত হন।'
          : 'Connect to the internet to save audio.')
        : copy.offlineAudioSaveFailed);
    } finally {
      setOfflineAudioSaving(false);
    }
  };

  const startPlayback = useCallback(async (startAt = 0) => {
    controllerRef.current?.close();
    let savedAudio = offlineAudio;
    if (!savedAudio && slug && typeof globalThis.indexedDB !== 'undefined') {
      try {
        savedAudio = await getOfflineStoryAudio(slug, content);
        if (savedAudio) setOfflineAudio(savedAudio);
      } catch (cacheError) {
        setOfflineAudioError(cacheError.message || copy.offlineAudioSaveFailed);
      }
    }
    setError('');
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
      },
      {
        lang,
        volume: 0.9,
        spatial: false,
        audioUrl,
        storyContent: content,
        offlineAudio: savedAudio,
        onError: (message) => {
          isPlayingRef.current = false;
          pausedRef.current = false;
          setIsPlaying(false);
          setIsPaused(false);
          setError(message || copy.friendlyError);
        },
      },
    );
    controllerRef.current.play(startAt);
  }, [
    audioUrl,
    content,
    copy.friendlyError,
    copy.offlineAudioSaveFailed,
    lang,
    lines,
    offlineAudio,
    slug,
  ]);

  useEffect(() => {
    if (autoPlaySignal > 0 && autoPlaySignal !== lastAutoPlayRef.current && lines.length > 0) {
      lastAutoPlayRef.current = autoPlaySignal;
      startPlayback(0);
    }
  }, [autoPlaySignal, lines, startPlayback]);

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
    if (restartAt !== null) startPlayback(Math.floor(restartAt));
  }, [lines, lang, audioUrl, startPlayback]);

  useEffect(() => () => {
    isPlayingRef.current = false;
    controllerRef.current?.close();
    controllerRef.current = null;
    activeRecognitionRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
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
  };

  const handleSeek = (value) => {
    const nextPosition = Number(value);
    positionRef.current = nextPosition;
    setPosition(nextPosition);
    controllerRef.current?.seek(nextPosition);
  };

  const cancelSpeechPractice = () => {
    activeRecognitionRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (isAndroidNativeApp()) {
      stopEnglishSpeechRecognition().catch(() => {});
    }
    try {
      recognition?.abort();
    } catch {
      setSpeechPractice({
        lineIndex: speechPractice.lineIndex,
        status: 'error',
        transcript: recognizedTextRef.current,
        comparison: null,
        message: copy.speechUnavailable,
      });
      return false;
    }
    setSpeechPractice({
      lineIndex: -1,
      status: 'idle',
      transcript: '',
      comparison: null,
      message: '',
    });
    return true;
  };

  const practiceLine = async (lineIndex) => {
    if (speechPractice.status === 'listening' && speechPractice.lineIndex === lineIndex) {
      if (isAndroidNativeApp()) {
        stopEnglishSpeechRecognition().catch(() => {});
        activeRecognitionRef.current = false;
        setSpeechPractice((current) => ({ ...current, status: 'idle' }));
        return;
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        activeRecognitionRef.current = false;
        recognitionRef.current = null;
        setSpeechPractice((current) => ({
          ...current,
          status: 'error',
          message: copy.speechUnavailable,
        }));
      }
      return;
    }

    if (!canAttemptSpeechPractice(attemptsByLine[lineIndex] || 0)) return;

    const nativeSpeech = isAndroidNativeApp();
    const SpeechRecognition = globalThis.window?.SpeechRecognition
      || globalThis.window?.webkitSpeechRecognition;
    if (!nativeSpeech && !SpeechRecognition) {
      setSpeechPractice({
        lineIndex,
        status: 'error',
        transcript: '',
        comparison: null,
        message: copy.speechUnsupported,
      });
      return;
    }

    const previousRecognition = recognitionRef.current;
    activeRecognitionRef.current = false;
    recognitionRef.current = null;
    try {
      previousRecognition?.abort();
    } catch {
      setSpeechPractice({
        lineIndex: speechPractice.lineIndex,
        status: 'error',
        transcript: recognizedTextRef.current,
        comparison: null,
        message: copy.speechUnavailable,
      });
      return;
    }

    activeRecognitionRef.current = true;
    recognizedTextRef.current = '';
    setSpeechPractice({
      lineIndex,
      status: 'listening',
      transcript: '',
      comparison: null,
      message: '',
    });
    setAttemptsByLine((previous) => ({
      ...previous,
      [lineIndex]: (previous[lineIndex] || 0) + 1,
    }));

    if (isPlaying || isPaused) {
      controllerRef.current?.pause();
      isPlayingRef.current = false;
      pausedRef.current = false;
      setIsPlaying(false);
      setIsPaused(false);
    }

    if (nativeSpeech) {
      try {
        const transcript = await recognizeEnglishSpeech();
        if (!activeRecognitionRef.current) return;
        activeRecognitionRef.current = false;
        setSpeechPractice({
          lineIndex,
          status: 'result',
          transcript,
          comparison: compareSpeechText(practiceLines[lineIndex]?.text, transcript),
          message: '',
        });
      } catch (recognitionError) {
        if (!activeRecognitionRef.current) return;
        activeRecognitionRef.current = false;
        const message = recognitionError?.code === 'PERMISSION_DENIED'
          ? copy.speechPermission
          : recognitionError?.code === 'NO_MATCH'
            ? copy.speechNoAudio
            : copy.speechUnavailable;
        setSpeechPractice({
          lineIndex,
          status: 'error',
          transcript: '',
          comparison: null,
          message,
        });
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      recognizedTextRef.current = transcript;
      setSpeechPractice((current) => (
        current.lineIndex === lineIndex ? { ...current, transcript } : current
      ));
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      activeRecognitionRef.current = false;
      recognitionRef.current = null;
      const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? copy.speechPermission
        : event.error === 'no-speech'
          ? copy.speechNoAudio
          : event.error === 'audio-capture'
            ? copy.speechMicMissing
            : copy.speechUnavailable;
      setSpeechPractice({
        lineIndex,
        status: 'error',
        transcript: recognizedTextRef.current,
        comparison: null,
        message,
      });
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition || !activeRecognitionRef.current) return;
      activeRecognitionRef.current = false;
      recognitionRef.current = null;
      const transcript = recognizedTextRef.current;
      if (!transcript) {
        setSpeechPractice({
          lineIndex,
          status: 'error',
          transcript: '',
          comparison: null,
          message: copy.speechNoAudio,
        });
        return;
      }
      setSpeechPractice({
        lineIndex,
        status: 'result',
        transcript,
        comparison: compareSpeechText(practiceLines[lineIndex]?.text, transcript),
        message: '',
      });
    };

    try {
      recognition.start();
    } catch {
      activeRecognitionRef.current = false;
      recognitionRef.current = null;
      setSpeechPractice({
        lineIndex,
        status: 'error',
        transcript: '',
        comparison: null,
        message: copy.speechUnavailable,
      });
    }
  };

  const advancePracticeLine = (lineIndex) => {
    if (lineIndex >= practiceLines.length - 1) return;
    setSpeechPractice({
      lineIndex: lineIndex + 1,
      status: 'idle',
      transcript: '',
      comparison: null,
      message: '',
    });
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
            {slug ? (
              <button
                type="button"
                onClick={saveAudioOffline}
                disabled={offlineAudioSaving || Boolean(offlineAudio)}
                className="secondary-button min-h-[42px] px-3 py-1.5 text-xs font-bold sm:text-sm"
              >
                {offlineAudioSaving ? copy.offlineAudioSaving : offlineAudio ? copy.offlineAudioSaved : copy.saveOfflineAudio}
              </button>
            ) : null}
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
          <button
            type="button"
            onClick={() => setChunkMode((prev) => !prev)}
            className="rounded-lg border border-sapphire/40 bg-sapphire/10 px-2.5 py-1 text-xs font-bold text-sapphire"
          >
            {chunkMode
              ? (isBn ? '📄 পুরো গল্প দেখুন' : '📄 Show full story')
              : (isBn ? '🎯 ধাপে ধাপে দেখুন (Chunk)' : '🎯 Chunk mode')}
          </button>
          {practiceLines.length ? (
            <button
              type="button"
              onClick={() => {
                if (speechPracticeOpen) {
                  if (!cancelSpeechPractice()) return;
                  setSpeechPracticeOpen(false);
                } else {
                  setSpeechPracticeOpen(true);
                }
              }}
              aria-expanded={speechPracticeOpen}
              className="rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold-soft"
            >
              {speechPracticeOpen ? copy.closePractice : copy.practice}
            </button>
          ) : null}
        </div>

        {speechPracticeOpen ? (
          <section
            aria-label={copy.practiceTitle}
            className="relative isolate space-y-4 overflow-hidden rounded-[1.75rem] border border-gold/35 bg-gradient-to-br from-sapphire/15 via-paper to-gold/15 p-4 shadow-xl sm:p-6"
          >
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 -z-10 size-40 rounded-full bg-gold/15 blur-3xl" />
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/15 text-2xl shadow-inner sm:size-14 sm:text-3xl">🎙️</span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full border border-sapphire/25 bg-sapphire/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sapphire">
                  {isBn ? 'শুনুন · বলুন · শিখুন' : 'Listen · Speak · Grow'}
                </span>
                <h3 className="mt-2 text-lg font-black tracking-tight text-ink sm:text-xl">{copy.practiceTitle}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink/75 sm:text-sm">{copy.practiceHelp}</p>
              </div>
            </div>
            <div className="space-y-3">
              {practiceLines.map((line, lineIndex) => {
                const isCurrentPractice = speechPractice.lineIndex === lineIndex;
                const isListening = isCurrentPractice && speechPractice.status === 'listening';
                const comparison = isCurrentPractice ? speechPractice.comparison : null;
                const attempts = attemptsByLine[lineIndex] || 0;
                const attemptsExhausted = !canAttemptSpeechPractice(attempts);
                const hasResult = isCurrentPractice && speechPractice.status === 'result';
                return (
                  <article
                    key={`practice-${lineIndex}-${line.character}`}
                    className={`relative space-y-3 rounded-2xl border p-4 shadow-sm transition-all duration-300 sm:p-5 ${
                      isListening
                        ? 'border-sapphire/60 bg-sapphire/10 shadow-lg shadow-sapphire/10'
                        : hasResult
                          ? 'border-emerald-500/35 bg-emerald-500/5'
                          : 'border-gold/20 bg-paper/75 hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex min-h-7 items-center rounded-full bg-gold/15 px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-gold-soft">
                        {isBn ? `লাইন ${lineIndex + 1}` : `Line ${lineIndex + 1}`}
                      </span>
                      <div className="flex items-center gap-1.5" aria-label={`${copy.attempts}: ${attempts}/${MAX_SPEECH_PRACTICE_ATTEMPTS}`}>
                        {Array.from({ length: MAX_SPEECH_PRACTICE_ATTEMPTS }, (_, attemptIndex) => (
                          <span
                            key={attemptIndex}
                            aria-hidden="true"
                            className={`size-2.5 rounded-full transition-colors ${attemptIndex < attempts ? 'bg-gold' : 'bg-ink/15'}`}
                          />
                        ))}
                        <span className="ml-1 text-[10px] font-bold text-ink/60">{attempts}/{MAX_SPEECH_PRACTICE_ATTEMPTS}</span>
                      </div>
                    </div>
                    <p className="text-base font-bold leading-relaxed text-ink sm:text-lg">
                      {spokenTextParts(line.text, 0, false, handleWordLookup, selectedWord, `practice-${lineIndex}`)}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { void practiceLine(lineIndex); }}
                        aria-pressed={isListening}
                        disabled={attemptsExhausted && !isListening}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/35 disabled:cursor-not-allowed disabled:opacity-50 ${
                          isListening
                            ? 'bg-red-600 text-white shadow-red-600/20'
                            : 'bg-gradient-to-r from-sapphire-deep to-sapphire text-white shadow-sapphire/20'
                        }`}
                      >
                        <span aria-hidden="true" className="text-base">{isListening ? '■' : '🎤'}</span>
                        {isListening
                          ? copy.stopSpeaking
                          : isCurrentPractice && speechPractice.status === 'result'
                            ? attemptsExhausted ? copy.attemptsLimit : copy.retrySpeaking
                            : attemptsExhausted ? copy.attemptsLimit : copy.speakLine}
                      </button>
                    </div>
                    {isListening ? (
                      <p role="status" className="flex items-center gap-2 rounded-xl border border-sapphire/25 bg-sapphire/10 px-3 py-2 text-xs font-bold text-sapphire">
                        <span className="relative inline-flex h-4 items-center gap-0.5" aria-hidden="true">
                          <span className="h-2 w-1 animate-pulse rounded-full bg-sapphire" />
                          <span className="h-4 w-1 animate-pulse rounded-full bg-sapphire [animation-delay:120ms]" />
                          <span className="h-3 w-1 animate-pulse rounded-full bg-sapphire [animation-delay:240ms]" />
                          <span className="h-2 w-1 animate-pulse rounded-full bg-sapphire [animation-delay:360ms]" />
                        </span>
                        {copy.listening} · {copy.speakingAnimation}
                      </p>
                    ) : null}
                    {isCurrentPractice && speechPractice.status === 'error' ? (
                      <p role="alert" className="text-xs font-semibold text-red-700">{speechPractice.message}</p>
                    ) : null}
                    {isCurrentPractice && speechPractice.status === 'result' && comparison ? (
                      <div role="status" aria-live="polite" className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-ink">
                        <p className="flex items-center gap-2 font-extrabold text-sapphire">
                          <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-700">✓</span>
                          {copy.wordMatch}: {comparison.accuracy}%
                        </p>
                        <p>
                          <span className="font-bold">{copy.recognized}: </span>
                          {speechPractice.transcript}
                        </p>
                        <p className="flex flex-wrap gap-1" aria-label={`${copy.wordMatch}: ${comparison.accuracy}%`}>
                          {comparison.targetWords.map((word, wordIndex) => (
                            <span
                              key={`${word}-${wordIndex}`}
                              aria-label={comparison.matchedWords[wordIndex] ? copy.matchedWord : copy.missedWord}
                              className={`rounded px-1.5 py-0.5 font-semibold ${
                                comparison.matchedWords[wordIndex]
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-red-100 text-red-900'
                              }`}
                            >
                              {word}
                            </span>
                          ))}
                        </p>
                        <p className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="font-semibold text-emerald-900">✓ {copy.matchedWord}</span>
                          <span className="font-semibold text-red-900">✕ {copy.missedWord}</span>
                        </p>
                        {lineIndex < practiceLines.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => advancePracticeLine(lineIndex)}
                            className="secondary-button min-h-[40px] px-3 py-1.5 text-xs font-bold"
                          >
                            {copy.nextLine}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {attemptsExhausted
                    && speechPractice.status !== 'result'
                    && lineIndex < practiceLines.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => advancePracticeLine(lineIndex)}
                        className="secondary-button min-h-[40px] px-3 py-1.5 text-xs font-bold"
                      >
                        {copy.nextLine}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {offlineAudioStatus ? <p role="status" className="text-sm text-ink/80">{offlineAudioStatus}</p> : null}
        {offlineAudioError ? <p role="alert" className="text-sm text-red-700">{offlineAudioError}</p> : null}

        <div
          role="list"
          aria-label={copy.story}
          tabIndex={0}
          className="w-full space-y-3"
        >
          {(chunkMode && (isPlaying || position > 0)
            ? lines.slice(0, Math.min(lines.length, currentLineIndex + 1))
            : lines).map((line, lineIndex) => {
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
