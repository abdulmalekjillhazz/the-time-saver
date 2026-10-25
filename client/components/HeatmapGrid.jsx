'use client';

import { useEffect, useState } from 'react';
import { Card } from './ui/Card.jsx';
import { apiRequest } from '../lib/apiClient.js';

export function HeatmapGrid({ lang = 'bn' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isBn = lang === 'bn';
  const copy = {
    title: isBn ? '📊 বাৎসরিক অভ্যাসের হিটম্যাপ (Habit Heatmap)' : '📊 Annual Habit Heatmap',
    less: isBn ? 'কম' : 'Less',
    more: isBn ? 'বেশি' : 'More',
    activeDays: isBn ? 'দিন সক্রিয়' : 'active days',
    error: isBn ? 'বার্ষিক হিটম্যাপ লোড করা যায়নি। আবার চেষ্টা করুন।' : 'Could not load the annual heatmap. Please try again.',
  };

  useEffect(() => {
    let active = true;
    apiRequest('/api/completions/heatmap', { locale: lang })
      .then((json) => {
        if (!Array.isArray(json?.heatmap) || json.heatmap.length !== 365) {
          throw new Error('The server returned an incomplete annual heatmap.');
        }
        if (active) setData(json.heatmap);
      })
      .catch(() => {
        if (active) {
          // Graceful fallback with empty 365 days if offline or unauthenticated
          const today = new Date();
          const fallback = Array.from({ length: 365 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (364 - i));
            return {
              date: d.toISOString().slice(0, 10),
              count: 0,
              level: 0,
            };
          });
          setData(fallback);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lang]);

  const levelColors = ['bg-ink/10', 'bg-sapphire/30', 'bg-sapphire/55', 'bg-sapphire/80', 'bg-gold'];
  const activeCount = data.filter((d) => d.count > 0).length;

  return (
    <Card className="surface-card glass-panel glow-border space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-heading text-base">{copy.title}</h3>
        <span className="text-xs font-semibold text-gold-soft">
          🔥 {activeCount} {copy.activeDays}
        </span>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-xl bg-ink/10" />
      ) : error ? (
        <p role="alert" className="text-sm font-semibold text-rose-400">{copy.error}</p>
      ) : (
        <div className="enter-up overflow-x-auto pb-2">
          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {data.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} routines`}
                className={`h-3 w-3 rounded-sm ${levelColors[day.level] || 'bg-ink/10'} transition-transform hover:scale-125 hover:shadow-[0_0_6px_rgba(242,193,78,0.6)]`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-1.5 pt-2 text-xs text-ink/70">
        <span>{copy.less}</span>
        {levelColors.map((color, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-sm ${color}`} />
        ))}
        <span>{copy.more}</span>
      </div>
    </Card>
  );
}
