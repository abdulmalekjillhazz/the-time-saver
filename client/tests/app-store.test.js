import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const persistedValues = new Map();
let useAppStore;

beforeEach(async () => {
  globalThis.window = {
    localStorage: {
      getItem: (key) => persistedValues.get(key) ?? null,
      setItem: (key, value) => persistedValues.set(key, value),
      removeItem: (key) => persistedValues.delete(key),
    },
  };
  if (!useAppStore) ({ useAppStore } = await import('../lib/appStore.js'));
});

afterEach(() => {
  useAppStore.setState({
    theme: 'dark',
    language: null,
    alarms: [],
    alarmSoundId: 'birds',
    stopwatchElapsedMs: 0,
    stopwatchStartedAt: null,
  });
  delete globalThis.window;
  persistedValues.clear();
});

describe('persisted interface state', () => {
  it('switches and stores the selected theme', () => {
    useAppStore.getState().setTheme('light');
    expect(useAppStore.getState().theme).toBe('light');
  });

  it('keeps Bengali and English UI selection in persistent client state', () => {
    useAppStore.getState().setLanguage('en');
    expect(useAppStore.getState().language).toBe('en');
    expect(persistedValues.get('smart-routine-ui')).toContain('"language":"en"');
  });

  it('persists the chosen alarm sound on this device', () => {
    useAppStore.getState().setAlarmSoundId('ocean');
    expect(useAppStore.getState().alarmSoundId).toBe('ocean');
    expect(persistedValues.get('smart-routine-ui')).toContain('"alarmSoundId":"ocean"');
  });

  it('schedules, marks, and removes alarms', () => {
    const alarm = { id: 'alarm-1', at: 5000, label: 'Read', firedAt: null };
    useAppStore.getState().addAlarm(alarm);
    useAppStore.getState().markAlarmFired(alarm.id);
    expect(useAppStore.getState().alarms[0].firedAt).toEqual(expect.any(Number));
    useAppStore.getState().removeAlarm(alarm.id);
    expect(useAppStore.getState().alarms).toEqual([]);
  });

  it('snoozes a fired alarm by rescheduling it and clearing its fired state', () => {
    const alarm = { id: 'alarm-snooze', at: 5000, label: 'Read', firedAt: null };
    useAppStore.getState().addAlarm(alarm);
    useAppStore.getState().markAlarmFired(alarm.id);
    useAppStore.getState().snoozeAlarm(alarm.id, 305000);
    expect(useAppStore.getState().alarms[0]).toMatchObject({ id: alarm.id, at: 305000, firedAt: null });
  });

  it('keeps stopwatch time consistent across pause and reset', () => {
    useAppStore.getState().startStopwatch(1000);
    useAppStore.getState().stopStopwatch(6100);
    expect(useAppStore.getState().stopwatchElapsedMs).toBe(5100);
    expect(useAppStore.getState().stopwatchStartedAt).toBeNull();
    useAppStore.getState().resetStopwatch();
    expect(useAppStore.getState().stopwatchElapsedMs).toBe(0);
  });
});
