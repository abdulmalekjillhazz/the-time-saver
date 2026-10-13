import { describe, expect, it } from 'vitest';
import { getRoutineMood } from '../lib/routineMood.js';

describe('routine duration mood', () => {
  it('stays neutral for short durations and invalid or equal times', () => {
    expect(getRoutineMood('09:00', '10:00')).toEqual({ mood: 'neutral', durationMinutes: 60 });
    expect(getRoutineMood('09:00', '09:00')).toEqual({ mood: 'neutral', durationMinutes: 0 });
    expect(getRoutineMood('', '09:00')).toEqual({ mood: 'neutral', durationMinutes: null });
  });

  it('smiles for a reasonable longer duration', () => {
    expect(getRoutineMood('09:00', '11:00')).toEqual({ mood: 'happy', durationMinutes: 120 });
  });

  it('gets angry for an excessive duration and supports crossing midnight', () => {
    expect(getRoutineMood('09:00', '13:01')).toEqual({ mood: 'angry', durationMinutes: 241 });
    expect(getRoutineMood('23:00', '01:00')).toEqual({ mood: 'happy', durationMinutes: 120 });
  });
});
