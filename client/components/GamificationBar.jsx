'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';

const COPY = {
  en: { loadError: 'Gamification stats could not be loaded.' },
  bn: { loadError: 'গ্যামিফিকেশন পরিসংখ্যান লোড করা যায়নি।' },
};

export function GamificationBar({ lang = 'bn', userId }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const isBn = lang === 'bn';
  const progress = stats ? Math.max(0, Math.min(100, (stats.currentLevelXP / Math.max(1, stats.nextLevelXP)) * 100)) : 0;

  useEffect(() => {
    let active = true;
    const refresh = () => {
      apiRequest('/api/gamification/stats')
        .then((data) => { if (active) { setStats(data); setError(''); } })
        .catch(() => {
          if (active) setError((COPY[lang] ?? COPY.en).loadError);
        });
    };
    const onSync = (event) => {
      if (!userId || event.detail?.userId === userId) refresh();
    };
    refresh();
    window.addEventListener('smart-routine:sync', onSync);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.removeEventListener('smart-routine:sync', onSync);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [lang, userId]);

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
            <div className="h-2 w-32 overflow-hidden rounded-full bg-amber-200/80" role="progressbar" aria-label={isBn ? 'পরবর্তী লেভেলের অগ্রগতি' : 'Progress to next level'} aria-valuemin={0} aria-valuemax={stats.nextLevelXP} aria-valuenow={stats.currentLevelXP}>
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
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
