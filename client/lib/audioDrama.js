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

async function createSavedAudioDrama(lines, signal, lang) {
  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin', signal });
  const csrfBody = await csrfResponse.json().catch(() => ({}));
  if (!csrfResponse.ok || typeof csrfBody.csrfToken !== 'string') {
    throw new Error(lang === 'bn' ? 'নিরাপত্তা যাচাই করা যায়নি। আবার চেষ্টা করুন।' : 'Could not establish a security token.');
  }

  const speakerNames = {
    male: 'Father',
    female: 'Mother',
    child: 'Son',
    storyteller: 'Storyteller',
    narrator: 'Storyteller',
  };
  const content = lines.map((line) => `[${speakerNames[line.role] || 'Storyteller'}]: ${line.text}`).join('\n');
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
  if (typeof result.audioUrl !== 'string' || !Array.isArray(result.segments)
      || result.segments.length !== lines.length
      || result.segments.some((segment) => typeof segment.url !== 'string')) {
    throw new Error(lang === 'bn' ? 'সংরক্ষিত অডিওর তথ্য সঠিক নয়।' : 'The saved audio response was invalid.');
  }
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
  spatial = true,
  onError = () => {},
  onNotice = () => {},
} = {}) {
  let index = 0;
  let isPlaying = false;
  let isPaused = false;
  let currentAudio = null;
  let currentObjectUrl = null;
  let currentAudioSource = null;
  let requestAbortController = null;
  let savedAudioDramaPromise = null;
  let audioContext = null;
  let audioSource = null;
  let panner = null;
  let runId = 0;
  let currentVolume = Math.max(0, Math.min(1, volume));
  let spatialEnabled = spatial;

  const emitProgress = (fraction = 0) => {
    const line = lines[index];
    if (!line) return;
    onProgress({
      index,
      fraction,
      percent: ((index + fraction) / lines.length) * 100,
      line,
      source: currentAudio ? currentAudioSource : 'native',
      spatialAvailable: Boolean(currentAudio && spatialEnabled && panner),
    });
  };

  const cleanupAudio = () => {
    requestAbortController?.abort();
    requestAbortController = null;
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.ontimeupdate = null;
      currentAudio.pause();
      currentAudio.removeAttribute('src');
      currentAudio.load();
    }
    if (audioSource) {
      try {
        audioSource.disconnect();
      } catch {
        // The source may already have been disconnected by the browser.
      }
    }
    currentAudio = null;
    currentAudioSource = null;
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
    audioSource = null;
    panner = null;
  };

  const stopCurrentLine = () => {
    cleanupAudio();
  };

  const fail = (message) => {
    isPlaying = false;
    isPaused = false;
    stopCurrentLine();
    onError(lang === 'bn' && !/[\u0980-\u09FF]/.test(message)
      ? message === 'Audio could not resume.'
        ? 'অডিও আবার চালানো যায়নি।'
        : 'Cloudinary-তে সংরক্ষিত অডিও চালানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'
      : message);
  };

  const finish = (id) => {
    if (id !== runId || !isPlaying) return;
    index += 1;
    if (index >= lines.length) {
      isPlaying = false;
      isPaused = false;
      cleanupAudio();
      onProgress({ index: lines.length, fraction: 0, percent: 100, line: null, source: null, spatialAvailable: false });
      onEnd();
      return;
    }
    void speakCurrent(id);
  };

  const playRemoteLine = async (line, id, source, loadAudio) => {
    let spatialFailed = source === 'cloudinary' && spatialEnabled;
    const AudioContextType = typeof globalThis.window === 'undefined'
      ? null
      : (globalThis.window.AudioContext || globalThis.window.webkitAudioContext);
    const useSpatialAudio = spatialEnabled && source !== 'cloudinary';

    if (useSpatialAudio && AudioContextType) {
      try {
        audioContext ??= new AudioContextType();
        await audioContext.resume();
        if (id !== runId || !isPlaying) return false;
      } catch {
        spatialFailed = true;
      }
    }

    requestAbortController = new AbortController();
    let audioResult;
    try {
      audioResult = await loadAudio(line.text, requestAbortController.signal);
    } catch (error) {
      if (id !== runId || error.name === 'AbortError') return false;
      fail(error.message || (lang === 'bn'
        ? 'ElevenLabs-এর অডিও Cloudinary-তে তৈরি বা সংরক্ষণ করা যায়নি।'
        : 'ElevenLabs audio could not be generated or saved to Cloudinary.'));
      return false;
    } finally {
      requestAbortController = null;
    }
    if (id !== runId || !isPlaying) {
      URL.revokeObjectURL(audioResult.objectUrl);
      return false;
    }
    currentAudio = audioResult.audio;
    currentObjectUrl = audioResult.objectUrl;
    currentAudioSource = source;
    currentAudio.volume = currentVolume;
    if (useSpatialAudio && audioContext && !spatialFailed) {
      try {
        audioSource = audioContext.createMediaElementSource(currentAudio);
        panner = audioContext.createStereoPanner();
        panner.pan.value = line.pan;
        audioSource.connect(panner);
        panner.connect(audioContext.destination);
      } catch {
        spatialFailed = true;
        if (audioSource) {
          try {
            audioSource.disconnect();
          } catch {
            // Ignore an already-disconnected Web Audio node.
          }
        }
        audioSource = null;
        panner = null;
      }
    }

    currentAudio.ontimeupdate = () => {
      if (!currentAudio || !Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) return;
      emitProgress(currentAudio.currentTime / currentAudio.duration);
    };
    currentAudio.onended = () => finish(id);
    currentAudio.onerror = () => {
      if (id !== runId) return;
      fail(lang === 'bn'
        ? 'Cloudinary থেকে সংরক্ষিত ElevenLabs অডিও চালানো যায়নি।'
        : 'The Cloudinary-saved ElevenLabs audio could not be played.');
    };
    currentAudio.onplaying = () => {
      if (spatialFailed) {
        onProgress({ index, fraction: 0, percent: (index / lines.length) * 100, line, source, spatialAvailable: false });
      }
      emitProgress(0);
    };
    try {
      await currentAudio.play();
    } catch {
      if (id === runId) fail(lang === 'bn'
        ? 'Cloudinary থেকে সংরক্ষিত ElevenLabs অডিও চালু করা যায়নি।'
        : 'Could not start the Cloudinary-saved ElevenLabs audio.');
      return false;
    }
    return true;
  };

  const speakCurrent = async (id) => {
    if (id !== runId || !isPlaying || index >= lines.length) return;
    const line = lines[index];
    emitProgress(0);
    if (!savedAudioDramaPromise) {
      requestAbortController = new AbortController();
      savedAudioDramaPromise = createSavedAudioDrama(lines, requestAbortController.signal, lang)
        .finally(() => {
          requestAbortController = null;
        });
    }
    try {
      const drama = await savedAudioDramaPromise;
      if (id !== runId || !isPlaying) return;
      onNotice(drama.cached
        ? (lang === 'bn'
          ? 'Cloudinary-তে রাখা ElevenLabs অডিও চালানো হচ্ছে—নতুন voice তৈরি হচ্ছে না।'
          : 'Playing the Cloudinary-saved ElevenLabs audio; no new voice is being generated.')
        : (lang === 'bn'
          ? 'ElevenLabs-এর অডিও Cloudinary-তে সংরক্ষণ করা হয়েছে।'
          : 'ElevenLabs audio has been saved to Cloudinary.'));
      const segment = drama.segments[index];
      await playRemoteLine(line, id, 'cloudinary', async () => ({
        audio: createCloudinaryAudio(segment.url),
        objectUrl: null,
      }));
    } catch (error) {
      if (id !== runId || error.name === 'AbortError') return;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        onNotice(lang === 'bn' ? '🌿 ডিভাইসের বিল্ট-ইন কণ্ঠে গল্প চালানো হচ্ছে' : '🌿 Playing using built-in device voice');
        const utterance = new window.SpeechSynthesisUtterance(line.text);
        utterance.lang = /[\u0980-\u09ff]/.test(line.text) ? 'bn-BD' : 'en-US';
        utterance.rate = line.rate || 1;
        utterance.pitch = line.pitch || 1;
        utterance.volume = currentVolume;
        utterance.onend = () => finish(id);
        utterance.onerror = () => finish(id);
        window.speechSynthesis.speak(utterance);
        return;
      }
      fail(error.message || (lang === 'bn' ? 'অডিও চালানো যায়নি।' : 'Could not play audio.'));
    }
  };

  return {
    play(startAt = 0) {
      if (!lines.length) {
        onEnd();
        return;
      }
      stopCurrentLine();
      runId += 1;
      index = Math.max(0, Math.min(lines.length - 1, Math.floor(startAt)));
      isPlaying = true;
      isPaused = false;
      void speakCurrent(runId);
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
      else void speakCurrent(runId);
    },
    stop() {
      runId += 1;
      isPlaying = false;
      isPaused = false;
      stopCurrentLine();
    },
    seek(position) {
      const target = Math.max(0, Math.min(lines.length - 1, Math.floor(position)));
      const shouldPlay = isPlaying && !isPaused;
      const shouldPause = isPlaying && isPaused;
      runId += 1;
      stopCurrentLine();
      index = target;
      if (shouldPlay) {
        isPlaying = true;
        isPaused = false;
        void speakCurrent(runId);
      } else if (shouldPause) {
        isPlaying = true;
        isPaused = true;
        emitProgress(0);
      } else {
        emitProgress(0);
      }
    },
    setVolume(value) {
      currentVolume = Math.max(0, Math.min(1, value));
      if (currentAudio) currentAudio.volume = currentVolume;
    },
    setSpatial(enabled) {
      spatialEnabled = Boolean(enabled);
      if (panner && currentAudio) {
        panner.pan.setTargetAtTime(spatialEnabled ? (lines[index]?.pan ?? 0) : 0, audioContext.currentTime, 0.02);
      }
    },
    close() {
      this.stop();
      if (audioContext && audioContext.state !== 'closed') void audioContext.close();
      audioContext = null;
    },
  };
}
