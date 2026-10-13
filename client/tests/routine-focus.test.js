import { describe, expect, it } from 'vitest';
import { getFocusRoutines } from '../lib/routineFocus.js';

const routines = [
  { id: 'early-low', title: 'Early low', startTime: '07:00', priority: 'low', isFrog: false },
  { id: 'later-important', title: 'Main task', startTime: '11:00', priority: 'medium', isFrog: true },
  { id: 'high', title: 'High priority', startTime: '08:00', priority: 'high', isFrog: false },
  { id: 'completed-important', title: 'Done already', startTime: '06:00', priority: 'high', isFrog: true, completionStatus: 'done' },
  { id: 'medium', title: 'Medium priority', startTime: '09:00', priority: 'medium', isFrog: false },
];

describe('routine focus ordering', () => {
  it('puts the chosen most-important unfinished task first in the short focus list', () => {
    expect(getFocusRoutines(routines).map(({ id }) => id)).toEqual(['later-important']);
  });

  it('falls back to chosen priority and start time when no routine is marked', () => {
    expect(getFocusRoutines(routines.filter((routine) => routine.id !== 'later-important')).map(({ id }) => id))
      .toEqual(['high']);
  });
});
