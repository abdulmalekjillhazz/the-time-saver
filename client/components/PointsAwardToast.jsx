'use client';

import { useEffect, useState } from 'react';

export function PointsAwardToast({ lang = 'bn' }) {
  const [award, setAward] = useState({ points: 0, celebration: 0 });
  const isBn = lang === 'bn';

  useEffect(() => {
    let dismissTimer;
    const showAward = (event) => {
      const awardedPoints = event.detail?.points;
      if (!Number.isSafeInteger(awardedPoints) || awardedPoints <= 0) return;
      setAward((current) => ({
        points: current.points + awardedPoints,
        celebration: current.celebration + 1,
      }));
      window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => setAward({ points: 0, celebration: 0 }), 3600);
    };
    window.addEventListener('smart-routine:points-awarded', showAward);
    return () => {
      window.clearTimeout(dismissTimer);
      window.removeEventListener('smart-routine:points-awarded', showAward);
    };
  }, []);

  if (!award.points) return null;

  return (
    <div className="points-award-overlay" role="status" aria-live="polite">
      <div key={award.celebration} className="points-award-card">
        <div className="points-award-burst" aria-hidden="true">
          {['✦', '✧', '●', '✦', '●', '✧', '✦', '●'].map((particle, index) => (
            <span
              key={`${award.celebration}-${index}`}
              className={`points-award-particle points-award-particle-${index + 1}`}
            >
              {particle}
            </span>
          ))}
        </div>
        <span className="points-award-sparkle" aria-hidden="true">✨</span>
        <span className="points-award-icon" aria-hidden="true">🏆</span>
        <p className="points-award-title">{isBn ? 'তুমি সত্যিই অসাধারণ!' : 'You earned it!'}</p>
        <p className="points-award-value">+{award.points} {isBn ? 'পয়েন্ট' : (award.points === 1 ? 'point' : 'points')}</p>
        <p className="points-award-message">
          {isBn ? 'তোমার প্রতিটি চেষ্টা তোমাকে এগিয়ে নিচ্ছে—চালিয়ে যাও!' : 'Every step counts. Keep that brilliant momentum going!'}
        </p>
      </div>
    </div>
  );
}
