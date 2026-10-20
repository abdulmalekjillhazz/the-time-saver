import { describe, expect, it } from 'vitest';
import { calculateGamificationStats } from '../../src/services/gamificationStats.js';

describe('routine gamification XP calculation', () => {
  it('starts at level 1 with zero XP', () => {
    expect(calculateGamificationStats()).toMatchObject({
      xp: 0,
      level: 1,
      currentLevelXP: 0,
      nextLevelXP: 200,
      title: { en: 'Habit Initiate', bn: 'নবাগত সাধক' },
    });
  });

  it('awards 50 XP per currently completed routine and 30 per saved reflection', () => {
    expect(calculateGamificationStats({ totalDone: 2, reflectionsCount: 1 })).toMatchObject({
      xp: 130,
      level: 1,
      currentLevelXP: 130,
    });
  });

  it('advances the level at each 200 XP boundary', () => {
    expect(calculateGamificationStats({ totalDone: 4 })).toMatchObject({
      xp: 200,
      level: 2,
      currentLevelXP: 0,
      title: { en: 'Steadfast Learner', bn: 'অটল শিক্ষার্থী' },
    });
  });

  it('does not expose negative or fractional counts as negative XP', () => {
    expect(calculateGamificationStats({ totalDone: -4, reflectionsCount: 1.9 })).toMatchObject({
      xp: 30,
      level: 1,
      currentLevelXP: 30,
    });
  });
});
