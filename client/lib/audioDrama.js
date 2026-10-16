import { apiRequest, apiRequestAudio } from './apiClient.js';

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

export function playDrama(lines, onProgress = () => {}, onEnd = () => {}, {
  lang = 'bn',
  volume = 1,
  audioUrl = '',
  storyContent = '',
  onError = () => {},
  onNotice = () => {},
} = {}) {
  let index = 0;
  let isPlaying = false;
  let isPaused = false;
  let audio = null;
  let audioObjectUrl = null;
  let audioSource = null;
  let requestAbortController = null;
  let runId = 0;
  let googleFallbackStarted = false;
  let currentVolume = Math.max(0, Math.min(1, volume));
  let desiredStartIndex = 0;
  const content = storyContent || lines.map(({ character, text }) => `[${character}]: ${text}`).join('\n');
  const googleFallbackContent = lines.map(({ text }) => text).join(' ');

  const emitProgress = (position) => {
    if (!lines.length) return;
    const boundedPosition = Math.max(0, Math.min(lines.length, position));
    index = Math.min(Math.floor(boundedPosition), lines.length - 1);
    const fraction = index === lines.length - 1 && boundedPosition === lines.length
      ? 1
      : boundedPosition - index;
    onProgress({
      index,
      fraction,
      percent: ((index + fraction) / lines.length) * 100,
      line: lines[index],
      source: audioSource,
      spatialAvailable: false,
    });
  };

  const cleanupAudio = () => {
    requestAbortController?.abort();
    requestAbortController = null;
    if (audio) {
      audio.pause();
      audio.onloadedmetadata = null;
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audio.removeAttribute?.('src');
      audio.load?.();
      audio = null;
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
    onError(message || (lang === 'bn' ? 'অডিও চালানো যায়নি।' : 'Could not play the story audio.'));
  };

  const configureAudio = (id, src, source) => {
    audioSource = source;
    audio = new globalThis.Audio();
    audio.preload = 'auto';
    audio.volume = currentVolume;
    audio.onloadedmetadata = () => {
      if (id !== runId || !audio) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = (audio.duration * Math.min(desiredStartIndex, lines.length - 1)) / lines.length;
        emitProgress(desiredStartIndex);
      }
      if (!isPaused) void startAudio(id);
    };
    audio.ontimeupdate = () => {
      if (id !== runId || !audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      emitProgress((audio.currentTime / audio.duration) * lines.length);
    };
    audio.onended = () => finishPlayback(id);
    audio.onerror = () => {
      if (id !== runId) return;
      if (source === 'cloudinary') void fallbackToGoogle(id);
      else fail(lang === 'bn'
        ? 'Cloudinary ও Google TTS—কোনোটিই থেকে অডিও চালানো যায়নি। আবার চেষ্টা করুন।'
        : 'Audio could not be played from Cloudinary or Google TTS. Please try again.');
    };
    audio.src = src;
    audio.load();
  };

  const fallbackToGoogle = async (id) => {
    if (id !== runId || !isPlaying || googleFallbackStarted) return;
    googleFallbackStarted = true;
    cleanupAudio();
    const abortController = new AbortController();
    requestAbortController = abortController;
    onNotice(lang === 'bn'
      ? 'সংরক্ষিত গল্পের voice পাওয়া যাচ্ছে না—Google TTS দিয়ে চেষ্টা করা হচ্ছে…'
      : 'Saved story audio is unavailable—trying Google TTS…');
    try {
      const buffer = await apiRequestAudio('/api/speech/audio-drama/free', {
        body: { content: googleFallbackContent, lang },
        locale: lang,
        signal: abortController.signal,
      });
      if (id !== runId || !isPlaying) return;
      if (typeof globalThis.URL?.createObjectURL !== 'function') {
        throw new Error('This browser cannot play fallback audio.');
      }
      audioObjectUrl = globalThis.URL.createObjectURL(new Blob([buffer], { type: 'audio/mpeg' }));
      onNotice(lang === 'bn'
        ? 'সংরক্ষিত গল্পের voice পাওয়া যায়নি—Google TTS চালানো হচ্ছে।'
        : 'Saved story audio was unavailable—playing Google TTS.');
      configureAudio(id, audioObjectUrl, 'google');
    } catch (error) {
      if (id !== runId || error.name === 'AbortError') return;
      fail(error.message || (lang === 'bn'
        ? 'Cloudinary ও Google TTS থেকে অডিও চালানো যায়নি।'
        : 'Could not play audio from Cloudinary or Google TTS.'));
    } finally {
      if (requestAbortController === abortController) requestAbortController = null;
    }
  };

  const finishPlayback = (id) => {
    if (id !== runId) return;
    isPlaying = false;
    isPaused = false;
    emitProgress(lines.length);
    onEnd();
  };

  const startAudio = async (id) => {
    if (id !== runId || !isPlaying || isPaused || !audio) return;
    try {
      await audio.play();
    } catch (error) {
      if (id !== runId) return;
      if (audioSource === 'cloudinary' && error.name !== 'NotAllowedError') {
        void fallbackToGoogle(id);
      } else {
        fail(error.message);
      }
    }
  };

  const loadAndPlayStory = async (id) => {
    if (id !== runId || !isPlaying || !lines.length) return;
    const abortController = new AbortController();
    requestAbortController = abortController;
    try {
      const result = audioUrl
        ? { audioUrl, cached: true }
        : await apiRequest('/api/speech/audio-drama', {
          method: 'POST',
          body: { content },
          locale: lang,
          signal: abortController.signal,
        });
      if (id !== runId || !isPlaying) return;
      if (typeof result.audioUrl !== 'string' || !result.audioUrl) {
        throw new Error(lang === 'bn'
          ? 'Cloudinary থেকে গল্পের অডিও লিংক পাওয়া যায়নি।'
          : 'The saved story audio link could not be retrieved.');
      }

      onNotice(result.cached
        ? (lang === 'bn' ? 'Cloudinary-তে সংরক্ষিত voice চালানো হচ্ছে।' : 'Playing the saved voice from Cloudinary.')
        : (lang === 'bn' ? 'ElevenLabs voice Cloudinary-তে সংরক্ষণ করা হয়েছে।' : 'The ElevenLabs voice has been saved to Cloudinary.'));
      configureAudio(id, result.audioUrl, 'cloudinary');
    } catch (error) {
      if (id !== runId || error.name === 'AbortError') return;
      void fallbackToGoogle(id);
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
      googleFallbackStarted = false;
      desiredStartIndex = Math.max(0, Math.min(lines.length - 0.001, Number(startAt) || 0));
      index = Math.floor(desiredStartIndex);
      isPlaying = true;
      isPaused = false;
      emitProgress(desiredStartIndex);
      onNotice(lang === 'bn' ? 'Cloudinary-তে সংরক্ষিত voice খোঁজা হচ্ছে…' : 'Checking for saved story audio…');
      void loadAndPlayStory(runId, index);
    },
    pause() {
      if (!isPlaying || isPaused) return;
      isPaused = true;
      audio?.pause();
    },
    resume() {
      if (!isPlaying || !isPaused) return;
      isPaused = false;
      if (audio) void startAudio(runId);
    },
    stop() {
      runId += 1;
      isPlaying = false;
      isPaused = false;
      cleanupAudio();
    },
    seek(position) {
      const target = Number.isFinite(Number(position))
        ? Math.max(0, Math.min(lines.length - 0.001, Number(position)))
        : 0;
      index = Math.min(Math.floor(target), lines.length - 1);
      desiredStartIndex = target;
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = audio.duration * target / lines.length;
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
      this.stop();
    },
  };
}
