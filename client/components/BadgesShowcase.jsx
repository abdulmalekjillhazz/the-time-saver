'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { Card } from './ui/Card.jsx';

const LEARNING_BADGE_ICONS = {
  'early-bird': '🌅',
  'century-focus': '🏆',
  'quiz-master': '🧠',
  'consistent-learner': '🔥',
  'first-learning-day': '📖',
};

export function BadgesShowcase({ lang = 'bn' }) {
  const [badges, setBadges] = useState([]);
  const [learningSummary, setLearningSummary] = useState(null);
  const [learningError, setLearningError] = useState('');
  const isBn = lang === 'bn';

  useEffect(() => {
    let active = true;
    fetch('/api/completions/badges')
      .then((res) => res.json())
      .then((json) => {
        if (active && json.badges) setBadges(json.badges);
      })
      .catch(() => {});

    const loadLearningSummary = () => {
      apiRequest('/api/badges', { locale: lang })
        .then((summary) => {
          if (!active) return;
          setLearningSummary(summary);
          setLearningError('');
        })
        .catch((error) => {
          if (!active) return;
          setLearningError(error.message || (isBn ? 'শেখার স্ট্রিক ও ব্যাজ লোড করা যায়নি।' : 'Learning streak and badges could not be loaded.'));
        });
    };
    const onLearningActivity = () => loadLearningSummary();
    loadLearningSummary();
    window.addEventListener('smart-routine:learning-activity', onLearningActivity);
    window.addEventListener('focus', onLearningActivity);
    return () => {
      active = false;
      window.removeEventListener('smart-routine:learning-activity', onLearningActivity);
      window.removeEventListener('focus', onLearningActivity);
    };
  }, [isBn, lang]);

  if (!badges.length && !learningSummary && !learningError) return null;

  return (
    <Card className="surface-card glass-panel glow-border space-y-3 p-5">
      <h3 className="section-heading text-base">
        {isBn ? '🏅 অর্জিত ব্যাজ ও মাইলফলক (Badges)' : '🏅 Milestone Badges & Achievements'}
      </h3>
      {learningError ? <p role="alert" className="text-sm font-semibold text-rose-400">{learningError}</p> : null}
      {learningSummary ? (
        <section className="space-y-3 rounded-xl border border-gold/30 bg-gold/5 p-3" aria-label={isBn ? 'শেখার ধারাবাহিকতা' : 'Learning streak'}>
          <p className="font-semibold">
            🔥 {isBn ? 'শেখার স্ট্রিক' : 'Learning streak'}: {learningSummary.stats.learningStreak.current} {isBn ? 'দিন' : 'days'}
            {' · '}{isBn ? 'সর্বোচ্চ' : 'Best'}: {learningSummary.stats.learningStreak.longest} {isBn ? 'দিন' : 'days'}
          </p>
          <p className="text-sm opacity-80">
            {isBn ? 'পয়েন্ট অর্জন করা সক্রিয় দিন' : 'Learning days with earned points'}: {learningSummary.stats.totalLearningDays}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {learningSummary.badges.map((badge, index) => (
              <div
                key={badge.key}
                style={{ '--enter-delay': `${index * 60}ms` }}
                className={`enter-up rounded-xl border p-3 text-center transition-all ${
                  badge.earned
                    ? 'border-gold/50 bg-gold/10 shadow-sm hover:-translate-y-0.5 hover:shadow-[0_0_14px_rgba(242,193,78,0.4)]'
                    : 'border-gold/20 bg-paper/40 opacity-70 grayscale'
                }`}
              >
                <div className="text-3xl" aria-hidden="true">{LEARNING_BADGE_ICONS[badge.key] || '🏅'}</div>
                <h4 className={`mt-1 text-sm font-bold ${badge.earned ? 'text-gold-soft' : 'text-ink'}`}>
                  {badge.name[isBn ? 'bn' : 'en']}
                </h4>
                <p className={`mt-0.5 text-xs ${badge.earned ? 'text-ink/85' : 'text-ink/70'}`}>
                  {badge.description[isBn ? 'bn' : 'en']}
                </p>
                {badge.earned && badge.awardedAt ? (
                  <p className="mt-1 text-[10px] opacity-70">{new Date(badge.awardedAt).toLocaleDateString(isBn ? 'bn-BD' : 'en')}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {badges.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b, index) => (
            <div
              key={b.id}
              style={{ '--enter-delay': `${index * 60}ms` }}
              className={`enter-up rounded-xl border p-3 text-center transition-all ${
                b.unlocked
                  ? 'border-gold/50 bg-gold/10 shadow-sm hover:-translate-y-0.5 hover:shadow-[0_0_14px_rgba(242,193,78,0.4)]'
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
      ) : null}
    </Card>
  );
}
