'use client';

import { useEffect, useState } from 'react';
import { Card } from './ui/Card.jsx';

export function BadgesShowcase({ lang = 'bn' }) {
  const [badges, setBadges] = useState([]);
  const isBn = lang === 'bn';

  useEffect(() => {
    let active = true;
    fetch('/api/completions/badges')
      .then((res) => res.json())
      .then((json) => {
        if (active && json.badges) setBadges(json.badges);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!badges.length) return null;

  return (
    <Card className="surface-card space-y-3 p-5">
      <h3 className="section-heading text-base">
        {isBn ? '🏅 অর্জিত ব্যাজ ও মাইলফলক (Badges)' : '🏅 Milestone Badges & Achievements'}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`rounded-xl border p-3 text-center transition-all ${
              b.unlocked
                ? 'border-gold/50 bg-gold/10 shadow-sm'
                : 'border-gold/20 bg-paper/40 opacity-70 grayscale'
            }`}
          >
            <div className="text-3xl">{b.icon}</div>
            <h4 className={`mt-1 text-sm font-bold ${b.unlocked ? 'text-gold-soft' : 'text-ink'}`}>{b.title[isBn ? 'bn' : 'en']}</h4>
            <p className={`mt-0.5 text-xs ${b.unlocked ? 'text-ink/85' : 'text-ink/70'}`}>{b.desc[isBn ? 'bn' : 'en']}</p>
            {!b.unlocked && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/15">
                <div className="h-full bg-sapphire" style={{ width: `${b.progress}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
