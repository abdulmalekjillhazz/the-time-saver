import { beforeEach, describe, expect, it, vi } from 'vitest';

const capacitorState = vi.hoisted(() => ({
  platform: 'web',
  native: false,
  pluginAvailable: false,
  schedule: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorState.platform,
    isNativePlatform: () => capacitorState.native,
    isPluginAvailable: () => capacitorState.pluginAvailable,
  },
  registerPlugin: () => ({
    schedule: capacitorState.schedule,
  }),
}));

import { isAndroidNativeApp, scheduleNativeAlarm } from '../lib/nativeAlarm.js';

describe('native alarm platform detection', () => {
  beforeEach(() => {
    capacitorState.platform = 'web';
    capacitorState.native = false;
    capacitorState.pluginAvailable = false;
    capacitorState.schedule.mockReset();
  });

  it('recognizes Android from the registered native alarm plugin bridge', () => {
    capacitorState.pluginAvailable = true;
    expect(isAndroidNativeApp()).toBe(true);
  });

  it('recognizes Android from Capacitor platform detection', () => {
    capacitorState.platform = 'android';
    capacitorState.native = true;
    expect(isAndroidNativeApp()).toBe(true);
  });

  it('does not classify an ordinary browser as the native app', () => {
    expect(isAndroidNativeApp()).toBe(false);
  });

  it('schedules through the native bridge when its plugin is available', async () => {
    capacitorState.pluginAvailable = true;
    capacitorState.schedule.mockResolvedValue(undefined);

    await scheduleNativeAlarm({ id: 'alarm-1', at: 1234, label: 'Study' }, 'en');

    expect(capacitorState.schedule).toHaveBeenCalledWith({
      id: 'alarm-1',
      at: 1234,
      label: 'Study',
      lang: 'en',
      repeatDaily: false,
      timeZone: '',
    });
  });
});
