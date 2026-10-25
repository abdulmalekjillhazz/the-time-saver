'use client';

import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { Card } from './ui/Card.jsx';

const COPY = {
  en: { title: 'Your routine streak', subtitle: 'Daily completion rate', loading: 'Loading…', empty: 'No completions recorded yet.', loadError: 'Dashboard data could not be loaded.', days7: '7 days', days30: '30 days', streakCurrent: 'Current streak', streakBest: 'Best streak', streakUnit: 'days' },
  bn: { title: 'তোমার রুটিন ধারাবাহিকতা', subtitle: 'প্রতিদিনের সম্পন্ন হওয়ার হার', loading: 'লোড হচ্ছে…', empty: 'এখনো কোনো রুটিন সম্পন্ন রেকর্ড নেই।', loadError: 'ড্যাশবোর্ডের তথ্য লোড করা যায়নি।', days7: '৭ দিন', days30: '৩০ দিন', streakCurrent: 'বর্তমান ধারা', streakBest: 'সর্বোচ্চ ধারা', streakUnit: 'দিন' },
};

export function RoutineDashboard({ lang = 'en', userId }) {
  const copy = COPY[lang] ?? COPY.en;
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState(null);
  const [streak, setStreak] = useState(null);
  const [error, setError] = useState('');
  const refreshRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const requestId = ++refreshRequestRef.current;
      try {
        const [summaryData, streakData] = await Promise.all([
          apiRequest(`/api/completions/summary?days=${days}`),
          apiRequest('/api/completions/streak'),
        ]);
        if (!active || requestId !== refreshRequestRef.current) return;
        setSummary(summaryData.summary);
        setStreak(streakData.streak);
        setError('');
      } catch (requestError) {
        if (!active || requestId !== refreshRequestRef.current) return;
        setError(copy.loadError);
        console.error('Could not refresh routine dashboard', requestError);
      }
    };

    const onSync = (event) => {
      if (event.detail?.userId === userId) void refresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    window.addEventListener('smart-routine:sync', onSync);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener('smart-routine:sync', onSync);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [days, userId, copy.loadError]);

  const width = 600;
  const height = 140;
  const barGap = 6;
  const barWidth = summary ? Math.max((width - barGap * (summary.length - 1)) / summary.length, 8) : 0;

  return (
    <Card className="surface-card glass-panel glow-border space-y-4 rounded-2xl border border-gold/30 bg-paper/85 p-5 shadow-xl sm:p-6 backdrop-blur-md">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/15 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-ink tracking-tight flex items-center gap-2">
            <span>📊</span>
            <span>{copy.title}</span>
          </h2>
          <p className="text-xs sm:text-sm font-medium text-ink/70 mt-0.5">{copy.subtitle}</p>
          {streak ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold-soft">
              <span>🔥 {copy.streakCurrent}: {streak.current} {copy.streakUnit}</span>
              <span className="opacity-40">•</span>
              <span>⭐ {copy.streakBest}: {streak.longest} {copy.streakUnit}</span>
            </div>
          ) : null}
        </div>
        <div className="inline-flex rounded-xl border border-sapphire/35 bg-sapphire/10 p-1">
          <button
            type="button"
            className={`rounded-lg px-3.5 py-1 text-xs sm:text-sm font-bold transition-all ${days === 7 ? 'bg-sapphire text-on-sapphire shadow-[0_0_12px_rgba(96,165,250,0.5)]' : 'text-ink/80 hover:text-ink'}`}
            onClick={() => setDays(7)}
          >
            {copy.days7}
          </button>
          <button
            type="button"
            className={`rounded-lg px-3.5 py-1 text-xs sm:text-sm font-bold transition-all ${days === 30 ? 'bg-sapphire text-on-sapphire shadow-[0_0_12px_rgba(96,165,250,0.5)]' : 'text-ink/80 hover:text-ink'}`}
            onClick={() => setDays(30)}
          >
            {copy.days30}
          </button>
        </div>
      </header>

      {!summary ? <p role="status" className="text-sm font-semibold opacity-75">{error || copy.loading}</p> : (
        <>
          {error ? <p role="alert" className="text-sm font-semibold text-rose-400">{error}</p> : null}
          {summary.every(({ total }) => !total) ? (
            <div className="rounded-xl border border-dashed border-gold/40 bg-gold/5 p-4 text-center">
              <p className="text-xs sm:text-sm font-bold text-ink/80">
                🌱 {copy.empty}
              </p>
              <p className="mt-1 text-xs text-ink/60">
                {lang === 'bn' ? 'আজকের প্রথম রুটিনটি সম্পন্ন করলেই গ্রাফে দেখতে পাবেন।' : 'Complete your first routine today to see progress here.'}
              </p>
            </div>
          ) : null}
          <div className="pt-2">
            <svg viewBox={`0 0 ${width} ${height + 34}`} className="w-full overflow-visible" role="img" aria-label={copy.subtitle}>
              {summary.map((day, i) => {
                const pct = day.rate ?? 0;
                const barHeight = (pct / 100) * height;
                const x = i * (barWidth + barGap);
                const y = height - barHeight;
                const color = pct >= 70 ? 'fill-emerald-500' : pct >= 40 ? 'fill-amber-400' : 'fill-rose-500';
                return (
                  <g key={day.date}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight || 2}
                      className={`chart-bar-grow ${day.total ? color : 'fill-ink/15'}`}
                      rx="4"
                      style={{ '--enter-delay': `${i * 30}ms` }}
                    />
                    {days <= 7 ? (
                      <text
                        x={x + barWidth / 2}
                        y={height + 22}
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                        fill="currentColor"
                        opacity="0.85"
                      >
                        {day.date.slice(5)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}
    </Card>
  );
}
