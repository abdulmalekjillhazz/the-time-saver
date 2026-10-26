import { apiRequest, apiRequestAudio } from './apiClient.js';
import { claimAudioPlayback } from './audioPlayback.js';
import { saveOfflineStoryAudio } from './offlineStoryCache.js';
import { parseStoryNarration } from '@smart-routine/shared';

const CHARACTERS = {
  narrator: { character: 'Narrator', pan: 0, pitch: 1, rate: 1 },
  storyteller: { character: 'Storyteller', pan: 0, pitch: 1, rate: 1 },
  male: { character: 'Male', pan: -0.45, pitch: 0.85, rate: 0.95 },
  female: { character: 'Female', pan: 0.45, pitch: 1.15, rate: 1 },
  child: { character: 'Child', pan: 0.2, pitch: 1.35, rate: 1.05 },
};
function characterSettings(name = '') {
  const normalized = String(name || '').toLowerCase();
  if (/storyteller|story teller|narrator|বর্ণনাকারী|গল্পকথক|কথক/.test(normalized)) return CHARACTERS.storyteller;
  if (/child|son|sibling|kid|boy|rafi|বাচ্চা|শিশু|ছেলে|রাফি|রফি/.test(normalized)) return CHARACTERS.child;
  if (/female|mother|mom|asha|আশা|মা|আপু|বোন|daughter|woman/.test(normalized)) return CHARACTERS.female;
  if (/male|father|dad|papa|rahim|রহিম|বাবা|ভাইয়া|man/.test(normalized)) return CHARACTERS.male;
  return CHARACTERS.narrator;
}

export function parseStoryScript(content = '', defaultSpeaker = 'Narrator', options) {
  return parseStoryNarration(content, defaultSpeaker, options).map(({ character, text }) => {
    const settings = characterSettings(character);
    return {
      character,
      role: settings.character.toLowerCase(),
      text,
      pan: settings.pan,
      pitch: settings.pitch,
      rate: settings.rate,
    };
  });
}

export function getStoryWordWeights(text) {
  const words = String(text || '').match(/\S+/gu) || [];
  return words.map((word) => {
    const characters = [...word].filter((character) => /[\p{L}\p{N}]/u.test(character)).length;
    const pause = /[.!?।]$/.test(word) ? 2 : /[,;:]$/.test(word) ? 1 : 0;
    return Math.max(1, characters) + pause;
  });
}

export function getStoryLineWeights(lines) {
  return lines.map(({ text }) => Math.max(1, getStoryWordWeights(text).reduce((sum, weight) => sum + weight, 0)));
}

export function getStoryPositionFromAudioProgress(progress, weights) {
  if (!weights.length) return 0;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = Math.max(0, Math.min(1, progress)) * totalWeight;
  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index];
    if (remaining <= weight || index === weights.length - 1) {
      return index + Math.max(0, Math.min(1, remaining / weight));
    }
    remaining -= weight;
  }
  return weights.length;
}

export function getStoryAudioProgressFromPosition(position, weights) {
  if (!weights.length) return 0;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const boundedPosition = Math.max(0, Math.min(weights.length, Number(position) || 0));
  const lineIndex = Math.min(Math.floor(boundedPosition), weights.length - 1);
  const lineFraction = boundedPosition === weights.length ? 1 : boundedPosition - lineIndex;
  const completedWeight = weights
    .slice(0, lineIndex)
    .reduce((sum, weight) => sum + weight, 0)
    + weights[lineIndex] * lineFraction;
  return completedWeight / totalWeight;
}

export function narrationSpeakerForRole(role) {
  return ({
    father: 'father',
    male: 'father',
    mother: 'mother',
    female: 'mother',
    son: 'son',
    child: 'son',
    storyteller: 'storyteller',
    narrator: 'storyteller',
  })[role] || 'storyteller';
}

export function playDrama(lines, onProgress = () => {}, onEnd = () => {}, {
  lang = 'bn',
  volume = 1,
  audioUrl = '',
  slug = '',
  storyContent = '',
  offlineAudioKey = '',
  offlineAudio = null,
  onError = () => {},
  onNotice = () => {},
  onStop = () => {},
  onSegmentsLoaded = () => {},
} = {}) {
  let index = 0;
  let isPlaying = false;
  let isPaused = false;
  let audio = null;
  let preloadedAudio = null;
  let preloadedSegmentIndex = -1;
  let audioObjectUrl = null;
  let audioSource = null;
  let timedSegments = null;
  let audioProgressSynchronized = true;
  let requestAbortController = null;
  let runId = 0;
  let currentVolume = Math.max(0, Math.min(1, volume));
  let desiredStartIndex = 0;
  const lineWeights = getStoryLineWeights(lines);
  let releasePlayback = () => {};
  let speechSynthActive = false;
  let _speechSynthLineIndex = 0;
  const content = storyContent || lines.map(({ character, text }) => `[${character}]: ${text}`).join('\n');

  const emitProgress = (position) => {
    if (!lines.length) return;
    const progressDetails = typeof position === 'object' ? position : null;
    const totalLines = timedSegments?.length || lines.length;
    const boundedPosition = Math.max(0, Math.min(totalLines, progressDetails
      ? progressDetails.index + progressDetails.fraction
      : position));
    const progressIndex = Math.min(Math.floor(boundedPosition), totalLines - 1);
    index = Math.min(progressIndex, lines.length - 1);
    const fraction = progressIndex === totalLines - 1 && boundedPosition === totalLines
      ? 1
      : boundedPosition - progressIndex;
    onProgress({
      index: progressDetails?.index ?? progressIndex,
      fraction,
      percent: ((progressIndex + fraction) / totalLines) * 100,
      line: timedSegments?.[progressIndex] || lines[index],
      wordIndex: progressDetails?.wordIndex,
      source: audioSource,
      spatialAvailable: false,
    });
  };

  const cleanupAudio = () => {
    requestAbortController?.abort();
    requestAbortController = null;
    if (speechSynthActive) {
      speechSynthActive = false;
      try {
        globalThis.speechSynthesis?.cancel?.();
      } catch {}
    }
    if (audio) {
      audio.pause();
      audio.onloadedmetadata = null;
      audio.onplaying = null;
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audio.removeAttribute?.('src');
      audio.load?.();
      audio = null;
    }
    if (preloadedAudio) {
      preloadedAudio.pause();
      preloadedAudio.removeAttribute?.('src');
      preloadedAudio.load?.();
      preloadedAudio = null;
      preloadedSegmentIndex = -1;
    }
    audioSource = null;
    if (audioObjectUrl) {
      globalThis.URL?.revokeObjectURL?.(audioObjectUrl);
      audioObjectUrl = null;
    }
  };

  const fail = (message) => {
    isPlaying = false;
    isPaused = false;
    cleanupAudio();
    releasePlayback();
    releasePlayback = () => {};
    onError(message || (lang === 'bn' ? 'অডিও চালানো যায়নি।' : 'Could not play the story audio.'));
  };

  const configureAudio = (id, src, source, syncProgress = true) => {
    audioSource = source;
    audioProgressSynchronized = syncProgress;
    audio = new globalThis.Audio();
    audio.preload = 'auto';
    audio.volume = currentVolume;
    const handleMetadata = () => {
      if (id !== runId || !audio) return;
      if (desiredStartIndex > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = audio.duration * getStoryAudioProgressFromPosition(
          Math.min(desiredStartIndex, lines.length - 1),
          lineWeights,
        );
      }
    };
    audio.onloadedmetadata = handleMetadata;
    audio.onplaying = () => {
      if (!syncProgress || id !== runId || !audio || audio.paused) return;
      const progress = Number.isFinite(audio.duration) && audio.duration > 0
        ? getStoryPositionFromAudioProgress(audio.currentTime / audio.duration, lineWeights)
        : desiredStartIndex;
      emitProgress(progress);
    };
    audio.ontimeupdate = () => {
      if (!syncProgress || id !== runId || !audio || audio.paused || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      emitProgress(getStoryPositionFromAudioProgress(audio.currentTime / audio.duration, lineWeights));
    };
    audio.onended = () => finishPlayback(id);
    audio.onerror = () => {
      if (id !== runId) return;
      if (source === 'cloudinary') {
        if (playOfflineAudio(id)) return;
        void fallbackToFreeTts(id);
        return;
      }
      if (source === 'offline') {
        if (playWithSpeechSynthesis(id)) return;
      }
      fail(lang === 'bn'
        ? source === 'offline'
          ? 'এই ডিভাইসে রাখা গল্পের অডিও চালানো যায়নি। আবার ডাউনলোড করুন।'
          : 'গল্পের অডিও চালানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'
        : source === 'offline'
          ? 'The offline story audio could not be played. Download it again.'
          : 'The story audio could not be played. Check your connection and try again.');
    };
    audio.src = src;
    audio.load();
    if (!isPaused) void startAudio(id);
  };

  const configureTimedSegment = (id, segmentIndex, startAtSeconds = 0, audioOverride = null) => {
    const segment = timedSegments?.[segmentIndex];
    if (id !== runId || !segment) return;
    if (audioOverride) {
      preloadedAudio = null;
      preloadedSegmentIndex = -1;
    }
    cleanupAudio();
    audioSource = 'cloudinary-segments';
    audioProgressSynchronized = true;
    audio = audioOverride || new globalThis.Audio();
    audio.preload = 'auto';
    audio.volume = currentVolume;
    audio.onloadedmetadata = () => {
      if (id !== runId || !audio) return;
      if (startAtSeconds > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(Math.max(0, startAtSeconds), audio.duration);
      }
    };
    audio.onplaying = () => {
      if (id !== runId || !audio || audio.paused) return;
      const wordIndex = Array.isArray(segment.words)
        ? segment.words.reduce((current, word, wordPosition) => (
          audio.currentTime >= word.start ? wordPosition : current
        ), -1)
        : -1;
      emitProgress({
        index: segmentIndex,
        fraction: audio.duration > 0 ? audio.currentTime / audio.duration : 0,
        wordIndex,
      });
    };
    audio.ontimeupdate = () => {
      if (id !== runId || !audio || audio.paused) return;
      const wordIndex = Array.isArray(segment.words)
        ? segment.words.reduce((current, word, wordPosition) => (
          audio.currentTime >= word.start ? wordPosition : current
        ), -1)
        : -1;
      emitProgress({
        index: segmentIndex,
        fraction: audio.duration > 0 ? audio.currentTime / audio.duration : 0,
        wordIndex,
      });
    };
    audio.onended = () => {
      if (id !== runId) return;
      if (segmentIndex + 1 < timedSegments.length) {
        const nextIndex = segmentIndex + 1;
        const nextAudio = preloadedSegmentIndex === nextIndex ? preloadedAudio : null;
        configureTimedSegment(id, nextIndex, 0, nextAudio);
      }
      else finishPlayback(id);
    };
    audio.onerror = () => {
      if (id !== runId) return;
      if (playOfflineAudio(id)) return;
      if (playWithSpeechSynthesis(id, segmentIndex)) return;
      fail(lang === 'bn'
        ? `গল্পের ${segmentIndex + 1} নম্বর বাক্যের অডিও চালানো যায়নি। আবার চেষ্টা করুন।`
        : `Story sentence ${segmentIndex + 1} could not be played. Please try again.`);
    };
    audio.src = segment.url || globalThis.URL.createObjectURL(segment.audio);
    if (!segment.url) audioObjectUrl = audio.src;
    audio.load();
    if (!isPaused) void startAudio(id);
    const nextSegmentIndex = segmentIndex + 1;
    const nextSegment = timedSegments[nextSegmentIndex];
    if (nextSegment?.url) {
      preloadedAudio = new globalThis.Audio();
      preloadedAudio.preload = 'auto';
      preloadedAudio.src = nextSegment.url;
      preloadedSegmentIndex = nextSegmentIndex;
      preloadedAudio.load();
    }
  };

  const playWithSpeechSynthesis = (id, startIndex = desiredStartIndex) => {
    if (
      typeof globalThis.speechSynthesis === 'undefined'
      || typeof globalThis.SpeechSynthesisUtterance === 'undefined'
      || !lines.length
    ) {
      return false;
    }
    cleanupAudio();
    audioSource = 'browser-speech';
    speechSynthActive = true;
    audioProgressSynchronized = true;
    onNotice(lang === 'bn' ? 'স্বাভাবিক কণ্ঠে গল্প শোনা হচ্ছে…' : 'Playing story audio…');

    const speakLine = (lineIdx) => {
      if (id !== runId || !isPlaying || !speechSynthActive) return;
      if (lineIdx >= lines.length) {
        speechSynthActive = false;
        finishPlayback(id);
        return;
      }
      _speechSynthLineIndex = lineIdx;
      index = lineIdx;
      const currentLine = lines[lineIdx];
      emitProgress({ index: lineIdx, fraction: 0, wordIndex: 0 });

      const utterance = new globalThis.SpeechSynthesisUtterance(currentLine.text);
      utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
      utterance.rate = currentLine.rate || 0.9;
      utterance.pitch = currentLine.pitch || 1.0;

      try {
        const voices = globalThis.speechSynthesis.getVoices?.() || [];
        const matchedVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) || null;
        if (matchedVoice) utterance.voice = matchedVoice;
      } catch {}

      utterance.onend = () => {
        if (id !== runId || !isPlaying || !speechSynthActive) return;
        emitProgress({ index: lineIdx, fraction: 1, wordIndex: -1 });
        speakLine(lineIdx + 1);
      };

      utterance.onerror = (event) => {
        if (id !== runId || !speechSynthActive) return;
        if (event?.error === 'canceled' || event?.error === 'interrupted') return;
        speakLine(lineIdx + 1);
      };

      if (!isPaused) {
        try {
          globalThis.speechSynthesis.speak(utterance);
        } catch {
          speakLine(lineIdx + 1);
        }
      }
    };

    speakLine(Math.min(Math.max(0, Math.floor(startIndex)), lines.length - 1));
    return true;
  };

  const playOfflineAudio = (id) => {
    if (id !== runId || !isPlaying || !offlineAudio || typeof globalThis.URL?.createObjectURL !== 'function') {
      return false;
    }
    if (Array.isArray(offlineAudio.segments) && offlineAudio.segments.length) {
      timedSegments = offlineAudio.segments;
      onSegmentsLoaded(timedSegments);
      onNotice(lang === 'bn' ? 'এই ডিভাইসে রাখা বাক্যভিত্তিক অডিও চালানো হচ্ছে।' : 'Playing sentence audio saved on this device.');
      configureTimedSegment(id, 0);
      return true;
    }
    cleanupAudio();
    audioObjectUrl = globalThis.URL.createObjectURL(offlineAudio);
    onNotice(lang === 'bn' ? 'এই ডিভাইসে রাখা অডিও চালানো হচ্ছে।' : 'Playing audio saved on this device.');
    configureAudio(id, audioObjectUrl, 'offline', true);
    return true;
  };

  const finishPlayback = (id) => {
    if (id !== runId) return;
    isPlaying = false;
    isPaused = false;
    if (timedSegments?.length) {
      const lastIndex = timedSegments.length - 1;
      emitProgress({
        index: lastIndex,
        fraction: 1,
        wordIndex: (timedSegments[lastIndex].words?.length || 1) - 1,
      });
    } else if (audioProgressSynchronized) {
      emitProgress(lines.length);
    }
    releasePlayback();
    releasePlayback = () => {};
    onEnd();
  };

  const startAudio = async (id) => {
    if (id !== runId || !isPlaying || isPaused || !audio) return;
    try {
      await audio.play();
    } catch (error) {
      if (id !== runId) return;
      if (audioSource === 'cloudinary' && error.name !== 'NotAllowedError') {
        if (playOfflineAudio(id)) return;
        void fallbackToFreeTts(id);
        return;
      }
      if (error.name === 'NotAllowedError') {
        onNotice(lang === 'bn' ? 'অডিও শুনতে প্লে বোতামে ট্যাপ করুন' : 'Tap play to listen to audio');
        return;
      }
      if (playWithSpeechSynthesis(id)) return;
      fail(error.message);
    }
  };

  const fallbackToFreeTts = async (id) => {
    if (id !== runId || !isPlaying) return;
    const abortController = new AbortController();
    requestAbortController = abortController;
    try {
      const audioData = await apiRequestAudio('/api/speech/audio-drama/free', {
        body: { content, lang },
        locale: lang,
        signal: abortController.signal,
      });
      if (id !== runId || !isPlaying) return;
      const fallbackAudio = new Blob([audioData], { type: 'audio/mpeg' });
      if (slug && typeof globalThis.indexedDB !== 'undefined') {
        void saveOfflineStoryAudio(slug, offlineAudioKey || content, fallbackAudio).catch(() => {});
      }
      if (typeof globalThis.URL?.createObjectURL !== 'function') {
        throw new Error('Audio playback is unavailable on this device.');
      }
      cleanupAudio();
      audioObjectUrl = globalThis.URL.createObjectURL(fallbackAudio);
      onNotice(lang === 'bn' ? 'স্বাভাবিক কণ্ঠে গল্প শোনা হচ্ছে…' : 'Playing story audio…');
      configureAudio(id, audioObjectUrl, 'offline', true);
    } catch {
      if (id !== runId) return;
      if (playWithSpeechSynthesis(id)) return;
      fail(lang === 'bn'
        ? 'গল্পের অডিও চালানো যাচ্ছে না। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'
        : 'Story audio could not be played. Check your connection and try again.');
    }
  };

  const loadAndPlayStory = async (id) => {
    if (id !== runId || !isPlaying || !lines.length) return;
    if (playOfflineAudio(id)) return;
    if (globalThis.navigator?.onLine === false) {
      if (playWithSpeechSynthesis(id)) return;
      fail(lang === 'bn'
        ? 'এই গল্পের অডিও এই ডিভাইসে ডাউনলোড করা নেই। ইন্টারনেটে যুক্ত হয়ে আগে অডিও ডাউনলোড করুন।'
        : 'This story audio is not saved on this device. Connect to the internet and download it first.');
      return;
    }
    const cleanAudioUrl = typeof audioUrl === 'string' && audioUrl.startsWith('http')
      ? audioUrl.replace(/^http:\/\//i, 'https://')
      : '';
    const abortController = new AbortController();
    requestAbortController = abortController;
    try {
      const result = await apiRequest('/api/speech/audio-drama', {
        method: 'POST',
        body: { content },
        locale: lang,
        signal: abortController.signal,
      });
      if (id !== runId || !isPlaying) return;
      if (Array.isArray(result.segments) && result.segments.length > 0) {
        if (result.segments.some((segment) => typeof segment.url !== 'string' || !segment.url)) {
          throw new Error('Story sentence audio is incomplete.');
        }
        timedSegments = result.segments;
        onSegmentsLoaded(timedSegments);
        const initialPosition = Math.max(0, Math.min(timedSegments.length - 0.001, desiredStartIndex));
        const initialIndex = Math.floor(initialPosition);
        const initialTime = (Number(timedSegments[initialIndex].durationSeconds) || 0)
          * (initialPosition - initialIndex);
        onNotice(lang === 'bn' ? 'গল্পের অডিও চালানো হচ্ছে…' : 'Playing story audio…');
        configureTimedSegment(id, initialIndex, initialTime);
        return;
      }
      if (typeof result.audioUrl !== 'string' || !result.audioUrl) {
        throw new Error(lang === 'bn'
          ? 'গল্পের অডিও পাওয়া যায়নি। আবার চেষ্টা করুন।'
          : 'Story audio is unavailable. Please try again.');
      }

      onNotice(lang === 'bn' ? 'গল্পের অডিও চালানো হচ্ছে…' : 'Playing story audio…');
      configureAudio(id, result.audioUrl, 'cloudinary', true);
    } catch (error) {
      if (id !== runId || error.name === 'AbortError') return;
      if (playOfflineAudio(id)) return;
      if (cleanAudioUrl) {
        onNotice(lang === 'bn' ? 'গল্পের অডিও চালানো হচ্ছে…' : 'Playing story audio…');
        configureAudio(id, cleanAudioUrl, 'cloudinary', true);
        return;
      }
      await fallbackToFreeTts(id);
    } finally {
      if (requestAbortController === abortController) requestAbortController = null;
    }
  };

  const player = {
    play(startAt = 0) {
      if (!lines.length) {
        onEnd();
        return;
      }
      cleanupAudio();
      releasePlayback();
      releasePlayback = () => {};
      runId += 1;
      desiredStartIndex = Math.max(0, Math.min(lines.length - 0.001, Number(startAt) || 0));
      index = Math.floor(desiredStartIndex);
      isPlaying = true;
      isPaused = false;
      timedSegments = null;
      onNotice(lang === 'bn' ? 'গল্পের অডিও প্রস্তুত হচ্ছে…' : 'Preparing story audio…');
      releasePlayback();
      releasePlayback = () => {};
      releasePlayback = claimAudioPlayback(() => {
        player.stop(true);
      });
      void loadAndPlayStory(runId, index);
    },
    pause() {
      if (!isPlaying || isPaused) return;
      isPaused = true;
      if (speechSynthActive) {
        try {
          globalThis.speechSynthesis?.pause?.();
        } catch {}
      }
      audio?.pause();
    },
    resume() {
      if (!isPlaying || !isPaused) return;
      isPaused = false;
      if (speechSynthActive) {
        try {
          globalThis.speechSynthesis?.resume?.();
        } catch {}
      } else if (audio) {
        void startAudio(runId);
      }
    },
    stop(notify = false) {
      runId += 1;
      isPlaying = false;
      isPaused = false;
      cleanupAudio();
      releasePlayback();
      releasePlayback = () => {};
      if (notify) onStop();
    },
    seek(position) {
      const target = Number.isFinite(Number(position))
        ? Math.max(0, Math.min(lines.length - 0.001, Number(position)))
        : 0;
      index = Math.min(Math.floor(target), lines.length - 1);
      desiredStartIndex = target;
      if (speechSynthActive) {
        try {
          globalThis.speechSynthesis?.cancel?.();
        } catch {}
        playWithSpeechSynthesis(runId, desiredStartIndex);
        return;
      }
      if (timedSegments?.length) {
        const segmentIndex = Math.floor(target);
        const segment = timedSegments[segmentIndex];
        const startAtSeconds = (Number(segment.durationSeconds) || 0) * (target - segmentIndex);
        configureTimedSegment(runId, segmentIndex, startAtSeconds);
        emitProgress({ index: segmentIndex, fraction: target - segmentIndex, wordIndex: -1 });
        return;
      }
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = audio.duration * getStoryAudioProgressFromPosition(target, lineWeights);
      }
      emitProgress(target);
    },
    setVolume(value) {
      currentVolume = Math.max(0, Math.min(1, value));
      if (audio) audio.volume = currentVolume;
    },
    setSpatial() {
      return false;
    },
    close() {
      player.stop();
    },
  };

  return player;
}
