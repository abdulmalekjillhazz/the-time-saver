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

  it('calculates points correctly for the three-question daily quiz', () => {
    expect(getQuizLearningPoints(0, 3)).toBe(0);
    expect(getQuizLearningPoints(1, 3)).toBe(10);
    expect(getQuizLearningPoints(2, 3)).toBe(20);
    expect(getQuizLearningPoints(3, 3)).toBe(30);
  });

  it('increases the level for every three unique learning days', () => {
    expect(learningLevelForActiveDays(0)).toBe(1);
    expect(learningLevelForActiveDays(2)).toBe(1);
    expect(learningLevelForActiveDays(3)).toBe(2);
    expect(learningLevelForActiveDays(6)).toBe(3);
  });

  it('counts each learner’s unique learning-activity dates toward the learning streak', () => {
    expect(learningStreakForDates([
      '2026-10-14',
      '2026-10-15',
      '2026-10-15',
      '2026-10-16',
    ], '2026-10-16')).toEqual({ current: 3, longest: 3 });
    expect(learningStreakForDates(['2026-10-14'], '2026-10-16')).toEqual({ current: 0, longest: 1 });
    expect(learningStreakForDates([], '2026-10-16')).toEqual({ current: 0, longest: 0 });
    expect(learningStreakForDates(['2026-10-14', '2026-10-16'], '2026-10-16'))
      .toEqual({ current: 1, longest: 1 });
  });
});
