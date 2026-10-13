'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';

const COPY = {
  en: { loadError: 'Gamification stats could not be loaded.' },
  bn: { loadError: 'গ্যামিফিকেশন পরিসংখ্যান লোড করা যায়নি।' },
};

export function GamificationBar({ lang = 'bn' }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const isBn = lang === 'bn';

  useEffect(() => {
    let active = true;
    apiRequest('/api/gamification/stats')
      .then((data) => { if (active) setStats(data); })
      .catch(() => {
        if (active) setError((COPY[lang] ?? COPY.en).loadError);
      });
    return () => { active = false; };
  }, [lang]);

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!stats) return <p role="status" className="text-sm opacity-75">{isBn ? 'লোড হচ্ছে…' : 'Loading…'}</p>;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-amber-50/50 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 font-extrabold text-white shadow-sm">
          {stats.level}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              {isBn ? 'লেভেল' : 'Level'} {stats.level} · {stats.title[isBn ? 'bn' : 'en']}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-amber-200/80">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${(stats.currentLevelXP / stats.nextLevelXP) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600">
              {stats.currentLevelXP}/{stats.nextLevelXP} XP
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-900 shadow-xs">
        <span aria-hidden="true">🛡️</span>
        <span>{isBn ? `স্ট্রিক শিল্ড: ${stats.streakShields}টি সক্রিয়` : `Streak Shields: ${stats.streakShields} active`}</span>
      </div>
    </div>
  );
}
