'use client';

import { useEffect, useState } from 'react';

export function PointsAwardToast({ lang = 'bn' }) {
  const [points, setPoints] = useState(0);
  const isBn = lang === 'bn';

  useEffect(() => {
    let dismissTimer;
    const showAward = (event) => {
      const awardedPoints = event.detail?.points;
      if (!Number.isSafeInteger(awardedPoints) || awardedPoints <= 0) return;
      setPoints(awardedPoints);
      window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => setPoints(0), 3600);
    };
    window.addEventListener('smart-routine:points-awarded', showAward);
    return () => {
      window.clearTimeout(dismissTimer);
      window.removeEventListener('smart-routine:points-awarded', showAward);
    };
  }, []);

  if (!points) return null;

  return (
    <div className="points-award-overlay" role="status" aria-live="polite">
      <div className="points-award-card">
        <span className="points-award-sparkle" aria-hidden="true">✨</span>
        <span className="points-award-icon" aria-hidden="true">🌟</span>
        <p className="points-award-title">{isBn ? 'দারুণ করেছ!' : 'Lovely work!'}</p>
        <p className="points-award-value">+{points} {isBn ? 'পয়েন্ট' : (points === 1 ? 'point' : 'points')}</p>
        <p className="points-award-message">{isBn ? 'তোমার চেষ্টা সত্যিই কাজে লাগছে' : 'Your effort is adding up'}</p>
      </div>
    </div>
  );
}
