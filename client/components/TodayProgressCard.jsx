'use client';

import { useState, useEffect } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { toBanglaNumber } from '../lib/prayerAnchors.js';
import { apiRequest } from '../lib/apiClient.js';

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
    <Card className="surface-card space-y-3 border border-sapphire/30 bg-gradient-to-r from-sapphire/10 via-transparent to-gold/10 p-4">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink sm:text-lg">
            {isBn ? 'আজকের অগ্রগতি' : 'Today’s Momentum'}
          </h2>
          <p className="text-xs font-medium text-ink/75 sm:text-sm">
            {encouragement}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="flex min-h-[44px] w-full items-center justify-center px-3 text-xs font-bold sm:text-sm touch-manipulation"
            onClick={scrollToAlarms}
            title={isBn ? 'কাস্টম ভয়েস ও নোটিফিকেশন অ্যালার্ম সেট করুন' : 'Set custom voice & notification alarm'}
          >
            <span aria-hidden="true" className="mr-1.5">⏰</span>
            <span>{isBn ? 'অ্যালার্ম সেট' : 'Set Alarm'}</span>
          </Button>

          {onScrollToAddRoutine && (
            <Button
              variant="primary"
              className="flex min-h-[44px] w-full items-center justify-center px-3 text-xs font-bold sm:text-sm touch-manipulation"
              onClick={onScrollToAddRoutine}
            >
              <span aria-hidden="true" className="mr-1">➕</span>
              <span>{isBn ? 'রুটিন যোগ' : 'Add Routine'}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sapphire/20 bg-paper/60 px-3 py-2 text-sm">
        <span aria-hidden="true">{learningStreakError ? '⚠️' : '🔥'}</span>
        <span className="font-semibold">
          {learningStreakError || (learningStreak
            ? isBn
              ? `শেখার স্ট্রিক: ${toBanglaNumber(learningStreak.current)} দিন`
              : `Learning streak: ${learningStreak.current} days`
            : isBn ? 'শেখার স্ট্রিক লোড হচ্ছে…' : 'Loading learning streak…')}
        </span>
        {learningStreak ? (
          <span className="text-xs opacity-70">
            {learningStreak.current > 0
              ? isBn
                ? `সর্বোচ্চ ${toBanglaNumber(learningStreak.longest)} দিন · প্রতিদিন গল্প শেষ করুন বা কুইজ জমা দিন`
                : `Best: ${learningStreak.longest} days · Finish a story or submit a quiz each day`
              : isBn
                ? 'গল্প শেষ করুন বা কুইজ জমা দিন; একদিন বাদ গেলে নতুন করে শুরু হবে'
                : 'Finish a story or submit a quiz; missing a day restarts the streak'}
          </span>
        ) : null}
      </div>

      {total > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper/60 border border-sapphire/20">
            <div
              className="h-full rounded-full bg-sapphire transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={isBn ? 'আজকের রুটিন সম্পন্ন করার অগ্রগতি' : "Today's routine progress"}
              aria-valuetext={isBn ? `${toBanglaNumber(percentage)}% সম্পন্ন` : `${percentage}% completed`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-ink/70">
            <span>
              {isBn
                ? `সম্পন্ন: ${toBanglaNumber(completed)} টি`
                : `Completed: ${completed}`}
            </span>
            <span>
              {isBn
                ? `বাকি: ${toBanglaNumber(total - completed)} টি`
                : `Remaining: ${total - completed}`}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
