'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';
import { Card } from './ui/Card.jsx';

const COPY = {
  en: {
    title: 'Learning leaderboard',
    levels: 'Level up every 3 active learning days.',
    loading: 'Loading leaderboard…',
    error: 'The leaderboard could not be loaded. Please try again.',
    empty: 'No learning points yet. Read a story or complete a quiz to join.',
    points: 'points',
    activeDays: 'active days',
    pronunciation: 'pronunciation accuracy',
    nextLevel: (days) => `${days} active day${days === 1 ? '' : 's'} to next level`,
    level: 'Level',
  },
  bn: {
    title: 'শেখার লিডারবোর্ড',
    levels: 'প্রতি ৩টি সক্রিয় শেখার দিনে লেভেল বাড়বে।',
    loading: 'লিডারবোর্ড লোড হচ্ছে…',
    error: 'লিডারবোর্ড লোড করা যায়নি। আবার চেষ্টা করুন।',
    empty: 'এখনো শেখার পয়েন্ট নেই। গল্প পড়ুন বা কুইজ দিন।',
    points: 'পয়েন্ট',
    activeDays: 'সক্রিয় দিন',
    pronunciation: 'উচ্চারণের গড়',
    nextLevel: (days) => `পরের লেভেলে যেতে আরও ${days} সক্রিয় দিন`,
    level: 'লেভেল',
  },
};

function rankIcon(rank, isKing) {
  if (isKing) return '👑';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '✨';
}

function levelIcon(level) {
  return ['🌱', '📘', '🔥', '⭐', '🏆'][Math.min(level - 1, 4)];
}

export function LeaderboardPanel({ lang = 'bn' }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const copy = COPY[lang] || COPY.en;

  useEffect(() => {
    let active = true;
    const fetchLeaderboard = () => {
      apiRequest('/api/gamification/leaderboard', { locale: lang })
        .then(({ members: result }) => {
          if (active) setMembers(result);
        })
        .catch(() => {
          if (active) setError(copy.error);
        });
    };
    fetchLeaderboard();
    const handleUpdate = () => fetchLeaderboard();
    window.addEventListener('smart-routine:learning-activity', handleUpdate);
    window.addEventListener('smart-routine:points-awarded', handleUpdate);
    window.addEventListener('smart-routine:sync', handleUpdate);
    window.addEventListener('focus', fetchLeaderboard);
    return () => {
      active = false;
      window.removeEventListener('smart-routine:learning-activity', handleUpdate);
      window.removeEventListener('smart-routine:points-awarded', handleUpdate);
      window.removeEventListener('smart-routine:sync', handleUpdate);
      window.removeEventListener('focus', fetchLeaderboard);
    };
  }, [copy.error, lang]);

  return (
    <section className="space-y-4" aria-labelledby="learning-leaderboard-title">
      <Card className="surface-card glass-panel glow-border space-y-2 p-4 sm:p-6">
        <h1 id="learning-leaderboard-title" className="section-heading">
          <span aria-hidden="true">🏆</span> {copy.title}
        </h1>
        <p className="text-sm text-ink/80">{copy.subtitle}</p>
        <p className="text-sm font-semibold text-sapphire">{copy.levels}</p>
      </Card>

      {error ? <p role="alert" className="text-sm font-semibold text-rose-400">{error}</p> : null}
      {members === null && !error ? <p role="status">{copy.loading}</p> : null}
      {members?.length === 0 ? <Card className="surface-card glass-panel p-5"><p>{copy.empty}</p></Card> : null}
      {members?.length ? (
        <ol className="space-y-3">
          {members.map((member, index) => (
            <li key={member.userId}>
              <Card
                style={{ '--enter-delay': `${Math.min(index, 10) * 70}ms` }}
                className={`surface-card glass-panel enter-up flex items-center gap-3 p-3 transition-transform sm:gap-4 sm:p-4 ${member.isKing ? 'border-2 border-gold/70 shadow-[0_0_20px_rgba(242,193,78,0.35)] hover:-translate-y-0.5' : 'hover:-translate-y-0.5'}`}
              >
                <span className="w-8 shrink-0 text-center text-xl font-extrabold text-sapphire" aria-label={`Rank ${member.rank}`}>
                  {rankIcon(member.rank, member.isKing)}
                </span>
                <ProfileAvatar avatarId={member.avatarId} lang={lang} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{member.name}</p>
                  <p className="mt-0.5 text-xs text-ink/70">
                    {levelIcon(member.level)} {copy.level} {member.level} · {member.activeDays} {copy.activeDays}
                  </p>
                  {Number.isFinite(member.pronunciationScore) ? (
                    <p className="text-xs font-semibold text-emerald-700">
                      {copy.pronunciation}: {member.pronunciationScore}%
                    </p>
                  ) : null}
                  <p className="text-xs text-sapphire">{copy.nextLevel(member.daysToNextLevel)}</p>
                </div>
                <p className="shrink-0 text-right font-extrabold text-gold-soft">
                  {member.points} <span className="block text-[10px] font-semibold">{copy.points}</span>
                </p>
              </Card>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
