export function announceLearningActivity(earnedPoints = 0, { soundAlreadyPlayed = false } = {}) {
  if (typeof window === 'undefined') return;
  const points = Number.isFinite(earnedPoints) ? Math.max(0, Math.floor(earnedPoints)) : 0;
  window.dispatchEvent(new CustomEvent('smart-routine:learning-activity', {
    detail: { earnedPoints: points },
  }));
  if (points > 0) {
    window.dispatchEvent(new CustomEvent('smart-routine:points-awarded', {
      detail: soundAlreadyPlayed ? { points, soundAlreadyPlayed: true } : { points },
    }));
  }
}
