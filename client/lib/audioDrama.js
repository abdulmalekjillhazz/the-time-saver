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
  return /(?:father|dad|papa|mother|mom|asha|rahim|rahi|story ?teller|narrator|child|son|daughter|rafi|রহিম|আশা|রাফি|মা|শিশু|বাচ্চা|গল্পকথক|বর্ণনাকারী)/.test(compact);
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

const savedStoryAudioCache = new Map();

async function createSavedAudioDrama(lines, signal, lang) {
  const content = `[Storyteller]: ${lines.map((line) => line.text).join(' ')}`;
  const cached = savedStoryAudioCache.get(content);
  if (cached) return cached;

  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin', signal });
  const csrfBody = await csrfResponse.json().catch(() => ({}));
  if (!csrfResponse.ok || typeof csrfBody.csrfToken !== 'string') {
    throw new Error(lang === 'bn' ? 'নিরাপত্তা যাচাই করা যায়নি। আবার চেষ্টা করুন।' : 'Could not establish a security token.');
  }

  const response = await fetch('/api/speech/audio-drama', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfBody.csrfToken,
    },
    body: JSON.stringify({ content }),
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message;
    throw new Error(typeof message === 'object'
      ? message[lang] || message.en || message.bn
      : lang === 'bn'
        ? 'অডিও Cloudinary-তে তৈরি ও সংরক্ষণ করা যায়নি।'
        : 'The audio could not be generated and saved to Cloudinary.');
  }

  const result = await response.json();
  if (typeof result.audioUrl !== 'string' || !result.audioUrl.startsWith('https://')) {
    throw new Error(lang === 'bn' ? 'সংরক্ষিত অডিওর তথ্য সঠিক নয়।' : 'The saved audio response was invalid.');
  }
  savedStoryAudioCache.set(content, result);
  return result;
}

function createCloudinaryAudio(url) {
  const audio = new globalThis.Audio(url);
  audio.preload = 'auto';
  return audio;
}

export function playDrama(lines, onProgress = () => {}, onEnd = () => {}, {
  lang = 'bn',
  volume = 1,
  onError = () => {},
  onNotice = () => {},
} = {}) {
  let index = 0;
  let isPlaying = false;
  let isPaused = false;
  let currentAudio = null;
  let requestAbortController = null;
  let savedAudioDramaPromise = null;
  let runId = 0;
  let currentVolume = Math.max(0, Math.min(1, volume));

  const emitProgress = (fraction = 0) => {
    const line = lines[index];
    if (!line) return;
    onProgress({
      index,
      fraction,
      percent: ((index + fraction) / lines.length) * 100,
      line,
      source: currentAudio ? 'cloudinary' : null,
      spatialAvailable: false,
    });
  };

  const cleanupAudio = () => {
    requestAbortController?.abort();
    requestAbortController = null;
    const cacheKey = `[Storyteller]: ${lines.map((line) => line.text).join(' ')}`;
    if (!savedStoryAudioCache.has(cacheKey)) savedAudioDramaPromise = null;
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.ontimeupdate = null;
      currentAudio.pause();
      currentAudio.removeAttribute('src');
      currentAudio.load();
    }
    currentAudio = null;
  };

  const fail = (message) => {
    isPlaying = false;
    isPaused = false;
    cleanupAudio();
    onError(lang === 'bn' && !/[\u0980-\u09FF]/.test(message)
      ? message === 'Audio could not resume.'
        ? 'অডিও আবার চালানো যায়নি।'
        : 'Cloudinary-তে সংরক্ষিত অডিও চালানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'
      : message);
  };

  const playSavedStory = async (id, startAt = 0) => {
    if (id !== runId || !isPlaying || !lines.length) return;
    const abortController = new AbortController();
    requestAbortController = abortController;
    try {
      savedAudioDramaPromise ??= createSavedAudioDrama(lines, abortController.signal, lang);
      const drama = await savedAudioDramaPromise;
      if (id !== runId || !isPlaying) return;
      onNotice(drama.cached
        ? (lang === 'bn'
          ? 'Cloudinary-তে রাখা ElevenLabs অডিও চালানো হচ্ছে—নতুন voice তৈরি হচ্ছে না।'
          : 'Playing the Cloudinary-saved ElevenLabs audio; no new voice is being generated.')
        : (lang === 'bn'
          ? 'ElevenLabs-এর অডিও Cloudinary-তে সংরক্ষণ করা হয়েছে।'
          : 'ElevenLabs audio has been saved to Cloudinary.'));
      currentAudio = createCloudinaryAudio(drama.audioUrl);
      currentAudio.volume = currentVolume;
      currentAudio.ontimeupdate = () => {
        if (!currentAudio || !Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) return;
        const position = (currentAudio.currentTime / currentAudio.duration) * lines.length;
        index = Math.min(Math.floor(position), lines.length - 1);
        emitProgress(Math.min(1, position - index));
      };
      currentAudio.onended = () => {
        if (id !== runId) return;
        isPlaying = false;
        isPaused = false;
        index = lines.length - 1;
        cleanupAudio();
        onProgress({ index: lines.length, fraction: 0, percent: 100, line: null, source: null, spatialAvailable: false });
        onEnd();
      };
      currentAudio.onerror = () => {
        if (id === runId) fail(lang === 'bn'
          ? 'Cloudinary থেকে সংরক্ষিত ElevenLabs অডিও চালানো যায়নি।'
          : 'The Cloudinary-saved ElevenLabs audio could not be played.');
      };
      currentAudio.onloadedmetadata = () => {
        if (startAt > 0 && Number.isFinite(currentAudio.duration)) {
          currentAudio.currentTime = currentAudio.duration * Math.min(startAt, lines.length - 1) / lines.length;
        }
      };
      await currentAudio.play();
      emitProgress(0);
    } catch (error) {
      if (id !== runId || error.name === 'AbortError') return;
      if (savedAudioDramaPromise && !savedStoryAudioCache.has(`[Storyteller]: ${lines.map((line) => line.text).join(' ')}`)) {
        savedAudioDramaPromise = null;
      }
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
      isPlaying = true;
      isPaused = false;
      void playSavedStory(runId, index);
    },
    pause() {
      if (!isPlaying || isPaused) return;
      isPaused = true;
      if (currentAudio) currentAudio.pause();
    },
    resume() {
      if (!isPlaying || !isPaused) return;
      isPaused = false;
      if (currentAudio) void currentAudio.play().catch(() => fail('Audio could not resume.'));
      else void playSavedStory(runId, index);
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
      if (currentAudio && Number.isFinite(currentAudio.duration)) {
        currentAudio.currentTime = currentAudio.duration * target / lines.length;
        emitProgress(0);
      } else {
        const shouldPlay = isPlaying && !isPaused;
        if (shouldPlay) {
          runId += 1;
          cleanupAudio();
          isPlaying = true;
          isPaused = false;
          void playSavedStory(runId, target);
        } else {
          emitProgress(0);
        }
      }
    },
    setVolume(value) {
      currentVolume = Math.max(0, Math.min(1, value));
      if (currentAudio) currentAudio.volume = currentVolume;
    },
    setSpatial() {
      return false;
    },
    close() {
      this.stop();
    },
  };
}
