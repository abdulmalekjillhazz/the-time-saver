import { apiRequestAudio } from './apiClient.js';

const CHARACTERS = {
  narrator: { character: 'Narrator', pan: 0, pitch: 1, rate: 1 },
  storyteller: { character: 'Storyteller', pan: 0, pitch: 1, rate: 1 },
  male: { character: 'Male', pan: -0.45, pitch: 0.85, rate: 0.95 },
  female: { character: 'Female', pan: 0.45, pitch: 1.15, rate: 1 },
  child: { character: 'Child', pan: 0.2, pitch: 1.35, rate: 1.05 },
};
const MAX_SPEECH_CHARS = 150;

function looksLikeSpeakerName(name = '') {
  const normalized = String(name || '').trim();
  if (!normalized) return false;
  const compact = normalized.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ');
  return /(?:father|dad|papa|adult male|male|mother|mom|adult female|female|asha|rahim|rahi|story ?teller|narrator|child|son|daughter|rafi|রহিম|আশা|রাফি|মা|শিশু|বাচ্চা|গল্পকথক|বর্ণনাকারী)/.test(compact);
}

function characterSettings(name = '') {
  const normalized = String(name || '').toLowerCase();
  if (/storyteller|story teller|narrator|বর্ণনাকারী|গল্পকথক|কথক/.test(normalized)) return CHARACTERS.storyteller;
  if (/child|son|sibling|kid|boy|rafi|বাচ্চা|শিশু|ছেলে|রাফি|রফি/.test(normalized)) return CHARACTERS.child;
  if (/female|mother|mom|asha|আশা|মা|আপু|বোন|daughter|woman/.test(normalized)) return CHARACTERS.female;
  if (/male|father|dad|papa|rahim|রহিম|বাবা|ভাইয়া|man/.test(normalized)) return CHARACTERS.male;
  return CHARACTERS.narrator;
}

function splitText(text) {
  const chunks = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= MAX_SPEECH_CHARS) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = word;
    while (current.length > MAX_SPEECH_CHARS) {
      chunks.push(current.slice(0, MAX_SPEECH_CHARS));
      current = current.slice(MAX_SPEECH_CHARS);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function parseStoryScript(content = '', defaultSpeaker = 'Narrator') {
  const lines = [];
  if (typeof content !== 'string' || !content.trim()) return lines;

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let speaker = defaultSpeaker;
    let text = trimmed;

    const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*:?\s*(.*)$/);
    if (bracketMatch) {
      const candidate = bracketMatch[1].trim();
      const candidateText = bracketMatch[2].trim();
      if (candidate && looksLikeSpeakerName(candidate)) {
        speaker = candidate;
        text = candidateText;
      } else {
        speaker = defaultSpeaker;
        text = trimmed;
      }
    } else {
      const plainMatch = trimmed.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\u0980-\u09FF][\w\s'’.-]*?)\s*:\s*(.+)$/);
      if (plainMatch) {
        const candidate = plainMatch[1].trim();
        if (looksLikeSpeakerName(candidate)) {
          speaker = candidate;
          text = plainMatch[2].trim();
        } else {
          speaker = defaultSpeaker;
          text = trimmed;
        }
      }
    }

    if (!text || !text.trim()) continue;

    const settings = characterSettings(speaker || defaultSpeaker);
    for (const chunk of splitText(text)) {
      lines.push({
        character: speaker || defaultSpeaker,
        role: settings.character.toLowerCase(),
        text: chunk,
        pan: settings.pan,
        pitch: settings.pitch,
        rate: settings.rate,
      });
    }
  }
  if (lines.length && !lines.some(({ role }) => role === 'storyteller')) {
    const isBengali = /[\u0980-\u09ff]/.test(content);
    const storyteller = isBengali ? 'গল্পকথক' : 'Storyteller';
    const wrapLine = (text) => ({
      character: storyteller,
      role: 'storyteller',
      text,
      pan: CHARACTERS.storyteller.pan,
      pitch: CHARACTERS.storyteller.pitch,
      rate: CHARACTERS.storyteller.rate,
    });
    const middleIndex = Math.max(1, Math.ceil(lines.length / 2));
    lines.splice(middleIndex, 0, wrapLine(isBengali ? 'এরপর তারা একসঙ্গে সমাধান খুঁজতে থাকে।' : 'The family talks it through together.'));
    lines.unshift(wrapLine(isBengali ? 'গল্পটি শুরু হচ্ছে।' : 'The story begins.'));
    lines.push(wrapLine(isBengali ? 'এই ছিল আজকের গল্প।' : 'That is the end of the story.'));
  }
  return lines;
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

const freeStoryAudioCache = new Map();

export function playDrama(lines, onProgress = () => {}, onEnd = () => {}, {
  lang = 'bn',
  volume = 1,
  onError = () => {},
  onNotice = () => {},
} = {}) {
  let index = 0;
  let isPlaying = false;
  let isPaused = false;
  let audioContext = null;
  let gainNode = null;
  let audioBuffer = null;
  let currentSource = null;
  let requestAbortController = null;
  let audioRequestPromise = null;
  let progressTimer = null;
  let runId = 0;
  let currentVolume = Math.max(0, Math.min(1, volume));
  let playbackOffset = 0;
  let playbackStartedAt = 0;
  let desiredStartIndex = 0;
  const content = lines.map(({ text }) => text).join(' ');
  const audioLang = /[\u0980-\u09ff]/u.test(content) ? 'bn' : 'en';
  const cacheKey = `${audioLang}:${content}`;

  const emitProgress = (fraction = 0) => {
    const line = lines[index];
    if (!line) return;
    onProgress({
      index,
      fraction,
      percent: ((index + fraction) / lines.length) * 100,
      line,
      source: currentSource ? 'google-free' : null,
      spatialAvailable: false,
    });
  };

  const clearProgressTimer = () => {
    if (progressTimer !== null) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  };

  const closeAudioContext = () => {
    clearProgressTimer();
    if (audioContext && audioContext.state !== 'closed') void audioContext.close();
    audioContext = null;
    gainNode = null;
  };

  const stopSource = () => {
    if (!currentSource) return;
    const oldSource = currentSource;
    currentSource = null;
    oldSource.onended = null;
    oldSource.stop();
  };

  const cleanupAudio = (closeContext = true) => {
    requestAbortController?.abort();
    requestAbortController = null;
    stopSource();
    if (closeContext) closeAudioContext();
  };

  const fail = (message) => {
    isPlaying = false;
    isPaused = false;
    cleanupAudio();
    onError(message || (lang === 'bn' ? 'অডিও চালানো যায়নি।' : 'Could not play the story audio.'));
  };

  const updatePosition = (id) => {
    if (id !== runId || !currentSource || !audioBuffer) return;
    const elapsed = audioContext.currentTime - playbackStartedAt;
    const position = Math.min(lines.length, ((playbackOffset + elapsed) / audioBuffer.duration) * lines.length);
    index = Math.min(Math.floor(position), lines.length - 1);
    emitProgress(Math.min(1, position - index));
  };

  const finishPlayback = (id) => {
    if (id !== runId) return;
    isPlaying = false;
    isPaused = false;
    playbackOffset = 0;
    if (currentSource) {
      currentSource.onended = null;
      currentSource = null;
    }
    clearProgressTimer();
    closeAudioContext();
    index = lines.length - 1;
    onProgress({ index: lines.length, fraction: 0, percent: 100, line: null, source: null, spatialAvailable: false });
    onEnd();
  };

  const startAudio = async (id, offset = playbackOffset) => {
    if (id !== runId || !isPlaying || isPaused || !audioBuffer || !audioContext || currentSource) return;
    try {
      await audioContext.resume();
      if (id !== runId || !isPlaying || isPaused || !audioBuffer || !audioContext || currentSource) return;
      const safeOffset = Math.max(0, Math.min(offset, audioBuffer.duration - 0.01));
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      source.onended = () => {
        if (currentSource !== source || id !== runId) return;
        finishPlayback(id);
      };
      currentSource = source;
      playbackOffset = safeOffset;
      playbackStartedAt = audioContext.currentTime;
      const startIndex = Math.min(lines.length - 1, Math.floor((safeOffset / audioBuffer.duration) * lines.length));
      index = Math.max(0, startIndex);
      source.start(0, safeOffset);
      emitProgress((safeOffset / audioBuffer.duration) * lines.length - index);
      clearProgressTimer();
      progressTimer = setInterval(() => updatePosition(id), 100);
    } catch (error) {
      if (id === runId) fail(error.message);
    }
  };

  const loadAndPlayStory = async (id) => {
    if (id !== runId || !isPlaying || !lines.length) return;
    const abortController = new AbortController();
    requestAbortController = abortController;
    try {
      audioRequestPromise ??= freeStoryAudioCache.has(cacheKey)
        ? Promise.resolve(freeStoryAudioCache.get(cacheKey))
        : apiRequestAudio('/api/speech/audio-drama/free', {
          body: { content, lang: audioLang },
          locale: lang,
          signal: abortController.signal,
        }).then((audioData) => {
          freeStoryAudioCache.set(cacheKey, audioData);
          return audioData;
        });
      const audioData = await audioRequestPromise;
      if (id !== runId || !isPlaying || !audioContext) return;
      audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));
      if (id !== runId || !isPlaying || !audioContext) return;
      gainNode = audioContext.createGain();
      gainNode.gain.value = currentVolume;
      gainNode.connect(audioContext.destination);
      playbackOffset = (audioBuffer.duration * Math.min(desiredStartIndex, lines.length - 1)) / lines.length;
      onNotice(lang === 'bn'
        ? 'বিনামূল্যের Google voice-এ গল্পটি পড়া হচ্ছে।'
        : 'Reading the story with free Google voice.');
      if (!isPaused) await startAudio(id, playbackOffset);
    } catch (error) {
      if (id !== runId || error.name === 'AbortError') return;
      fail(error.message || (lang === 'bn' ? 'অডিও চালানো যায়নি।' : 'Could not play audio.'));
    } finally {
      if (requestAbortController === abortController) requestAbortController = null;
    }
  };

  return {
    play(startAt = 0) {
      if (!lines.length) {
        onEnd();
        return;
      }
      cleanupAudio();
      runId += 1;
      index = Math.max(0, Math.min(lines.length - 1, Math.floor(startAt)));
      desiredStartIndex = index;
      isPlaying = true;
      isPaused = false;
      playbackOffset = 0;
      audioRequestPromise = null;
      const AudioContextConstructor = globalThis.window?.AudioContext
        || globalThis.window?.webkitAudioContext;
      if (typeof AudioContextConstructor !== 'function') {
        fail(lang === 'bn' ? 'এই ব্রাউজারে অডিও চালানো যাচ্ছে না।' : 'This browser cannot play audio.');
        return;
      }
      try {
        audioContext = new AudioContextConstructor();
        void audioContext.resume().catch((error) => {
          if (isPlaying) fail(error.message);
        });
      } catch (error) {
        fail(error.message);
        return;
      }
      void loadAndPlayStory(runId, index);
    },
    pause() {
      if (!isPlaying || isPaused) return;
      isPaused = true;
      if (currentSource && audioContext && audioBuffer) {
        playbackOffset = Math.min(
          audioBuffer.duration,
          playbackOffset + audioContext.currentTime - playbackStartedAt,
        );
        stopSource();
        clearProgressTimer();
      }
    },
    resume() {
      if (!isPlaying || !isPaused) return;
      isPaused = false;
      if (audioBuffer) void startAudio(runId, playbackOffset);
      else if (audioContext) void audioContext.resume().catch((error) => fail(error.message));
    },
    stop() {
      runId += 1;
      isPlaying = false;
      isPaused = false;
      cleanupAudio();
    },
    seek(position) {
      const target = Math.max(0, Math.min(lines.length - 1, Math.floor(position)));
      index = target;
      desiredStartIndex = target;
      if (audioBuffer) {
        playbackOffset = audioBuffer.duration * target / lines.length;
        if (currentSource) {
          stopSource();
          clearProgressTimer();
          void startAudio(runId, playbackOffset);
        } else {
          emitProgress(0);
        }
      } else {
        const shouldPlay = isPlaying && !isPaused;
        if (shouldPlay) {
          playbackOffset = audioBuffer
            ? audioBuffer.duration * target / lines.length
            : playbackOffset;
          emitProgress(0);
        } else {
          emitProgress(0);
        }
      }
    },
    setVolume(value) {
      currentVolume = Math.max(0, Math.min(1, value));
      if (gainNode) gainNode.gain.value = currentVolume;
    },
    setSpatial() {
      return false;
    },
    close() {
      this.stop();
    },
  };
}
