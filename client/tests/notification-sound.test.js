import { afterEach, describe, expect, it, vi } from 'vitest';

const { HowlMock } = vi.hoisted(() => ({ HowlMock: vi.fn() }));
vi.mock('howler', () => ({
  Howl: class {
    constructor(options) {
      return HowlMock(options);
    }
  },
}));

import {
  ALARM_SOUNDS,
  getAlarmSoundDataUri,
  getCongratulationsSoundDataUri,
  playAlarmSound,
  playCongratulationsSound,
  stopAlarmSound,
  stopCongratulationsSound,
} from '../lib/notificationSound.js';

describe('alarm sound lifecycle', () => {
  afterEach(() => {
    stopAlarmSound();
    stopCongratulationsSound();
    HowlMock.mockReset();
  });

  it('stops and unloads the looping sound so the next alarm gets a fresh player', () => {
    const sound = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    HowlMock.mockReturnValue(sound);

    playAlarmSound();
    stopAlarmSound();

    expect(sound.play).toHaveBeenCalledOnce();
    expect(sound.stop).toHaveBeenCalledOnce();
    expect(sound.unload).toHaveBeenCalledOnce();

    const nextSound = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    HowlMock.mockReturnValue(nextSound);
    playAlarmSound();
    expect(HowlMock).toHaveBeenCalledTimes(2);
    expect(nextSound.play).toHaveBeenCalledOnce();
  });

  it('offers eight original melodic alarms and plays the selected melody', () => {
    expect(ALARM_SOUNDS).toHaveLength(8);
    expect(ALARM_SOUNDS.map(({ id }) => id)).toEqual([
      'dawn', 'momentum', 'sunrise', 'aurora', 'horizon', 'spark', 'clarity', 'triumph',
    ]);

    const sound = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    HowlMock.mockReturnValue(sound);
    playAlarmSound('momentum');

    const options = HowlMock.mock.calls[0][0];
    expect(options.src[0]).toMatch(/^data:audio\/wav;base64,/);
    expect(sound.play).toHaveBeenCalledOnce();
  });

  it('exports a bounded WAV data URI for native Android alarm playback', () => {
    const dataUri = getAlarmSoundDataUri('momentum');
    const wav = Buffer.from(dataUri.slice('data:audio/wav;base64,'.length), 'base64');

    expect(dataUri).toMatch(/^data:audio\/wav;base64,/);
    expect(dataUri.length).toBeLessThan(250_000);
    expect(wav.length).toBeLessThan(180_000);
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(dataUri).not.toBe(getAlarmSoundDataUri('dawn'));
    expect(dataUri).not.toBe(getAlarmSoundDataUri('invalid-sound-id'));
  });

  it('creates a distinct playable melody for every alarm choice', () => {
    const sounds = ALARM_SOUNDS.map(({ id }) => getAlarmSoundDataUri(id));
    expect(new Set(sounds).size).toBe(ALARM_SOUNDS.length);
    for (const dataUri of sounds) {
      const wav = Buffer.from(dataUri.slice('data:audio/wav;base64,'.length), 'base64');
      expect(wav.length).toBeLessThan(180_000);
      expect(wav.readUInt32LE(24)).toBe(22050);
    }
  });

  it('plays and cleans up a short one-shot congratulations chime', () => {
    const sound = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    HowlMock.mockReturnValue(sound);

    playCongratulationsSound();

    const options = HowlMock.mock.calls[0][0];
    expect(options.src[0]).toBe(getCongratulationsSoundDataUri());
    expect(options.loop).toBe(false);
    expect(options.volume).toBeLessThanOrEqual(0.4);
    const chime = Buffer.from(options.src[0].slice('data:audio/wav;base64,'.length), 'base64');
    expect(chime.readUInt32LE(40) / (22050 * 2)).toBeLessThanOrEqual(1);
    expect(sound.play).toHaveBeenCalledOnce();

    options.onend();
    expect(sound.stop).not.toHaveBeenCalled();
    expect(sound.unload).toHaveBeenCalledOnce();
  });

  it('unloads the old preview before switching to a different selection', () => {
    const first = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    const second = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    HowlMock.mockReturnValueOnce(first).mockReturnValueOnce(second);

    playAlarmSound('dawn');
    playAlarmSound('aurora');

    expect(first.stop).toHaveBeenCalledOnce();
    expect(first.unload).toHaveBeenCalledOnce();
    expect(HowlMock).toHaveBeenCalledTimes(2);
    expect(second.play).toHaveBeenCalledOnce();
  });
});
