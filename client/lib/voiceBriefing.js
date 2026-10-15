function getTimeZoneParts(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  } catch {
    return {
      weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date),
      year: String(date.getFullYear()),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      day: String(date.getDate()).padStart(2, '0'),
      hour: String(date.getHours()).padStart(2, '0'),
    };
  }
}

function getTimePeriod(hour) {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

const GREETINGS = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good night',
};

const GREETINGS_BN = {
  morning: 'শুভ সকাল',
  afternoon: 'শুভ অপরাহ্ণ',
  evening: 'শুভ সন্ধ্যা',
  night: 'শুভ রাত্রি',
};

const BRIEFING_LINES = {
  morning: [
    'Ease into the day. Pick one important task and give it your first five minutes.',
    'You do not need to do everything at once. Finish one small task, then choose the next.',
    'Move at your own pace today. Getting one task started is enough for now.',
  ],
  afternoon: [
    'Pause and choose what matters most for the rest of the day. Give that task your focus.',
    'Set one small goal for this afternoon, and remember to take a proper break.',
    'Notice what you have already done. Now pick one clear next step.',
  ],
  evening: [
    'Take stock of the day. Finish one small loose end, then give yourself time to rest.',
    'Write down one task for tomorrow before you wind down for the evening.',
    'Recognise your progress today. Keep the rest of the evening calm and simple.',
  ],
  night: [
    'It is night now. Note one thing for tomorrow, then let yourself rest.',
    'This is time to wind down. Write down anything important and get ready for sleep.',
    'Close the day gently. Tomorrow can wait; let yourself rest now.',
  ],
};

const BRIEFING_LINES_BN = {
  morning: [
    'দিনটা সহজভাবে শুরু করুন। একটি গুরুত্বপূর্ণ কাজ বেছে নিয়ে প্রথম পাঁচ মিনিট দিন।',
    'একসাথে সব করতে হবে না। একটি ছোট কাজ শেষ করুন, তারপর পরেরটি বেছে নিন।',
    'আজ নিজের গতিতে এগোন। একটি কাজ শুরু করাই এখন যথেষ্ট।',
  ],
  afternoon: [
    'থেমে ভাবুন, বাকি দিনের জন্য কোন কাজটা সবচেয়ে জরুরি। সেটাতেই মন দিন।',
    'এই বিকেলের জন্য একটি ছোট লক্ষ্য ঠিক করুন, আর ঠিকমতো বিরতি নিতে ভুলবেন না।',
    'এতক্ষণ যা করেছেন, লক্ষ্য করুন। এবার পরের স্পষ্ট পদক্ষেপটা বেছে নিন।',
  ],
  evening: [
    'দিনের হিসাব নিন। একটি ছোট অসমাপ্ত কাজ শেষ করে বিশ্রামের সময় নিন।',
    'সন্ধ্যায় জিরোনোর আগে আগামীকালের একটি কাজ লিখে রাখুন।',
    'আজকের অগ্রগতিকে স্বীকৃতি দিন। বাকি সন্ধ্যাটা শান্ত রাখুন।',
  ],
  night: [
    'এখন রাত। আগামীকালের একটি কথা লিখে রেখে বিশ্রাম নিন।',
    'এবার জিরোনোর সময়। জরুরি কিছু থাকলে লিখে রাখুন, ঘুমের প্রস্তুতি নিন।',
    'দিনটা শান্তভাবে শেষ করুন। আগামীকালের ভাবনা আগামীকাল; এখন বিশ্রাম নিন।',
  ],
};

function nextRoutine(routines, hour) {
  return (routines || [])
    .filter((routine) => !routine.completionStatus && /^\d{2}:\d{2}$/.test(routine.startTime || ''))
    .filter((routine) => Number(routine.startTime.slice(0, 2)) * 60 + Number(routine.startTime.slice(3, 5)) >= hour * 60)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
}

export function buildVoiceBriefing({
  name,
  hour,
  now = new Date(),
  timeZone,
  routines = [],
  lang = 'en',
}) {
  const isBn = lang === 'bn';
  const displayName = String(name || '').trim() || (isBn ? 'বন্ধু' : 'friend');
  const zoned = getTimeZoneParts(now, timeZone);
  const localHour = Number.isInteger(hour) ? hour : Number(zoned.hour);
  const period = getTimePeriod(localHour);
  const lines = isBn ? BRIEFING_LINES_BN[period] : BRIEFING_LINES[period];
  const greeting = isBn ? GREETINGS_BN[period] : GREETINGS[period];
  const dateSeed = `${zoned.year}-${zoned.month}-${zoned.day}-${period}`;
  const templateIndex = [...dateSeed].reduce((sum, character) => sum + character.charCodeAt(0), 0) % lines.length;
  const line = lines[templateIndex];
  const routine = nextRoutine(routines, localHour);
  const routineTitle = typeof routine?.title === 'string' ? routine.title.trim() : '';
  const routineLine = routineTitle
    ? (isBn ? ` আপনার পরের রুটিন ${routineTitle}।` : ` Your next routine is ${routineTitle}.`)
    : '';
  const text = `${greeting}, ${displayName}!${routineLine} ${line}`.replace(/\s+/g, ' ').trim();
  return { greeting, name: displayName, period, text, lang: isBn ? 'bn' : 'en' };
}

// The title of the next unfinished routine at or after this hour, if any.
export function getNextRoutineTitle(routines, hour) {
  const routine = nextRoutine(routines, hour);
  const title = typeof routine?.title === 'string' ? routine.title.trim() : '';
  return title || '';
}

// Spoken alarm call-out: the alarm name plus the next routine, so the user
// hears what the alarm is for and what comes next in their schedule.
export function buildAlarmAnnouncement({ alarmName = '', lang = 'en', nextRoutineTitle = '' } = {}) {
  const name = String(alarmName || '').trim();
  const routine = String(nextRoutineTitle || '').trim();
  if (lang === 'bn') {
    let text = name ? `আপনার অ্যালার্ম ${name} বাজছে।` : 'আপনার অ্যালার্ম বাজছে।';
    if (routine) text += ` আপনার পরের রুটিন ${routine}।`;
    return { lang: 'bn', text };
  }
  let text = name ? `Your alarm, ${name}, is ringing.` : 'Your alarm is ringing.';
  if (routine) text += ` Your next routine is ${routine}.`;
  return { lang: 'en', text };
}

// Catch-up summary spoken when the app reopens after alarms rang while away
// (closed-app push/Telegram delivered them; now the voice fills in).
export function buildMissedAnnouncement({ names = [], lang = 'en' } = {}) {
  const list = names.map((name) => String(name || '').trim()).filter(Boolean);
  if (lang === 'bn') {
    const text = list.length
      ? `আপনি দূরে থাকতে ${list.length}টি অ্যালার্ম বেজেছে: ${list.join(', ')}।`
      : 'আপনি দূরে থাকতে অ্যালার্ম বেজেছে।';
    return { lang: 'bn', text };
  }
  const text = list.length
    ? `While you were away, ${list.length} alarm${list.length === 1 ? '' : 's'} rang: ${list.join(', ')}.`
    : 'An alarm rang while you were away.';
  return { lang: 'en', text };
}

// Picks the best browser voice: a Google voice in the requested language
// first (Chrome and Android ship Google voices, including Google বাংলা),
// then a local voice in that language, then any voice in that language.
export function pickSpeechVoice(voices, lang = 'en-US') {
  const list = Array.isArray(voices) ? voices : [];
  const prefix = String(lang || 'en').split('-')[0].toLowerCase();
  const speaks = (voice) => typeof voice?.lang === 'string' && voice.lang.toLowerCase().startsWith(prefix);
  const isGoogle = (voice) => /google/i.test(String(voice?.name || ''));
  const isEnUS = (voice) => /^en-us/i.test(String(voice?.lang || ''));
  return list.find((voice) => speaks(voice) && isGoogle(voice))
    || (prefix === 'en' ? list.find((voice) => isEnUS(voice) && voice.localService) : undefined)
    || list.find((voice) => speaks(voice) && voice.localService)
    || (prefix === 'en' ? list.find((voice) => isEnUS(voice)) : undefined)
    || list.find((voice) => speaks(voice))
    || (prefix === 'bn' ? undefined : list.find((voice) => voice.default) || list[0]);
}

export function speakWithVoice(text, { lang = 'en-US', onEnd, onError, errorMessage } = {}) {
  const speechSynthesis = globalThis.window?.speechSynthesis;
  const Utterance = globalThis.SpeechSynthesisUtterance;
  if (!speechSynthesis || typeof Utterance !== 'function') {
    throw new Error('This browser does not provide a speech voice.');
  }

  const utterance = new Utterance(text);
  utterance.lang = lang;
  utterance.rate = 0.96;
  utterance.pitch = 1;
  const voice = pickSpeechVoice(speechSynthesis.getVoices(), lang);
  if (String(lang).toLowerCase().startsWith('bn') && !voice) {
    throw new Error('No Bengali text-to-speech voice is installed on this device.');
  }
  if (voice) utterance.voice = voice;

  let stopped = false;
  utterance.onend = () => {
    if (!stopped) onEnd?.();
  };
  utterance.onerror = (event) => {
    if (stopped) return;
    if (event.error === 'canceled') onEnd?.();
    else onError?.(new Error(errorMessage || 'The voice could not play this announcement.'));
  };

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    speechSynthesis.cancel();
  };
  return {
    pause: () => { if (!stopped) speechSynthesis.pause(); },
    resume: () => { if (!stopped) speechSynthesis.resume(); },
    stop,
    close: stop,
  };
}

export function speakWithGoogleTts(text, { lang = 'en', locale = 'en', onEnd, onError } = {}) {
  const AudioConstructor = globalThis.window?.Audio;
  if (typeof AudioConstructor !== 'function') {
    throw new Error('This browser cannot play audio.');
  }

  const requestController = new AbortController();
  let audio = null;
  let objectUrl = '';
  let paused = false;
  let stopped = false;
  let finished = false;

  const releaseAudio = () => {
    if (objectUrl) {
      globalThis.window.URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio = null;
    }
  };

  const finish = () => {
    if (stopped || finished) return;
    finished = true;
    releaseAudio();
    onEnd?.();
  };

  const fail = (error) => {
    if (stopped || finished) return;
    finished = true;
    releaseAudio();
    onError?.(error instanceof Error ? error : new Error('Google voice playback failed.'));
  };

  const play = () => {
    try {
      const result = audio?.play();
      if (result && typeof result.catch === 'function') result.catch(fail);
    } catch (error) {
      fail(error);
    }
  };

  void apiRequestAudio('/api/speech/briefing', {
    body: { text, lang },
    locale,
    signal: requestController.signal,
  }).then((blob) => {
    if (stopped) return;
    objectUrl = globalThis.window.URL.createObjectURL(blob);
    audio = new AudioConstructor(objectUrl);
    audio.onended = finish;
    audio.onerror = () => fail(new Error('Google voice audio could not be played.'));
    if (!paused) play();
  }).catch(fail);

  const stop = () => {
    if (stopped || finished) return;
    stopped = true;
    requestController.abort();
    releaseAudio();
  };

  return {
    pause: () => {
      if (stopped || finished) return;
      paused = true;
      audio?.pause();
    },
    resume: () => {
      if (stopped || finished) return;
      paused = false;
      if (audio) play();
    },
    stop,
    close: stop,
  };
}

export function createFreeEnglishSpeech(text, { onEnd, onError } = {}) {
  return speakWithVoice(text, {
    lang: 'en-US',
    onEnd,
    onError,
    errorMessage: 'The free English voice could not play this briefing.',
  });
}

export function buildDetailedRoutineBriefing({
  name,
  hour,
  now = new Date(),
  timeZone,
  routines = [],
  lang = 'bn',
}) {
  const base = buildVoiceBriefing({ name, hour, now, timeZone, routines, lang });
  const isBn = lang === 'bn';
  const sorted = [...(routines || [])]
    .filter((r) => r && typeof r.title === 'string' && r.title.trim())
    .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

  if (!sorted.length) {
    const emptyText = isBn
      ? `${base.greeting}, ${base.name}! আজ আপনার তালিকায় এখনো কোনো রুটিন যোগ করা হয়নি। একটি ছোট রুটিন যোগ করে আজকের দিনটি শুরু করুন।`
      : `${base.greeting}, ${base.name}! You do not have any routines scheduled for today yet. Add one small routine to begin your day.`;
    return { ...base, text: emptyText };
  }

  const doneList = sorted.filter((r) => r.completionStatus === 'done');
  const pendingList = sorted.filter((r) => r.completionStatus !== 'done');
  const frogTask = pendingList.find((r) => r.isFrog);

  if (isBn) {
    const parts = [`${base.greeting}, ${base.name}!`];
    parts.push(`আজ আপনার তালিকায় মোট ${sorted.length}টি রুটিন রয়েছে।`);
    if (doneList.length > 0) {
      parts.push(`আপনি ইতিমধ্যে সম্পন্ন করেছেন: ${doneList.map((r) => r.title.trim()).join(', ')}। দারুণ কাজ!`);
    }
    if (pendingList.length > 0) {
      const namedItems = pendingList
        .map((r) => `${r.startTime ? `${r.startTime} মিনিটে ` : ''}${r.title.trim()}`)
        .join(', ');
      parts.push(`আপনার আজকের রুটিনগুলো হলো: ${namedItems}।`);
    }
    if (frogTask) {
      parts.push(`আজ আপনার সবচেয়ে গুরুত্বপূর্ণ কাজ হলো ${frogTask.title.trim()}—এটি সবার আগে শেষ করার চেষ্টা করুন।`);
    }
    return { ...base, text: parts.join(' ') };
  }

  const parts = [`${base.greeting}, ${base.name}!`];
  parts.push(`You have ${sorted.length} routine${sorted.length === 1 ? '' : 's'} on your schedule today.`);
  if (doneList.length > 0) {
    parts.push(`You have already completed: ${doneList.map((r) => r.title.trim()).join(', ')}. Great job!`);
  }
  if (pendingList.length > 0) {
    const namedItems = pendingList
      .map((r) => `${r.title.trim()}${r.startTime ? ` at ${r.startTime}` : ''}`)
      .join(', ');
    parts.push(`Your upcoming routines are: ${namedItems}.`);
  }
  if (frogTask) {
    parts.push(`Your most important priority today is ${frogTask.title.trim()}—give it your focus first.`);
  }
  return { ...base, text: parts.join(' ') };
}
import { apiRequestAudio } from './apiClient.js';
