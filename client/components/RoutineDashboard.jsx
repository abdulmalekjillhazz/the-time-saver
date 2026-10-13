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
  const height = 160;
  const barGap = 4;
  const barWidth = summary ? Math.max((width - barGap * (summary.length - 1)) / summary.length, 6) : 0;

  return (
    <Card className="surface-card space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-heading">{copy.title}</h2>
          <p className="text-sm opacity-80">{copy.subtitle}</p>
          {streak ? (
            <p className="mt-1 text-sm font-semibold">
              🔥 {copy.streakCurrent}: {streak.current} {copy.streakUnit} · {copy.streakBest}: {streak.longest} {copy.streakUnit}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${days === 7 ? 'bg-sapphire text-on-sapphire' : 'border border-sapphire text-sapphire'}`} onClick={() => setDays(7)}>{copy.days7}</button>
          <button type="button" className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${days === 30 ? 'bg-sapphire text-on-sapphire' : 'border border-sapphire text-sapphire'}`} onClick={() => setDays(30)}>{copy.days30}</button>
        </div>
      </header>

      {!summary ? <p role="status">{error || copy.loading}</p> : (
        <>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          {summary.every(({ total }) => !total) ? <p role="status">{copy.empty}</p> : null}
          <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full" role="img" aria-label={copy.subtitle}>
            {summary.map((day, i) => {
              const pct = day.rate ?? 0;
              const barHeight = (pct / 100) * height;
              const x = i * (barWidth + barGap);
              const y = height - barHeight;
              const color = pct >= 70 ? 'fill-emerald-600' : pct >= 40 ? 'fill-amber-500' : 'fill-red-600';
              return (
                <g key={day.date}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight || 1}
                    className={day.total ? color : 'fill-gray-300'}
                    rx="2"
                  />
                  {days <= 7 ? (
                    <text x={x + barWidth / 2} y={height + 14} fontSize="10" textAnchor="middle" fill="currentColor">
                      {day.date.slice(5)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </>
      )}
    </Card>
  );
}
