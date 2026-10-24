import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAlarmAnnouncement,
  buildVoiceBriefing,
  buildMissedAnnouncement,
  createFreeEnglishSpeech,
  getMicrosoftEnglishVoices,
  getNextRoutineTitle,
  pickSpeechVoice,
  speakNaturalSpeech,
  speakWithVoice,
} from '../lib/voiceBriefing.js';

const originalWindow = globalThis.window;
const originalUtterance = globalThis.SpeechSynthesisUtterance;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalUtterance === undefined) delete globalThis.SpeechSynthesisUtterance;
  else globalThis.SpeechSynthesisUtterance = originalUtterance;
  globalThis.fetch = originalFetch;
});

describe('personalized English voice briefing', () => {
  it('uses the display name and time-appropriate greeting in English only', () => {
    const briefing = buildVoiceBriefing({ name: 'Ayesha', hour: 9 });
    expect(briefing.greeting).toBe('Good morning');
    expect(briefing.text).toContain('Good morning, Ayesha!');
    expect(briefing.text).not.toMatch(/[\u0980-\u09ff]/);
  });

  it('uses a fallback name and afternoon greeting', () => {
    const briefing = buildVoiceBriefing({ name: ' ', hour: 14 });
    expect(briefing.greeting).toBe('Good afternoon');
    expect(briefing.text).toContain('Good afternoon, friend!');
  });

  it('uses the account time zone and rotates its rule-based message by day', () => {
    const night = buildVoiceBriefing({
      name: 'Ayesha',
      now: new Date('2026-10-12T16:00:00.000Z'),
      timeZone: 'Asia/Dhaka',
    });
    expect(night.greeting).toBe('Good night');
    expect(night.period).toBe('night');
    expect(buildVoiceBriefing({
      name: 'Ayesha',
      now: new Date('2026-10-13T16:00:00.000Z'),
      timeZone: 'Asia/Dhaka',
    }).text).not.toBe(night.text);
  });

  it('includes the next unfinished routine in English', () => {
    const briefing = buildVoiceBriefing({
      name: 'Ayesha',
      hour: 9,
      routines: [
        { title: 'Read a chapter', startTime: '10:00', completionStatus: null },
        { title: 'Already done', startTime: '09:00', completionStatus: 'done' },
      ],
    });
    expect(briefing.text).toContain('Your next routine is Read a chapter.');
  });

  it('speaks with a free local English browser voice and supports playback controls', () => {
    const voices = [
      { lang: 'en-US', localService: false },
      { lang: 'en-GB', localService: true },
      { lang: 'en-US', localService: true },
      { lang: 'bn-BD', localService: true },
    ];
    const engine = {
      getVoices: () => voices,
      cancel: vi.fn(),
      speak: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    globalThis.window = { speechSynthesis: engine };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; }
    };
    const onEnd = vi.fn();
    const onError = vi.fn();
    const controller = createFreeEnglishSpeech('Good morning, Ayesha.', { onEnd, onError });
    const [utterance] = engine.speak.mock.calls[0];

    expect(utterance.text).toBe('Good morning, Ayesha.');
    expect(utterance.lang).toBe('en-US');
    expect(utterance.voice).toBe(voices[2]);
    expect(engine.cancel).toHaveBeenCalledOnce();
    controller.pause();
    controller.resume();
    expect(engine.pause).toHaveBeenCalledOnce();
    expect(engine.resume).toHaveBeenCalledOnce();

    utterance.onend();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    controller.stop();
  });

  it('reports when the browser does not provide speech synthesis', () => {
    globalThis.window = {};
    globalThis.SpeechSynthesisUtterance = undefined;
    expect(() => createFreeEnglishSpeech('Hello.')).toThrow('This browser does not provide a speech voice.');
    expect(() => speakWithVoice('Hello.', { lang: 'bn-BD' })).toThrow('This browser does not provide a speech voice.');
  });
});

describe('Google voice preference', () => {
  it('offers Microsoft English voices without including other vendors or languages', () => {
    const voices = [
      { name: 'Microsoft David', lang: 'en-US', voiceURI: 'microsoft-david' },
      { name: 'Microsoft Heami', lang: 'ko-KR', voiceURI: 'microsoft-heami' },
      { name: 'Google US English', lang: 'en-US', voiceURI: 'google-en' },
    ];
    expect(getMicrosoftEnglishVoices(voices)).toEqual([voices[0]]);
  });

  it('prefers a Google voice in the requested language', () => {
    const voices = [
      { name: 'Microsoft David', lang: 'en-US', localService: true },
      { name: 'Google US English', lang: 'en-US', localService: false },
      { name: 'Google বাংলা', lang: 'bn-BD', localService: false },
    ];
    expect(pickSpeechVoice(voices, 'en-US')).toBe(voices[1]);
    expect(pickSpeechVoice(voices, 'bn-BD')).toBe(voices[2]);
  });

  it('falls back to a local voice when no Google voice exists', () => {
    const voices = [
      { name: 'Local English', lang: 'en-GB', localService: true },
      { name: 'Local Bangla', lang: 'bn-BD', localService: true },
    ];
    expect(pickSpeechVoice(voices, 'en-US')).toBe(voices[0]);
    expect(pickSpeechVoice(voices, 'bn-BD')).toBe(voices[1]);
  });

  it('uses a selected Microsoft English voice when provided', () => {
    const selectedVoice = { name: 'Microsoft Aria', lang: 'en-US' };
    const engine = {
      getVoices: () => [{ name: 'Google US English', lang: 'en-US' }],
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    globalThis.window = { speechSynthesis: engine };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; }
    };

    speakNaturalSpeech('Hello there.', { lang: 'en-US', voice: selectedVoice });

    expect(engine.speak.mock.calls[0][0].voice).toBe(selectedVoice);
  });

  it('returns undefined when no voices are available', () => {
    expect(pickSpeechVoice([], 'en-US')).toBeUndefined();
  });

  it('does not substitute an English/default voice when Bengali is unavailable', () => {
    const voices = [{ name: 'Microsoft David', lang: 'en-US', localService: true, default: true }];
    expect(pickSpeechVoice(voices, 'bn-BD')).toBeUndefined();
  });
});

describe('free local word pronunciation', () => {
  it('uses the installed browser voice without making an audio API request', () => {
    const engine = {
      getVoices: () => [{ name: 'Google US English', lang: 'en-US' }],
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    globalThis.window = { speechSynthesis: engine };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; }
    };

    speakNaturalSpeech('Hello there.', { lang: 'en-US', rate: 0.82 });

    const [utterance] = engine.speak.mock.calls[0];
    expect(utterance.text).toBe('Hello there.');
    expect(utterance.rate).toBe(0.82);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Bengali voice briefing', () => {
  it('briefs in Bengali with a Bengali greeting when lang is bn', () => {
    const briefing = buildVoiceBriefing({ name: 'আয়েশা', hour: 9, lang: 'bn' });
    expect(briefing.lang).toBe('bn');
    expect(briefing.greeting).toBe('শুভ সকাল');
    expect(briefing.text).toContain('শুভ সকাল, আয়েশা!');
    expect(briefing.text).toMatch(/[\u0980-\u09ff]/);
  });

  it('names the next routine in Bengali', () => {
    const briefing = buildVoiceBriefing({
      name: 'আয়েশা',
      hour: 9,
      lang: 'bn',
      routines: [{ title: 'কুরআন পড়া', startTime: '10:00', completionStatus: null }],
    });
    expect(briefing.text).toContain('আপনার পরের রুটিন কুরআন পড়া।');
  });

  it('speaks Bengali text with a Bengali voice', () => {
    const voices = [
      { name: 'Google US English', lang: 'en-US', localService: false },
      { name: 'Google বাংলা', lang: 'bn-BD', localService: false },
    ];
    const engine = { getVoices: () => voices, cancel: vi.fn(), speak: vi.fn(), pause: vi.fn(), resume: vi.fn() };
    globalThis.window = { speechSynthesis: engine };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; }
    };
    speakWithVoice('শুভ সকাল!', { lang: 'bn-BD' });
    const [utterance] = engine.speak.mock.calls[0];
    expect(utterance.lang).toBe('bn-BD');
    expect(utterance.voice).toBe(voices[1]);
  });

  it('refuses to read Bengali text with a non-Bengali voice', () => {
    const engine = {
      getVoices: () => [{ name: 'Microsoft David', lang: 'en-US', localService: true, default: true }],
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    globalThis.window = { speechSynthesis: engine };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; }
    };
    expect(() => speakWithVoice('শুভ সকাল!', { lang: 'bn-BD' }))
      .toThrow('No Bengali text-to-speech voice is installed on this device.');
    expect(engine.speak).not.toHaveBeenCalled();
  });
});

describe('spoken alarm announcement', () => {
  it('announces the alarm name and next routine in English', () => {
    const announcement = buildAlarmAnnouncement({ alarmName: 'Fajr prep', lang: 'en', nextRoutineTitle: 'Morning walk' });
    expect(announcement.text).toBe('Your alarm, Fajr prep, is ringing. Your next routine is Morning walk.');
  });

  it('announces the alarm name and next routine in Bengali', () => {
    const announcement = buildAlarmAnnouncement({ alarmName: 'ফজর', lang: 'bn', nextRoutineTitle: 'সকালের হাঁটা' });
    expect(announcement.text).toBe('আপনার অ্যালার্ম ফজর বাজছে। আপনার পরের রুটিন সকালের হাঁটা।');
  });

  it('works without a name or a next routine', () => {
    expect(buildAlarmAnnouncement({ lang: 'en' }).text).toBe('Your alarm is ringing.');
    expect(buildAlarmAnnouncement({ lang: 'bn' }).text).toBe('আপনার অ্যালার্ম বাজছে।');
  });

  it('finds the next unfinished routine title', () => {
    expect(getNextRoutineTitle([
      { title: 'Done early', startTime: '07:00', completionStatus: 'done' },
      { title: 'Read a chapter', startTime: '10:00', completionStatus: null },
    ], 8)).toBe('Read a chapter');
    expect(getNextRoutineTitle([], 8)).toBe('');
  });
});

describe('missed alarm catch-up announcement', () => {
  it('summarizes missed alarms in English', () => {
    expect(buildMissedAnnouncement({ names: ['Fajr prep', 'Gym'], lang: 'en' }).text)
      .toBe('While you were away, 2 alarms rang: Fajr prep, Gym.');
    expect(buildMissedAnnouncement({ names: ['Solo'], lang: 'en' }).text)
      .toBe('While you were away, 1 alarm rang: Solo.');
  });

  it('summarizes missed alarms in Bengali', () => {
    expect(buildMissedAnnouncement({ names: ['ফজর'], lang: 'bn' }).text)
      .toBe('আপনি দূরে থাকতে 1টি অ্যালার্ম বেজেছে: ফজর।');
  });
});
