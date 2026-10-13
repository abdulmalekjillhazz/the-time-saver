'use client';
import { useState, useEffect } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { toBanglaNumber } from '../lib/prayerAnchors.js';

export function TodayProgressCard({ lang = 'bn', routines = [], onOpenVoiceBriefing, onScrollToAddRoutine }) {
  const isBn = lang === 'bn';
  const [isOnline, setIsOnline] = useState(true);

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

  const total = routines.length;
  const completed = routines.filter((r) => r.completionStatus === 'done').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="surface-card space-y-3 border border-sapphire/30 bg-gradient-to-r from-sapphire/10 via-transparent to-gold/10 p-4">
      {!isOnline && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold-soft">
          <span>📶</span>
          <span>{isBn ? 'অফলাইন মোড — ডেটা আপনার ফোনে নিরাপদে সংরক্ষিত হচ্ছে' : 'Offline Mode — Changes safely saved on device'}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink sm:text-lg">{isBn ? 'আজকের অগ্রগতি' : 'Today’s Momentum'}</h2>
          <p className="text-xs font-medium text-ink/75 sm:text-sm">
            {completed > 0 ? (isBn ? `${toBanglaNumber(completed)}/${toBanglaNumber(total)} সম্পন্ন (${toBanglaNumber(percentage)}%)` : `${completed}/${total} completed (${percentage}%)`) : (isBn ? 'রুটিন শুরু করুন 💪' : 'Start your routines 💪')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenVoiceBriefing && (
            <Button variant="secondary" className="min-h-[38px] px-3 text-xs sm:text-sm" onClick={onOpenVoiceBriefing}>
              <span aria-hidden="true" className="mr-1.5">🎙️</span>
              <span>{isBn ? 'অডিও ব্রিফিং' : 'Voice Briefing'}</span>
            </Button>
          )}
          {onScrollToAddRoutine && (
            <Button variant="primary" className="min-h-[38px] px-3 text-xs sm:text-sm" onClick={onScrollToAddRoutine}>
              <span aria-hidden="true" className="mr-1">➕</span>
              <span>{isBn ? 'রুটিন যোগ' : 'Add Routine'}</span>
            </Button>
          )}
        </div>
      </div>
      {total > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper/60 border border-sapphire/20">
            <div className="h-full rounded-full bg-sapphire transition-all duration-500 ease-out" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      )}
    </Card>
  );
}
