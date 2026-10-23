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
import { playCongratulationsSound } from '../lib/notificationSound.js';
import { lookupStoryWordMeaning, normalizeWord } from './StoryReader.jsx';
import {
  getOfflineStoryAudio,
  saveOfflineMeanings,
  saveOfflineStoryAudio,
} from '../lib/offlineStoryCache.js';
import { speakWithVoice } from '../lib/voiceBriefing.js';

function characterIcon(role) {
  if (role === 'male') return '👨';
  if (role === 'female') return '👩';
  if (role === 'child') return '🧒';
  return '🎙️';
}

export function spokenTextParts(
  text,
  fraction,
  completed,
  onWordClick,
  selectedWordState = null,
  lineIndex = 0,
  onSpeakWord,
  pronunciationLabel = 'Hear pronunciation',
) {
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
                onSpeakWord
                  ? React.createElement(
                      'button',
                      {
                        type: 'button',
                        'aria-label': `${pronunciationLabel}: ${selectedWordState.term}`,
                        onClick: (event) => {
                          event.stopPropagation();
                          onSpeakWord(selectedWordState.term);
                        },
                        className: 'mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-sapphire/25 bg-sapphire/10 px-2.5 py-1 text-[11px] font-bold text-sapphire hover:bg-sapphire/20',
                      },
                      `🔊 ${pronunciationLabel}`,
                    )
                  : null,
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
            'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold',
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
  onComplete,
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
  const [readingChunkIndex, setReadingChunkIndex] = useState(0);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [chunkMode, setChunkMode] = useState(true);
  const [offlineAudio, setOfflineAudio] = useState(null);
  const [offlineAudioSaving, setOfflineAudioSaving] = useState(false);
  const [offlineAudioStatus, setOfflineAudioStatus] = useState('');
  const [offlineAudioError, setOfflineAudioError] = useState('');
  const offlineAudioRef = useRef(null);
  const offlineAudioSaveInFlightRef = useRef(false);
  const [speechPracticeOpen, setSpeechPracticeOpen] = useState(startInPracticeMode);
  const [microphoneConsentLine, setMicrophoneConsentLine] = useState(null);
  const [microphoneConsentAccepted, setMicrophoneConsentAccepted] = useState(false);
  const [practiceFeedback, setPracticeFeedback] = useState('');
  const [attemptsByLine, setAttemptsByLine] = useState({});
  const [speechPractice, setSpeechPractice] = useState({
    lineIndex: startInPracticeMode && practiceLines.length ? 0 : -1,
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
  const pronunciationRef = useRef(null);

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
    offlineAudioHint: isBn
      ? 'অনলাইনে গল্পটি একবার চালালেই অডিও এই ডিভাইসে স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে—পরে অফলাইনে শুনতে পারবেন।'
      : 'Play this story once online; its audio will save to this device for offline listening.',
    offlineAudioSaved: isBn ? 'এই গল্পের অডিও এই ডিভাইসে রাখা হয়েছে।' : 'Story audio is saved on this device.',
    offlineAudioSaving: isBn ? 'অডিও এই ডিভাইসে সংরক্ষণ হচ্ছে…' : 'Saving audio on this device…',
    offlineAudioSaveFailed: isBn ? 'অফলাইনে অডিও রাখা যায়নি। আবার চেষ্টা করুন।' : 'Could not save audio offline. Please try again.',
    offlineAudioUnavailable: isBn ? 'এই ব্রাউজারে অফলাইনে অডিও রাখার সুবিধা নেই।' : 'Offline audio storage is not available in this browser.',
    offlineAudioConnect: isBn ? 'অফলাইনে শোনার জন্য ইন্টারনেটে যুক্ত হলে অডিও স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।' : 'Connect to the internet and the audio will save automatically for offline listening.',
    retryOfflineAudio: isBn ? 'আবার চেষ্টা করুন' : 'Retry saving audio',
    practice: isBn ? '🎙 উচ্চারণ অনুশীলন' : '🎙 Practice pronunciation',
    closePractice: isBn ? '✕ অনুশীলন বন্ধ' : '✕ Close practice',
    practiceTitle: isBn ? 'গল্পের লাইন পড়ে উচ্চারণ অনুশীলন করুন' : 'Practice speaking story lines',
    practiceHelp: isBn
      ? 'আগে নমুনা উচ্চারণ শুনুন, তারপর বাক্যটি বলুন। আপনার বলা শব্দের মিল দেখে পরামর্শ পাবেন।'
      : 'Listen to the example, then say the sentence. You will see which words matched.',
    practiceProgress: isBn ? 'বাক্য' : 'Sentence',
    practiceProgressLabel: isBn ? 'অনুশীলনের অগ্রগতি' : 'Practice progress',
    attemptCount: (current, total) => isBn ? `${current} / ${total} বার চেষ্টা` : `${current} of ${total} tries`,
    microphonePermissionTitle: isBn ? 'মাইক্রোফোন ব্যবহারের অনুমতি' : 'Microphone permission',
    microphonePermissionHelp: isBn
      ? 'আপনার বলা ইংরেজি শব্দের সঙ্গে বাক্যটি মেলাতে মাইক্রোফোন দরকার। অডিও speech recognition-এর জন্য প্রক্রিয়াকৃত হবে; চালিয়ে গেলে ডিভাইসের অনুমতি চাওয়া হবে।'
      : 'The microphone is needed to compare your spoken words with the sentence. Audio will be processed for speech recognition; continuing will request your device permission.',
    allowMicrophone: isBn ? 'অনুমতি দিন ও শুরু করুন' : 'Allow and start',
    cancelMicrophone: isBn ? 'এখন নয়' : 'Not now',
    microphonePermissionFailed: isBn
      ? 'মাইক্রোফোন ব্যবহার করা যায়নি। অনুমতি পরীক্ষা করে আবার চেষ্টা করুন।'
      : 'Microphone access failed. Check the permission and try again.',
    speakLine: isBn ? 'পড়ে যাচাই করুন' : 'Read and check',
    listenExample: isBn ? 'নমুনা উচ্চারণ শুনুন' : 'Listen to example',
    stopSpeaking: isBn ? 'থামান' : 'Stop',
    retrySpeaking: isBn ? 'আবার চেষ্টা' : 'Try again',
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
    attemptsLimit: isBn ? 'এই লাইনে ৩টি চেষ্টা শেষ। লাইনটি এড়িয়ে যান।' : 'All 3 tries used for this line. Skip the sentence.',
    completeLine: isBn ? 'বাক্যটি সম্পন্ন' : 'Complete sentence',
    skipLine: isBn ? 'এড়িয়ে পরের বাক্য' : 'Skip to next sentence',
    finishPractice: isBn ? 'অনুশীলন শেষ করুন' : 'Finish practice',
    practiceFinished: isBn ? 'অনুশীলন শেষ হয়েছে।' : 'Practice session finished.',
    practiceFeedback: isBn ? 'চমৎকার—পরের বাক্য!' : 'Nice work—next sentence!',
    speakingAnimation: isBn ? 'মাইক্রোফোন শুনছে' : 'Microphone listening',
    pronunciationUnavailable: isBn ? 'এই ডিভাইসে ইংরেজি উচ্চারণ শোনা যাচ্ছে না।' : 'English pronunciation is unavailable on this device.',
    pronunciationLabel: isBn ? 'শব্দটি শুনুন' : 'Hear pronunciation',
    previousChunk: isBn ? '← আগের অংশ' : '← Previous chunk',
    nextChunk: isBn ? 'পরের অংশ →' : 'Next chunk →',
    chunkProgress: (current, total) => isBn ? `অংশ ${current} / ${total}` : `Chunk ${current} / ${total}`,
  };

  const handleWordLookup = async (rawWord, keyId, contextText = '') => {
    const clean = normalizeWord(rawWord);
    if (!clean) return;

    handleSpeakWord(clean, contextText);
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

  const handleSpeakText = (text, rate = 0.88) => {
    try {
      pronunciationRef.current?.stop?.();
      pronunciationRef.current = speakWithVoice(text, {
        lang: 'en-US',
        rate,
        onError: () => setError(copy.pronunciationUnavailable),
      });
      setError('');
    } catch {
      setError(copy.pronunciationUnavailable);
    }
  };

  const handleSpeakWord = (word, contextText = '') => {
    const spokenText = contextText
      ? `${word}. In this conversation: ${contextText}`
      : word;
    handleSpeakText(spokenText, 0.78);
  };

  const cacheStoryAudioAutomatically = useCallback(async () => {
    if (
      !slug
      || !content
      || typeof globalThis.indexedDB === 'undefined'
      || offlineAudioSaveInFlightRef.current
    ) return;
    offlineAudioSaveInFlightRef.current = true;
    setOfflineAudioSaving(true);
    setOfflineAudioStatus(copy.offlineAudioSaving);
    setOfflineAudioError('');
    try {
      if (globalThis.navigator?.onLine === false) {
        throw new Error(isBn
          ? 'অডিও ডাউনলোড করতে আগে ইন্টারনেটে যুক্ত হতে হবে।'
          : 'Connect to the internet before downloading story audio.');
      }
      const buffer = audioUrl
        ? await fetch(audioUrl).then((response) => {
          if (!response.ok) throw new Error('Saved story audio could not be downloaded.');
          return response.arrayBuffer();
        })
        : await apiRequestAudio('/api/speech/audio-drama/offline', {
          body: { content },
          locale: lang,
        });
      const audio = new Blob([buffer], { type: 'audio/mpeg' });
      await saveOfflineStoryAudio(slug, content, audio);
      offlineAudioRef.current = audio;
      setOfflineAudio(audio);
      setOfflineAudioStatus(copy.offlineAudioSaved);
    } catch {
      setOfflineAudioStatus('');
      setOfflineAudioError(globalThis.navigator?.onLine === false
        ? (isBn
          ? 'অডিও সংরক্ষণ করতে ইন্টারনেটে যুক্ত হন।'
          : 'Connect to the internet to save audio.')
        : copy.offlineAudioSaveFailed);
    } finally {
      setOfflineAudioSaving(false);
      offlineAudioSaveInFlightRef.current = false;
    }
  }, [audioUrl, content, copy.offlineAudioSaveFailed, copy.offlineAudioSaved, copy.offlineAudioSaving, isBn, lang, slug]);

  useEffect(() => {
    let active = true;
    offlineAudioRef.current = null;
    setOfflineAudio(null);
    setOfflineAudioStatus(copy.offlineAudioHint);
    setOfflineAudioError('');
    if (!slug || !content) return () => { active = false; };
    if (typeof globalThis.indexedDB === 'undefined') {
      setOfflineAudioStatus(copy.offlineAudioUnavailable);
      return () => { active = false; };
    }
    getOfflineStoryAudio(slug, content)
      .then((audio) => {
        if (!active) return;
        if (audio) {
          offlineAudioRef.current = audio;
          setOfflineAudio(audio);
          setOfflineAudioStatus(copy.offlineAudioSaved);
        } else if (globalThis.navigator?.onLine === false) {
          setOfflineAudioStatus(copy.offlineAudioConnect);
        }
      })
      .catch(() => {
        if (active) setOfflineAudioError(copy.offlineAudioSaveFailed);
      });
    return () => { active = false; };
  }, [
    content,
    copy.offlineAudioConnect,
    copy.offlineAudioHint,
    copy.offlineAudioSaveFailed,
    copy.offlineAudioSaved,
    copy.offlineAudioUnavailable,
    slug,
  ]);

  const startPlayback = useCallback(async (startAt = 0) => {
    controllerRef.current?.close();
    let savedAudio = offlineAudio;
    if (!savedAudio && slug && typeof globalThis.indexedDB !== 'undefined') {
      try {
        savedAudio = await getOfflineStoryAudio(slug, content);
        if (savedAudio) {
          offlineAudioRef.current = savedAudio;
          setOfflineAudio(savedAudio);
        }
      } catch (cacheError) {
        setOfflineAudioError(cacheError.message || copy.offlineAudioSaveFailed);
      }
    }
    if (!savedAudio && globalThis.navigator?.onLine !== false) {
      void cacheStoryAudioAutomatically();
    }
    setError('');
    isPlayingRef.current = true;
    pausedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);
    setIsFullscreen(true);
    setReadingChunkIndex(Math.max(0, Math.min(lines.length - 1, Math.floor(startAt))));

    controllerRef.current = playDrama(
      lines,
      (progress) => {
        positionRef.current = progress.index + progress.fraction;
        setPosition(positionRef.current);
        setReadingChunkIndex(progress.index);
      },
      () => {
        isPlayingRef.current = false;
        pausedRef.current = false;
        positionRef.current = 0;
        setPosition(0);
        setReadingChunkIndex(0);
        setIsPlaying(false);
        setIsPaused(false);
        onComplete?.();
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
        onStop: () => {
          isPlayingRef.current = false;
          pausedRef.current = false;
          positionRef.current = 0;
          setPosition(0);
          setReadingChunkIndex(0);
          setIsPlaying(false);
          setIsPaused(false);
          setIsFullscreen(false);
        },
      },
    );
    controllerRef.current.play(startAt);
  }, [
    audioUrl,
    content,
    copy.friendlyError,
    copy.offlineAudioSaveFailed,
    cacheStoryAudioAutomatically,
    lang,
    lines,
    offlineAudio,
    onComplete,
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
    pronunciationRef.current?.stop?.();
    pronunciationRef.current = null;
    activeRecognitionRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  const handlePlayPause = () => {
    if (!controllerRef.current || (!isPlaying && !isPaused)) {
      startPlayback(isPaused ? position : readingChunkIndex);
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
    setReadingChunkIndex(0);
    setIsPlaying(false);
    setIsPaused(false);
    setIsFullscreen(false);
  };

  const handleSeek = (value) => {
    const nextPosition = Number(value);
    positionRef.current = nextPosition;
    setPosition(nextPosition);
    setReadingChunkIndex(Math.max(0, Math.min(lines.length - 1, Math.floor(nextPosition))));
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

  const practiceLine = async (lineIndex, confirmed = false) => {
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

    if (!confirmed && !microphoneConsentAccepted) {
      setMicrophoneConsentLine(lineIndex);
      return;
    }

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

  const confirmMicrophonePermission = async () => {
    const lineIndex = microphoneConsentLine;
    if (lineIndex === null) return;
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
      setMicrophoneConsentLine(null);
      return;
    }
    try {
      if (!nativeSpeech) {
        if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
          setSpeechPractice({
            lineIndex,
            status: 'error',
            transcript: '',
            comparison: null,
            message: copy.speechPermission,
          });
          setMicrophoneConsentLine(null);
          return;
        }
        const stream = await globalThis.navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      setMicrophoneConsentAccepted(true);
      setMicrophoneConsentLine(null);
      await practiceLine(lineIndex, true);
    } catch {
      setSpeechPractice({
        lineIndex,
        status: 'error',
        transcript: '',
        comparison: null,
        message: copy.microphonePermissionFailed,
      });
      setMicrophoneConsentLine(null);
    }
  };

  const advancePracticeLine = (lineIndex, completed = false) => {
    const pronunciationSucceeded = completed && speechPractice.comparison?.accuracy >= 80;
    if (lineIndex >= practiceLines.length - 1) {
      setSpeechPractice({
        lineIndex,
        status: 'complete',
        transcript: '',
        comparison: null,
        message: '',
      });
      if (pronunciationSucceeded) {
        playCongratulationsSound();
        setPracticeFeedback(copy.practiceFeedback);
        globalThis.window?.setTimeout(() => setPracticeFeedback(''), 2200);
      }
      return;
    }
    setSpeechPractice({
      lineIndex: lineIndex + 1,
      status: 'idle',
      transcript: '',
      comparison: null,
      message: '',
    });
    setMicrophoneConsentLine(null);
    if (pronunciationSucceeded) {
      playCongratulationsSound();
      setPracticeFeedback(copy.practiceFeedback);
      globalThis.window?.setTimeout(() => setPracticeFeedback(''), 2200);
    }
  };

  const currentLineIndex = Math.min(Math.floor(position), Math.max(lines.length - 1, 0));
  const currentLineFraction = Math.min(1, Math.max(0, position - currentLineIndex));
  const practiceFullscreen = startInPracticeMode && speechPracticeOpen;
  const fullScreenReaderOpen = practiceFullscreen || isFullscreen;
  const activePracticeLineIndex = Math.max(0, speechPractice.lineIndex);
  const offlineAudioNotice = offlineAudioSaving
    ? copy.offlineAudioSaving
    : offlineAudioStatus || (!offlineAudioError && slug ? copy.offlineAudioHint : '');

  useEffect(() => {
    if (!fullScreenReaderOpen || typeof document === 'undefined') return undefined;

    const { body, documentElement } = document;
    const bodyOverflow = body.style.overflow;
    const documentOverflow = documentElement.style.overflow;
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.overflow = bodyOverflow;
      documentElement.style.overflow = documentOverflow;
    };
  }, [fullScreenReaderOpen]);

  useEffect(() => {
    if (!isPlaying) return;
    lineRefs.current[currentLineIndex]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [currentLineIndex, isPlaying]);

  return (
    <section
      aria-label={copy.title}
      className={
        practiceFullscreen
          ? 'audio-drama-player speech-practice-fullscreen fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain bg-paper'
          : isFullscreen
          ? 'audio-drama-player fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain bg-paper p-4 sm:p-8'
          : 'audio-drama-player w-full'
      }
    >
      <div className={`audio-drama-player-content ${practiceFullscreen ? 'mx-auto min-h-screen max-w-4xl space-y-4 p-0 sm:p-6' : isFullscreen ? 'mx-auto max-w-4xl space-y-4 p-4 sm:p-8' : 'space-y-3'}`}>
        {practiceFullscreen ? (
          <div className="sticky z-40 flex justify-end bg-paper/95 px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:px-6" style={{ top: 0 }}>
            <button
              type="button"
              onClick={() => {
                if (!cancelSpeechPractice()) return;
                setSpeechPracticeOpen(false);
              }}
              className="secondary-button min-h-[44px] px-4 py-2 text-sm font-bold"
            >
              ← {isBn ? 'বের হন' : 'Exit practice'}
            </button>
          </div>
        ) : null}
        {!practiceFullscreen ? (
        <div className="audio-drama-toolbar sticky top-2 z-30 grid grid-cols-2 items-center gap-2 rounded-2xl border border-gold/40 bg-paper/95 p-3 shadow-lg lg:flex lg:flex-wrap">
          <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-auto">
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={!lines.length}
              className="primary-button min-h-11 flex-1 bg-sapphire px-3 py-2 text-xs font-extrabold text-on-sapphire sm:flex-none sm:px-4 sm:text-sm"
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
                className="secondary-button min-h-11 flex-1 px-3.5 py-2 text-xs font-bold sm:flex-none sm:text-sm"
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
              className="order-last col-span-2 h-3 w-full cursor-pointer accent-gold lg:basis-full"
            />
          ) : null}

          {selectedWord ? (
            <button
              type="button"
              onClick={() => setSelectedWord(null)}
              className="min-h-11 w-full rounded-xl border border-gold/40 bg-gold/10 px-2.5 py-2 text-xs font-bold text-ink sm:text-sm lg:w-auto"
            >
              ✕ {isBn ? 'অর্থ লুকান' : 'Hide meaning'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setChunkMode((prev) => !prev)}
            className="min-h-11 w-full rounded-xl border border-sapphire/40 bg-sapphire/10 px-2.5 py-2 text-xs font-bold text-ink sm:text-sm lg:w-auto"
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
                  setSpeechPractice((current) => current.lineIndex < 0
                    ? { ...current, lineIndex: 0 }
                    : current);
                }
              }}
              aria-expanded={speechPracticeOpen}
              className="min-h-11 w-full rounded-xl border border-gold/40 bg-gold/10 px-2.5 py-2 text-xs font-bold text-ink sm:text-sm lg:w-auto"
            >
              {speechPracticeOpen ? copy.closePractice : copy.practice}
            </button>
          ) : null}
        </div>
        ) : null}

        {speechPracticeOpen ? (
          <section
            aria-label={copy.practiceTitle}
            className={`relative isolate mx-auto w-full max-w-3xl space-y-5 overflow-hidden rounded-[1.75rem] border border-gold/35 bg-gradient-to-br from-sapphire/15 via-paper to-gold/15 p-5 shadow-xl sm:p-8${practiceFullscreen ? ' min-h-[100dvh] max-w-4xl rounded-none border-0 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:min-h-[calc(100dvh-3rem)] sm:rounded-[1.75rem]' : ''}`}
          >
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 -z-10 size-40 rounded-full bg-gold/15 blur-3xl" />
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/15 text-2xl sm:size-14 sm:text-3xl">🎙️</span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full border border-sapphire/25 bg-sapphire/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-ink">
                  {isBn ? 'শুনুন · বলুন · শিখুন' : 'Listen · Speak · Grow'}
                </span>
                <h2 className="mt-3 text-xl font-black leading-snug tracking-tight text-ink sm:text-2xl">{copy.practiceTitle}</h2>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink/85 sm:text-base">{copy.practiceHelp}</p>
              </div>
            </div>
            {speechPractice.status === 'complete' ? (
              <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center text-lg font-extrabold text-emerald-800">
                {copy.practiceFinished}
              </div>
            ) : null}
            {practiceFeedback ? (
              <p role="status" className="practice-completion-feedback rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center font-bold text-emerald-800">
                🎉 {practiceFeedback}
              </p>
            ) : null}
            {speechPractice.status !== 'complete' ? <div className="space-y-5">
              {practiceLines.slice(activePracticeLineIndex, activePracticeLineIndex + 1).map((line, visiblePracticeIndex) => {
                const lineIndex = activePracticeLineIndex + visiblePracticeIndex;
                const isCurrentPractice = speechPractice.lineIndex === lineIndex;
                const isListening = isCurrentPractice && speechPractice.status === 'listening';
                const comparison = isCurrentPractice ? speechPractice.comparison : null;
                const attempts = attemptsByLine[lineIndex] || 0;
                const attemptsExhausted = !canAttemptSpeechPractice(attempts);
                const hasResult = isCurrentPractice && speechPractice.status === 'result';
                const progress = Math.round(((lineIndex + 1) / practiceLines.length) * 100);
                return (
                  <div key={`practice-step-${lineIndex}-${line.character}`} className="space-y-3">
                    <div className="space-y-2 px-1" aria-label={copy.practiceProgressLabel}>
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
                        <span>{copy.practiceProgress} {lineIndex + 1} / {practiceLines.length}</span>
                        <span>{progress}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={copy.practiceProgressLabel}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        className="h-2.5 overflow-hidden rounded-full bg-ink/15"
                      >
                        <div className="h-full rounded-full bg-sapphire transition-[width] duration-300" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <article
                    className={`relative space-y-5 rounded-3xl border p-5 shadow-sm transition-colors duration-300 sm:p-7 ${
                      isListening
                        ? 'border-sapphire/60 bg-sapphire/10 shadow-lg shadow-sapphire/10'
                        : hasResult
                          ? 'border-emerald-500/35 bg-emerald-500/5'
                          : 'border-gold/20 bg-paper/75'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex min-h-8 items-center rounded-full bg-gold/15 px-3 text-xs font-extrabold uppercase tracking-wide text-ink">
                        {isBn ? `বাক্য ${lineIndex + 1}` : `Sentence ${lineIndex + 1}`}
                      </span>
                      <div className="flex items-center gap-2" aria-label={`${copy.attempts}: ${attempts}/${MAX_SPEECH_PRACTICE_ATTEMPTS}`}>
                        {Array.from({ length: MAX_SPEECH_PRACTICE_ATTEMPTS }, (_, attemptIndex) => (
                          <span
                            key={attemptIndex}
                            aria-hidden="true"
                            className={`size-3 rounded-full transition-colors ${attemptIndex < attempts ? 'bg-gold' : 'bg-ink/20'}`}
                          />
                        ))}
                        <span className="text-sm font-semibold text-ink/85">{copy.attemptCount(attempts, MAX_SPEECH_PRACTICE_ATTEMPTS)}</span>
                      </div>
                    </div>
                    <p className="max-w-[46ch] text-xl font-bold leading-[1.8] text-ink sm:text-2xl">
                      {spokenTextParts(
                        line.text,
                        0,
                        false,
                        (word, keyId) => handleWordLookup(word, keyId, line.text),
                        selectedWord,
                        `practice-${lineIndex}`,
                        handleSpeakWord,
                        copy.pronunciationLabel,
                      )}
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => handleSpeakText(line.text)}
                        className="secondary-button min-h-12 w-full px-5 py-3 text-sm font-extrabold sm:w-auto"
                      >
                        🔊 {copy.listenExample}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void practiceLine(lineIndex); }}
                        aria-pressed={isListening}
                        disabled={attemptsExhausted && !isListening}
                        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold shadow-md transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/35 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
                          isListening
                            ? 'bg-red-600 text-white shadow-red-600/20'
                            : 'bg-gradient-to-r from-sapphire-deep to-sapphire text-white shadow-sapphire/20'
                        }`}
                      >
                        <span aria-hidden="true" className="text-base">
                          {isListening ? '■' : isCurrentPractice && speechPractice.status === 'result' ? '↻' : '🎤'}
                        </span>
                        {isListening
                          ? copy.stopSpeaking
                          : isCurrentPractice && speechPractice.status === 'result'
                            ? attemptsExhausted ? copy.attemptsLimit : copy.retrySpeaking
                            : attemptsExhausted ? copy.attemptsLimit : copy.speakLine}
                      </button>
                    </div>
                    {isListening ? (
                      <p role="status" className="flex items-center gap-3 rounded-xl border border-sapphire/25 bg-sapphire/10 px-4 py-3 text-sm font-bold text-ink">
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
                      <p role="alert" className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm font-semibold leading-relaxed text-ink">{speechPractice.message}</p>
                    ) : null}
                    {isCurrentPractice && speechPractice.status === 'result' && comparison ? (
                      <div role="status" aria-live="polite" className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm leading-relaxed text-ink sm:p-5">
                        <p className="flex items-center gap-3 font-extrabold text-ink">
                          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/15 font-bold text-ink">✓</span>
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
                              className={`rounded-md px-2 py-1 font-semibold text-ink ${
                                comparison.matchedWords[wordIndex]
                                  ? 'border border-emerald-500/30 bg-emerald-500/20'
                                  : 'border border-rose-500/30 bg-rose-500/20'
                              }`}
                            >
                              {word}
                            </span>
                          ))}
                        </p>
                        <p className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="font-semibold text-ink">✓ {copy.matchedWord}</span>
                          <span className="font-semibold text-ink">✕ {copy.missedWord}</span>
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => advancePracticeLine(lineIndex, true)}
                            className="primary-button min-h-12 w-full px-5 py-3 text-sm font-bold sm:w-auto"
                          >
                            {copy.completeLine}
                          </button>
                          <button
                            type="button"
                            onClick={() => advancePracticeLine(lineIndex)}
                            className="secondary-button min-h-12 w-full px-5 py-3 text-sm font-bold sm:w-auto"
                          >
                            {lineIndex < practiceLines.length - 1 ? copy.skipLine : copy.finishPractice}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {speechPractice.status !== 'result' ? (
                      <button
                        type="button"
                        onClick={() => advancePracticeLine(lineIndex)}
                        disabled={isListening}
                        className="secondary-button min-h-12 w-full px-5 py-3 text-sm font-bold sm:w-auto"
                      >
                        {lineIndex < practiceLines.length - 1 ? copy.skipLine : copy.finishPractice}
                      </button>
                    ) : null}
                    </article>
                  </div>
                );
              })}
            </div> : null}
            {microphoneConsentLine !== null ? (
              <div className="fixed inset-0 z-[120] grid place-items-center bg-black/65 p-4" role="presentation">
                <div role="dialog" aria-modal="true" aria-labelledby="microphone-permission-title" className="w-full max-w-md space-y-4 rounded-2xl border border-gold/40 bg-paper p-5 text-ink shadow-2xl">
                  <h4 id="microphone-permission-title" className="text-lg font-extrabold">{copy.microphonePermissionTitle}</h4>
                  <p className="text-sm leading-relaxed">{copy.microphonePermissionHelp}</p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setMicrophoneConsentLine(null)} className="secondary-button min-h-[44px] px-4 py-2 text-sm font-bold">{copy.cancelMicrophone}</button>
                    <button type="button" onClick={() => { void confirmMicrophonePermission(); }} className="primary-button min-h-[44px] px-4 py-2 text-sm font-bold">{copy.allowMicrophone}</button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {!practiceFullscreen && offlineAudioNotice ? (
          <p role="status" className="offline-audio-notice text-center text-xs leading-relaxed text-ink/70">
            {offlineAudioNotice}
          </p>
        ) : null}
        {!practiceFullscreen && offlineAudioError ? (
          <div role="alert" className="flex flex-wrap items-center justify-center gap-2 text-sm text-red-700">
            <span>{offlineAudioError}</span>
            {globalThis.navigator?.onLine !== false ? (
              <button type="button" onClick={() => { void cacheStoryAudioAutomatically(); }} className="underline underline-offset-2">
                {copy.retryOfflineAudio}
              </button>
            ) : null}
          </div>
        ) : null}

        {!practiceFullscreen ? <div
          role="list"
          aria-label={copy.story}
          tabIndex={0}
          className="audio-drama-story-stage w-full"
        >
          {(chunkMode
            ? lines.slice(readingChunkIndex, readingChunkIndex + 1)
            : lines).map((line, visibleIndex) => {
            const lineIndex = chunkMode ? readingChunkIndex : visibleIndex;
            const isCurrentLine = lineIndex === readingChunkIndex;
            const isCompletedLine = lineIndex < readingChunkIndex;
            const fraction = isPlaying && isCurrentLine ? currentLineFraction : 0;
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
                    {spokenTextParts(
                      line.text,
                      fraction,
                      isCompletedLine,
                      (word, keyId) => handleWordLookup(word, keyId, line.text),
                      selectedWord,
                      lineIndex,
                      handleSpeakWord,
                      copy.pronunciationLabel,
                    )}
                  </p>
                </div>
              </div>
            );
          })}
          {!lines.length ? <p className="min-h-10 text-sm leading-relaxed opacity-80">{copy.loading}</p> : null}
        </div> : null}

        {!practiceFullscreen && chunkMode && lines.length > 1 ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gold/20 bg-paper/60 px-3 py-2">
            <button
              type="button"
              disabled={readingChunkIndex === 0 || isPlaying}
              onClick={() => setReadingChunkIndex((current) => Math.max(0, current - 1))}
              className="min-h-10 rounded-lg border border-sapphire/25 bg-sapphire/10 px-3 py-2 text-xs font-bold text-sapphire transition hover:bg-sapphire/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copy.previousChunk}
            </button>
            <span className="text-xs font-bold text-ink/65">
              {copy.chunkProgress(readingChunkIndex + 1, lines.length)}
            </span>
            <button
              type="button"
              disabled={readingChunkIndex >= lines.length - 1 || isPlaying}
              onClick={() => setReadingChunkIndex((current) => Math.min(lines.length - 1, current + 1))}
              className="min-h-10 rounded-lg border border-sapphire/25 bg-sapphire/10 px-3 py-2 text-xs font-bold text-sapphire transition hover:bg-sapphire/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copy.nextChunk}
            </button>
          </div>
        ) : null}

        {!practiceFullscreen && error ? <p role="alert" className="text-sm font-medium text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
