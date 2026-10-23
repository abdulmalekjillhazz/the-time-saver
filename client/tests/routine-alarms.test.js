import { describe, expect, it } from 'vitest';
import { buildRoutineAlarms, nextRoutineOccurrence } from '../lib/routineAlarms.js';

const at = (iso) => new Date(iso);

describe('routine alarm scheduling', () => {
  it('uses today when the start time is still ahead', () => {
    const now = at('2026-10-23T06:00:00');
    expect(nextRoutineOccurrence('07:00', now)).toBe(at('2026-10-23T07:00:00').getTime());
  });

  it('rolls to tomorrow once today’s start time has passed', () => {
    const now = at('2026-10-23T08:00:00');
    expect(nextRoutineOccurrence('07:00', now)).toBe(at('2026-10-24T07:00:00').getTime());
  });

  it('rejects malformed times', () => {
    const now = at('2026-10-23T06:00:00');
    expect(nextRoutineOccurrence('7:00', now)).toBeNull();
    expect(nextRoutineOccurrence('24:00', now)).toBeNull();
    expect(nextRoutineOccurrence('', now)).toBeNull();
  });

  it('always arms a repeating alarm, including for a routine completed today', () => {
    const now = at('2026-10-23T06:00:00');
    const alarms = buildRoutineAlarms([
      { id: 'a', title: 'Morning walk', startTime: '07:00', completionStatus: null },
      { id: 'b', title: 'Read', startTime: '07:30', completionStatus: 'done' },
      { id: 'c', title: 'Early', startTime: '05:00', completionStatus: 'done' },
    ], now);

    const byId = Object.fromEntries(alarms.map((alarm) => [alarm.id, alarm]));
    expect(byId['routine-a']).toMatchObject({ repeatDaily: true, at: at('2026-10-23T07:00:00').getTime() });
    expect(byId['routine-b']).toBeUndefined();
    // Completed today, but its time already passed, so tomorrow stays armed.
    expect(byId['routine-c']).toMatchObject({ repeatDaily: true, at: at('2026-10-24T05:00:00').getTime() });
  });

  it('uses the user timezone instead of the device timezone', () => {
    const now = new Date('2026-10-23T21:00:00Z');
    expect(nextRoutineOccurrence('10:00', now, 'Asia/Dhaka'))
      .toBe(new Date('2026-10-24T04:00:00Z').getTime());
  });

  it('keeps wall-clock time across a daylight-saving change', () => {
    const now = new Date('2026-03-08T00:00:00-05:00');
    expect(nextRoutineOccurrence('09:00', now, 'America/New_York'))
      .toBe(new Date('2026-03-08T09:00:00-04:00').getTime());
  });

  it('falls back to the device timezone when the user zone is unknown', () => {
    const now = at('2026-10-23T06:00:00');
    expect(nextRoutineOccurrence('07:00', now, 'Not/AZone'))
      .toBe(at('2026-10-23T07:00:00').getTime());
  });

  it('arms tomorrow for a completed routine whose time has passed', () => {
    const now = at('2026-10-23T21:00:00');
    const [alarm] = buildRoutineAlarms([
      { id: 'c', title: 'Evening', startTime: '20:00', completionStatus: 'done' },
    ], now);
    expect(alarm.at).toBe(at('2026-10-24T20:00:00').getTime());
  });
});
