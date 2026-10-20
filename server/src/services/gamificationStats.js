const TITLES = [
  { en: 'Habit Initiate', bn: 'নবাগত সাধক' },
  { en: 'Steadfast Learner', bn: 'অটল শিক্ষার্থী' },
  { en: 'Discipline Warrior', bn: 'সংকল্পের যোদ্ধা' },
  { en: 'Routine Master', bn: 'অভ্যাসগুরু' },
  { en: 'Grand Achiever', bn: 'মহাজ্ঞানী সাধক' },
];

/**
 * Calculate the dashboard XP summary from persisted completion/reflection counts.
 * Keep this function pure so the XP rules can be tested without MongoDB.
 */
export function calculateGamificationStats({ totalDone = 0, reflectionsCount = 0 } = {}) {
  const done = Number.isFinite(totalDone) ? Math.max(0, Math.floor(totalDone)) : 0;
  const reflections = Number.isFinite(reflectionsCount) ? Math.max(0, Math.floor(reflectionsCount)) : 0;
  const xp = (done * 50) + (reflections * 30);
  const level = Math.floor(xp / 200) + 1;

  return {
    xp,
    level,
    currentLevelXP: xp % 200,
    nextLevelXP: 200,
    streakShields: Math.max(1, 3 - Math.floor(done / 50)),
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
  };
}
