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
    <div className="glass-panel glow-border flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/5 p-4">
      <div className="flex items-center gap-3">
        <div className="idle-wobble flex h-11 w-11 items-center justify-center rounded-xl bg-gold font-extrabold text-on-gold shadow-[0_0_14px_rgba(242,193,78,0.5)]">
          {stats.level}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-soft">
              {isBn ? 'লেভেল' : 'Level'} {stats.level} · {stats.title[isBn ? 'bn' : 'en']}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-gold/20" role="progressbar" aria-label={isBn ? 'পরবর্তী লেভেলের অগ্রগতি' : 'Progress to next level'} aria-valuemin={0} aria-valuemax={stats.nextLevelXP} aria-valuenow={stats.currentLevelXP}>
              <div
                className="h-full bg-gold transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-ink/70">
              {stats.currentLevelXP}/{stats.nextLevelXP} XP
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-sapphire/30 bg-sapphire/10 px-3 py-1.5 text-xs font-bold text-sapphire">
        <span aria-hidden="true">🛡️</span>
        <span>{isBn ? `স্ট্রিক শিল্ড: ${stats.streakShields}টি সক্রিয়` : `Streak Shields: ${stats.streakShields} active`}</span>
      </div>
    </div>
  );
}
