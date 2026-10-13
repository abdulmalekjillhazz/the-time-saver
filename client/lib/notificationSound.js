import { Howl } from 'howler';

export const ALARM_SOUNDS = [
  { id: 'birds', category: 'nature', en: 'Morning birds', bn: 'সকালের পাখির ডাক' },
  { id: 'forest-birds', category: 'nature', en: 'Forest birds', bn: 'বনের পাখির ডাক' },
  { id: 'ocean', category: 'nature', en: 'Ocean waves', bn: 'সমুদ্রের ঢেউ' },
  { id: 'river', category: 'nature', en: 'Flowing river', bn: 'বয়ে চলা নদী' },
  { id: 'pond', category: 'nature', en: 'Pond & frogs', bn: 'পুকুর ও ব্যাঙের ডাক' },
  { id: 'forest', category: 'nature', en: 'Forest breeze', bn: 'বনের বাতাস' },
  { id: 'rain', category: 'weather', en: 'Gentle rain', bn: 'হালকা বৃষ্টি' },
  { id: 'downpour', category: 'weather', en: 'Steady rainfall', bn: 'একটানা বৃষ্টি' },
  { id: 'wind', category: 'weather', en: 'Soft wind', bn: 'মৃদু বাতাস' },
  { id: 'thunder', category: 'weather', en: 'Distant thunder', bn: 'দূরের বজ্রধ্বনি' },
  { id: 'fire', category: 'nature', en: 'Fire crackle', bn: 'আগুনের মৃদু শব্দ' },
  { id: 'cafe', category: 'people', en: 'Café murmur', bn: 'ক্যাফের মানুষের গুঞ্জন' },
  { id: 'crowd', category: 'people', en: 'People talking', bn: 'মানুষের কথাবার্তার গুঞ্জন' },
  { id: 'keyboard', category: 'people', en: 'Keyboard typing', bn: 'কিবোর্ডে টাইপের শব্দ' },
  { id: 'fan', category: 'focus', en: 'Quiet fan', bn: 'ফ্যানের মৃদু শব্দ' },
  { id: 'white-noise', category: 'focus', en: 'White noise', bn: 'হোয়াইট নয়েজ' },
  { id: 'pink-noise', category: 'focus', en: 'Pink noise', bn: 'পিংক নয়েজ' },
  { id: 'brown-noise', category: 'focus', en: 'Brown noise', bn: 'ব্রাউন নয়েজ' },
  { id: 'heartbeat', category: 'focus', en: 'Calm heartbeat', bn: 'শান্ত হৃদস্পন্দন' },
  { id: 'chimes', category: 'focus', en: 'Soft chimes', bn: 'মৃদু ঘণ্টাধ্বনি' },
];

const SAMPLE_RATE = 22050;
const DURATION_SECONDS = 3.2;

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

function makeSoundDataUri(soundId) {
  const selected = ALARM_SOUNDS.find((sound) => sound.id === soundId) || ALARM_SOUNDS[0];
  const sampleCount = Math.floor(SAMPLE_RATE * DURATION_SECONDS);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  const seed = selected.id.split('').reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7) || 1;
  let randomState = seed;
  let lowNoise = 0;
  let brownNoise = 0;
  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 0xffffffff * 2 - 1;
  };

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / SAMPLE_RATE;
    const white = random();
    lowNoise += (white - lowNoise) * 0.035;
    brownNoise = (brownNoise + 0.018 * white) / 1.018;
    const slowWave = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.22 * time);
    const midWave = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.65 * time);
    const rumble = Math.sin(2 * Math.PI * 54 * time) * 0.18
      + Math.sin(2 * Math.PI * 81 * time) * 0.1;
    const chirpWindow = (time % 1.25) / 1.25;
    const chirpEnvelope = chirpWindow < 0.34 ? Math.sin(Math.PI * chirpWindow / 0.34) ** 2 : 0;
    const birdChirp = chirpEnvelope * (
      Math.sin(2 * Math.PI * (1750 + 780 * chirpWindow) * time)
      + Math.sin(2 * Math.PI * (2470 - 430 * chirpWindow) * time) * 0.45
    ) * 0.24;
    const frogPulse = Math.max(0, Math.sin(2 * Math.PI * 1.7 * time)) ** 8;
    const frogCroak = frogPulse * (Math.sin(2 * Math.PI * 190 * time) + Math.sin(2 * Math.PI * 225 * time) * 0.5) * 0.3;
    const voiceLfo = 0.55 + 0.45 * Math.sin(2 * Math.PI * (1.3 + seed % 5 * 0.13) * time);
    const voice = (
      Math.sin(2 * Math.PI * 118 * time)
      + Math.sin(2 * Math.PI * 176 * time) * 0.5
      + Math.sin(2 * Math.PI * 354 * time) * 0.22
      + Math.sin(2 * Math.PI * 510 * time) * 0.12
    ) * voiceLfo * 0.14;
    const drop = white > 0.995 ? white * 0.45 : 0;
    const crackle = white > 0.997 ? white * 0.72 : 0;
    const heartbeatPhase = (time % 1.15);
    const heartbeat = heartbeatPhase < 0.16
      ? Math.sin(2 * Math.PI * 72 * heartbeatPhase) * Math.sin(Math.PI * heartbeatPhase / 0.16)
      : heartbeatPhase > 0.2 && heartbeatPhase < 0.34
        ? Math.sin(2 * Math.PI * 65 * (heartbeatPhase - 0.2)) * Math.sin(Math.PI * (heartbeatPhase - 0.2) / 0.14) * 0.75
        : 0;
    const chimePhase = time % 1.1;
    const chime = chimePhase < 0.72
      ? (Math.sin(2 * Math.PI * 880 * chimePhase) + Math.sin(2 * Math.PI * 1320 * chimePhase) * 0.35)
        * Math.exp(-chimePhase * 4) * 0.22
      : 0;

    let sample;
    switch (selected.id) {
      case 'birds':
      case 'forest-birds':
        sample = lowNoise * 0.18 + birdChirp * (selected.id === 'forest-birds' ? 0.8 : 1);
        break;
      case 'ocean':
        sample = (brownNoise * 1.8 + lowNoise * 0.3) * (0.18 + slowWave * 0.48);
        break;
      case 'river':
        sample = (white * 0.28 + (white - lowNoise) * 0.35) * (0.7 + midWave * 0.3);
        break;
      case 'pond':
        sample = lowNoise * 0.15 + frogCroak + birdChirp * 0.18;
        break;
      case 'forest':
        sample = lowNoise * 0.32 + white * 0.08 + birdChirp * 0.3;
        break;
      case 'rain':
        sample = (white * 0.2 + (white - lowNoise) * 0.25) * (0.55 + slowWave * 0.22) + drop;
        break;
      case 'downpour':
        sample = (white * 0.3 + (white - lowNoise) * 0.3) * 0.8 + drop * 0.35;
        break;
      case 'wind':
        sample = (lowNoise * 1.2 + brownNoise) * (0.08 + slowWave * 0.36);
        break;
      case 'thunder':
        sample = (brownNoise * 2.5 + rumble) * (0.16 + slowWave * 0.3) + white * 0.04;
        break;
      case 'fire':
        sample = lowNoise * 0.14 + crackle * 0.4 + white * 0.035;
        break;
      case 'cafe':
        sample = voice * 0.65 + lowNoise * 0.1 + white * 0.035;
        break;
      case 'crowd':
        sample = voice + Math.sin(2 * Math.PI * 137 * time) * voiceLfo * 0.07 + lowNoise * 0.08;
        break;
      case 'keyboard':
        sample = (white > 0.991 ? white * (0.35 + random() * 0.35) : 0) + lowNoise * 0.025;
        break;
      case 'fan':
        sample = rumble * 0.75 + lowNoise * 0.28;
        break;
      case 'white-noise':
        sample = white * 0.34;
        break;
      case 'pink-noise':
        sample = (lowNoise * 2.8 + white * 0.1) * 0.32;
        break;
      case 'brown-noise':
        sample = brownNoise * 8;
        break;
      case 'heartbeat':
        sample = heartbeat * 0.6 + brownNoise * 0.2;
        break;
      case 'chimes':
        sample = chime + birdChirp * 0.13;
        break;
      default:
        sample = birdChirp;
    }

    const fadeLength = Math.floor(SAMPLE_RATE * 0.06);
    const fade = Math.min(1, i / fadeLength, (sampleCount - i - 1) / fadeLength);
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample * fade * 0.48)) * 32767, true);
  }

  let binary = '';
  const data = new Uint8Array(buffer);
  for (let start = 0; start < data.length; start += 0x8000) {
    binary += String.fromCharCode(...data.subarray(start, start + 0x8000));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

let alarmSound;
let activeSoundId;

export function playAlarmSound(soundId = ALARM_SOUNDS[0].id) {
  const sound = ALARM_SOUNDS.some((option) => option.id === soundId) ? soundId : ALARM_SOUNDS[0].id;
  if (alarmSound && activeSoundId !== sound) stopAlarmSound();
  if (!alarmSound) {
    alarmSound = new Howl({ src: [makeSoundDataUri(sound)], format: ['wav'], html5: true, loop: true, volume: 0.42 });
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
