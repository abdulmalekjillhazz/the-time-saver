import { describe, expect, it } from 'vitest';
import {
  getQuizLearningPoints,
  learningStreakForDates,
  learningLevelForActiveDays,
} from '../../src/services/gamification.js';

describe('learning leaderboard scoring', () => {
  it('awards quiz points proportional to accuracy, rounded to a whole point', () => {
    expect(getQuizLearningPoints(0, 4)).toBe(0);
    expect(getQuizLearningPoints(1, 4)).toBe(8);
    expect(getQuizLearningPoints(2, 4)).toBe(15);
    expect(getQuizLearningPoints(4, 4)).toBe(30);
    expect(getQuizLearningPoints(0, 0)).toBe(0);
  });

  it('increases the level for every three unique learning days', () => {
    expect(learningLevelForActiveDays(0)).toBe(1);
    expect(learningLevelForActiveDays(2)).toBe(1);
    expect(learningLevelForActiveDays(3)).toBe(2);
    expect(learningLevelForActiveDays(6)).toBe(3);
  });

  it('counts only each learner’s unique point-earning dates toward the learning streak', () => {
    expect(learningStreakForDates([
      '2026-10-14',
      '2026-10-15',
      '2026-10-15',
      '2026-10-16',
    ], '2026-10-16')).toEqual({ current: 3, longest: 3 });
    expect(learningStreakForDates(['2026-10-14'], '2026-10-16')).toEqual({ current: 0, longest: 1 });
    expect(learningStreakForDates([], '2026-10-16')).toEqual({ current: 0, longest: 0 });
  });
});
