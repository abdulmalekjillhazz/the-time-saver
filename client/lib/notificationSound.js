import { Howl } from 'howler';

export const ALARM_SOUNDS = [
  { id: 'dawn', category: 'melodic', en: 'Dawn Chorus', bn: 'ভোরের সুর' },
  { id: 'momentum', category: 'melodic', en: 'Momentum', bn: 'উদ্যম' },
  { id: 'sunrise', category: 'melodic', en: 'First Light', bn: 'নতুন আলোর সুর' },
  { id: 'aurora', category: 'melodic', en: 'Aurora', bn: 'মেরুজ্যোতি' },
  { id: 'horizon', category: 'melodic', en: 'Horizon', bn: 'দিগন্ত' },
  { id: 'spark', category: 'melodic', en: 'Spark', bn: 'নতুন উদ্দীপনা' },
  { id: 'clarity', category: 'melodic', en: 'Clarity', bn: 'স্বচ্ছ সুর' },
  { id: 'triumph', category: 'melodic', en: 'Triumph', bn: 'জয়ের সুর' },
];

const SAMPLE_RATE = 22050;
const DURATION_SECONDS = 3.2;
const soundUriCache = new Map();
const ALARM_PHRASES = {
  dawn: [[0.08, 659.25], [0.48, 783.99], [0.98, 987.77], [1.6, 783.99], [2.05, 880], [2.58, 1318.51]],
  momentum: [[0.08, 523.25], [0.34, 659.25], [0.62, 783.99], [0.94, 1046.5], [1.48, 783.99], [1.78, 1046.5], [2.16, 1318.51], [2.62, 1567.98]],
  sunrise: [[0.08, 587.33], [0.58, 698.46], [1.08, 880], [1.72, 1046.5], [2.35, 880], [2.72, 1174.66]],
  aurora: [[0.08, 783.99], [0.54, 987.77], [1.02, 1174.66], [1.62, 1567.98], [2.15, 1174.66], [2.62, 1975.53]],
  horizon: [[0.08, 440], [0.62, 554.37], [1.18, 659.25], [1.78, 880], [2.35, 659.25], [2.72, 987.77]],
  spark: [[0.08, 880], [0.34, 1174.66], [0.64, 987.77], [1.08, 1318.51], [1.55, 1046.5], [1.9, 1567.98], [2.42, 1318.51], [2.7, 1760]],
  clarity: [[0.08, 698.46], [0.58, 880], [1.16, 1046.5], [1.78, 1396.91], [2.36, 1046.5], [2.72, 1396.91]],
  triumph: [[0.08, 523.25], [0.42, 659.25], [0.78, 783.99], [1.18, 1046.5], [1.62, 1318.51], [2.04, 1046.5], [2.38, 1318.51], [2.7, 1567.98]],
};

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

function synthesizeAlarmSound(soundId) {
  const sampleCount = Math.floor(SAMPLE_RATE * DURATION_SECONDS);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);

  // WAV Header (44 bytes standard PCM RIFF/WAVE)
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  const phrase = ALARM_PHRASES[soundId] || ALARM_PHRASES.dawn;

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    for (const [noteStart, frequency] of phrase) {
      const age = t - noteStart;
      if (age < 0 || age > 0.58) continue;
      const attack = Math.min(1, age / 0.012);
      const decay = Math.exp(-age * 5.1);
      const envelope = attack * decay;
      const fundamental = Math.sin(2 * Math.PI * frequency * age);
      const secondHarmonic = Math.sin(2 * Math.PI * frequency * 2.756 * age) * 0.24;
      const thirdHarmonic = Math.sin(2 * Math.PI * frequency * 5.404 * age) * 0.08;
      const warmth = Math.sin(2 * Math.PI * frequency * 0.5 * age) * 0.16;
      sample += envelope * (fundamental * 0.56 + secondHarmonic + thirdHarmonic + warmth);
    }

    const loopFadeSeconds = 0.05;
    const fadeIn = Math.min(1, t / loopFadeSeconds);
    const fadeOut = Math.min(1, (DURATION_SECONDS - t) / loopFadeSeconds);
    const fade = Math.sin((fadeIn * Math.PI) / 2) * Math.sin((fadeOut * Math.PI) / 2);
    const intSample = Math.max(-32767, Math.min(32767, Math.round(sample * fade * 0.48 * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  // Convert binary buffer to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let c = 0; c < bytes.length; c += chunk) {
    binary += String.fromCharCode(...bytes.subarray(c, c + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function getAlarmSoundDataUri(soundId = ALARM_SOUNDS[0].id) {
  const sound = ALARM_SOUNDS.some((option) => option.id === soundId) ? soundId : ALARM_SOUNDS[0].id;
  if (!soundUriCache.has(sound)) {
    soundUriCache.set(sound, synthesizeAlarmSound(sound));
  }
  return soundUriCache.get(sound);
}

let alarmSound;
let activeSoundId;

export function playAlarmSound(soundId = ALARM_SOUNDS[0].id) {
  const sound = ALARM_SOUNDS.some((option) => option.id === soundId) ? soundId : ALARM_SOUNDS[0].id;
  if (alarmSound && activeSoundId !== sound) stopAlarmSound();
  if (!alarmSound) {
    alarmSound = new Howl({
      src: [getAlarmSoundDataUri(sound)],
      format: ['wav'],
      html5: true,
      loop: true,
      volume: 0.55,
    });
    activeSoundId = sound;
  }
  alarmSound.play();
}

export function stopAlarmSound() {
  if (!alarmSound) return;
  alarmSound.stop();
  alarmSound.unload();
  alarmSound = undefined;
  activeSoundId = undefined;
}
