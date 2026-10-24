'use client';

import { useState, useEffect } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { toBanglaNumber } from '../lib/prayerAnchors.js';
import { apiRequest } from '../lib/apiClient.js';

const STREAK_POINTS = [
  [18, 38],
  [58, 18],
  [99, 46],
  [142, 22],
  [184, 47],
  [226, 16],
  [270, 38],
];

export function TodayProgressCard({
  lang = 'bn',
  userId,
  routines = [],
  onScrollToAddRoutine,
  onScrollToAlarms,
}) {
  const isBn = lang === 'bn';
  const [isOnline, setIsOnline] = useState(true);
  const [learningStreak, setLearningStreak] = useState(null);
  const [learningStreakError, setLearningStreakError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
    let active = true;
    const loadLearningStreak = async () => {
      try {
        const summary = await apiRequest('/api/badges', { locale: lang });
        if (active) {
          setLearningStreak(summary.stats.learningStreak);
          setLearningStreakError('');
        }
      } catch (error) {
        if (active) {
          setLearningStreakError(error.message || (isBn
            ? 'শেখার স্ট্রিক লোড করা যায়নি।'
            : 'Learning streak could not be loaded.'));
        }
      }
    };
    const refresh = () => { void loadLearningStreak(); };
    refresh();
    window.addEventListener('smart-routine:learning-activity', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('smart-routine:learning-activity', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [isBn, lang, userId]);

  const total = routines.length;
  const completed = routines.filter((r) => r.completionStatus === 'done').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const litStreakDays = Math.min(learningStreak?.current ?? 0, STREAK_POINTS.length);

  const encouragement = (() => {
    if (total === 0) {
      return isBn
        ? 'আজকের দিনটি নতুন করে সাজান 🌱'
        : 'Plan your day with simple routines 🌱';
    }
    if (percentage === 100) {
      return isBn
        ? 'দারুণ কাজ! আজকের সব রুটিন সফলভাবে সম্পন্ন! 🎉'
        : 'Outstanding! All routines completed today! 🎉';
    }
    if (completed > 0) {
      return isBn
        ? `${toBanglaNumber(completed)}/${toBanglaNumber(total)} টি সম্পন্ন (${toBanglaNumber(percentage)}%) — গতি ধরে রাখুন! ✨`
        : `${completed}/${total} completed (${percentage}%) — Keep your momentum! ✨`;
    }
    return isBn
      ? 'একটি ছোট পদক্ষেপ দিয়ে আজকের রুটিন শুরু করুন 💪'
      : 'Take a small step to begin today’s routine 💪';
  })();

  const scrollToAlarms = () => {
    if (onScrollToAlarms) {
      onScrollToAlarms();
      return;
    }
    const el = document.getElementById('alarm-section-card');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Card className="today-progress-hero surface-card glass-panel glow-border space-y-3 border border-sapphire/30 p-4">
      {!isOnline && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold-soft"
        >
          <span>📶</span>
          <span>
            {isBn
              ? 'অফলাইন মোড — ডেটা আপনার ফোনে নিরাপদে সংরক্ষিত হচ্ছে'
              : 'Offline Mode — Your changes are safely stored on this device'}
          </span>
        </div>
      )}

      <div className="streak-ledger">
        <h2 className="text-base font-bold text-ink sm:text-lg">
          {isBn ? 'আজকের ধারা' : 'Today’s constellation'}
        </h2>
        <svg
          className="streak-constellation"
          viewBox="0 0 288 64"
          role="img"
          aria-label={isBn ? 'শেখার ধারাবাহিকতার নক্ষত্রমণ্ডল' : 'Learning streak constellation'}
        >
          {STREAK_POINTS.slice(0, -1).map(([x1, y1], index) => {
            const [x2, y2] = STREAK_POINTS[index + 1];
            return (
              <line
                key={`link-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={`constellation-link ${index < litStreakDays - 1 ? 'is-lit' : ''}`}
              />
            );
          })}
          {STREAK_POINTS.map(([cx, cy], index) => (
            <circle
              key={`day-${index}`}
              cx={cx}
              cy={cy}
              r={index === litStreakDays - 1 && litStreakDays > 0 ? 5 : 3.5}
              className={`constellation-node ${index < litStreakDays ? 'is-lit' : ''}`}
              style={{ '--node-delay': `${index * 85}ms` }}
            />
          ))}
        </svg>
        <p className="streak-count" aria-live="polite">
          <strong>{learningStreak ? (isBn ? toBanglaNumber(learningStreak.current) : learningStreak.current) : '—'}</strong>
          <span>{isBn ? 'দিনের শেখার ধারা' : 'day learning streak'}</span>
        </p>
        <p className="streak-best">
          {learningStreakError
            ? learningStreakError
            : learningStreak
              ? isBn
                ? `সর্বোচ্চ ${toBanglaNumber(learningStreak.longest)} দিন`
                : `Best: ${learningStreak.longest} days`
              : isBn ? 'শেখার ধারা লোড হচ্ছে…' : 'Loading learning streak…'}
        </p>
      </div>

      <div className="streak-actions">
        <div>
          <h2 className="text-sm font-semibold text-ink/80">
            {isBn ? 'আজকের অগ্রগতি' : 'Today’s momentum'}
          </h2>
          <p className="text-xs font-medium text-ink/75 sm:text-sm">
            {encouragement}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="flex min-h-[44px] w-full items-center justify-center px-3 text-xs font-bold transition-transform duration-200 active:scale-95 sm:text-sm touch-manipulation"
            onClick={scrollToAlarms}
            title={isBn ? 'কাস্টম ভয়েস ও নোটিফিকেশন অ্যালার্ম সেট করুন' : 'Set custom voice & notification alarm'}
          >
            <span aria-hidden="true" className="mr-1.5">⏰</span>
            <span>{isBn ? 'অ্যালার্ম সেট' : 'Set Alarm'}</span>
          </Button>

          {onScrollToAddRoutine && (
            <Button
              variant="primary"
              className="flex min-h-[44px] w-full items-center justify-center px-3 text-xs font-bold shadow-[0_8px_24px_-8px_rgba(96,165,250,0.6)] transition-transform duration-200 active:scale-95 sm:text-sm touch-manipulation"
              onClick={onScrollToAddRoutine}
            >
              <span aria-hidden="true" className="mr-1">➕</span>
              <span>{isBn ? 'রুটিন যোগ' : 'Add Routine'}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="routine-constellation-summary">
        {total > 0 ? (
          <div className="routine-constellation" role="img" aria-label={isBn
            ? `${toBanglaNumber(completed)} টি রুটিন সম্পন্ন, ${toBanglaNumber(total - completed)} টি বাকি`
            : `${completed} routines complete, ${total - completed} remaining`}>
            {routines.map((routine) => (
              <span
                key={routine.id}
                className={`routine-constellation-node ${routine.completionStatus === 'done' ? 'is-lit' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
        ) : null}
        <p className="routine-constellation-caption">
          {isBn
            ? `সম্পন্ন ${toBanglaNumber(completed)} · বাকি ${toBanglaNumber(total - completed)}`
            : `${completed} complete · ${total - completed} remaining`}
        </p>
        {total > 0 ? (
          <span
            className="sr-only"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={isBn ? 'আজকের রুটিন সম্পন্ন করার অগ্রগতি' : "Today's routine progress"}
            aria-valuetext={isBn ? `${toBanglaNumber(percentage)}% সম্পন্ন` : `${percentage}% completed`}
          />
        ) : null}
      </div>
    </Card>
  );
}
