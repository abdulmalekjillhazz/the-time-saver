import { afterEach, describe, expect, it, vi } from 'vitest';

const { HowlMock } = vi.hoisted(() => ({ HowlMock: vi.fn() }));
vi.mock('howler', () => ({
  Howl: class {
    constructor(options) {
      return HowlMock(options);
    }
  },
}));

import { ALARM_SOUNDS, playAlarmSound, stopAlarmSound } from '../lib/notificationSound.js';

describe('alarm sound lifecycle', () => {
  afterEach(() => {
    stopAlarmSound();
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

  it('offers twenty named sounds and plays the selected sound', () => {
    expect(ALARM_SOUNDS).toHaveLength(20);
    expect(ALARM_SOUNDS.map(({ id }) => id)).toContain('ocean');
    expect(ALARM_SOUNDS.map(({ id }) => id)).toContain('river');
    expect(ALARM_SOUNDS.map(({ id }) => id)).toContain('pond');
    expect(ALARM_SOUNDS.map(({ id }) => id)).toContain('crowd');

    const sound = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    HowlMock.mockReturnValue(sound);
    playAlarmSound('ocean');

    const options = HowlMock.mock.calls[0][0];
    expect(options.src[0]).toMatch(/^data:audio\/wav;base64,/);
    expect(sound.play).toHaveBeenCalledOnce();
  });

  it('unloads the old preview before switching to a different selection', () => {
    const first = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    const second = { play: vi.fn(), stop: vi.fn(), unload: vi.fn() };
    HowlMock.mockReturnValueOnce(first).mockReturnValueOnce(second);

    playAlarmSound('birds');
    playAlarmSound('cafe');

    expect(first.stop).toHaveBeenCalledOnce();
    expect(first.unload).toHaveBeenCalledOnce();
    expect(HowlMock).toHaveBeenCalledTimes(2);
    expect(second.play).toHaveBeenCalledOnce();
  });
});
