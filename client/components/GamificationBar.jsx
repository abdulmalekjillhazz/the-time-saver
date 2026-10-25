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

  if (error) return <p role="alert" className="text-sm font-semibold text-rose-400">{error}</p>;
  if (!stats) return <p role="status" className="text-sm opacity-75">{isBn ? 'লোড হচ্ছে…' : 'Loading…'}</p>;

  return (
    <div className="glass-panel glow-border flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-gold/35 bg-paper/70 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-slate-950 font-black shadow-[0_4px_16px_rgba(245,158,11,0.4)] ring-2 ring-amber-300/50">
          <span className="text-base font-black tracking-tight">{stats.level}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold tracking-wide text-ink">
              {isBn ? 'লেভেল' : 'Level'} {stats.level} · <span className="text-gold-soft">{stats.title[isBn ? 'bn' : 'en']}</span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="h-2.5 w-32 sm:w-44 overflow-hidden rounded-full bg-amber-500/15 ring-1 ring-amber-500/25" role="progressbar" aria-label={isBn ? 'পরবর্তী লেভেলের অগ্রগতি' : 'Progress to next level'} aria-valuemin={0} aria-valuemax={stats.nextLevelXP} aria-valuenow={stats.currentLevelXP}>
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-ink/75 font-mono">
              {stats.currentLevelXP}/{stats.nextLevelXP} XP
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-sapphire/35 bg-sapphire/15 px-3.5 py-2 text-xs font-bold text-sapphire shadow-sm backdrop-blur-sm">
        <span aria-hidden="true" className="text-sm">🛡️</span>
        <span>{isBn ? `স্ট্রিক শিল্ড: ${stats.streakShields}টি সক্রিয়` : `Streak Shields: ${stats.streakShields} active`}</span>
      </div>
    </div>
  );
}
