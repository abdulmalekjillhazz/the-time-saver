'use client';

import { useState, useEffect } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

export function AdaptiveReplanModal({ routine, lang = 'bn', onClose, onCompleted }) {
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const isBn = lang === 'bn';
  const copy = {
    title: isBn ? '⚡ ৫-মিনিটের মাইক্রো রুটিন (Adaptive Re-plan)' : '⚡ 5-Minute Micro Routine (Adaptive Re-plan)',
    loading: isBn ? '৫ মিনিটের সহজ বিকল্প তৈরি হচ্ছে...' : 'Creating a simpler 5-minute fallback...',
    doingFiveMin: isBn ? 'ব্যস্ত দিন? পুরো সময় না পারলে ৫ মিনিটে সেরে নিন:' : 'Too busy? Complete this 5-minute version instead:',
    completeBtn: isBn ? '✓ ৫ মিনিটে সম্পন্ন করলাম' : '✓ Completed 5-Minute Version',
    completing: isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...',
    rescheduleTitle: isBn ? 'বা অন্য সময়ে শিফট করতে পারেন:' : 'Or reschedule to another time:',
    close: isBn ? 'বন্ধ করুন' : 'Close',
    error: isBn ? 'সাজেশন তৈরি করতে সমস্যা হয়েছে।' : 'Failed to generate re-plan.',
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    fetch('/api/assistant/replan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: routine._id || routine.id, lang }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (active) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(copy.error);
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [routine, lang, copy.error]);

  const handleCompleteMicro = async () => {
    setCompleting(true);
    try {
      const res = await fetch('/api/assistant/micro-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routineId: routine._id || routine.id,
          microNotes: data?.microAction || '5-min fallback',
        }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('smart-routine:sync', { detail: {} }));
        if (onCompleted) onCompleted();
        onClose();
      }
    } catch {
      setError(copy.error);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="adaptive-replan-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <Card className="surface-card glass-panel glow-border modal-pop w-full max-w-lg p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-gold/20 pb-3">
          <h2 id="adaptive-replan-title" className="section-heading text-lg">{copy.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 font-bold text-ink/70 hover:bg-gold/15 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm font-semibold text-sapphire">{routine.title} ({routine.startTime} - {routine.endTime})</p>

        {loading ? (
          <div className="py-8 text-center text-sm font-medium text-ink/75 animate-pulse">
            {copy.loading}
          </div>
        ) : error ? (
          <div role="alert" className="py-6 text-center text-sm font-semibold text-rose-400">{error}</div>
        ) : (
          <div className="mt-4 space-y-4">
            {data?.coachTip && (
              <div className="routine-tile glass-panel p-3 text-sm text-ink/90">
                💬 <span className="italic">{data.coachTip}</span>
              </div>
            )}

            <div className="routine-tile glass-panel p-4">
              <h3 className="eyebrow">
                {copy.doingFiveMin}
              </h3>
              <p className="mt-1 text-base font-bold text-gold-soft">
                ⚡ {data?.microAction}
              </p>
            </div>

            {data?.rescheduleTime && (
              <div className="routine-tile glass-panel p-3 text-xs text-ink/85">
                ⏰ <strong>{data.rescheduleTime}</strong> — {data.rescheduleReason}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-gold/20">
              <Button variant="secondary" className="min-h-[44px] px-4" onClick={onClose}>{copy.close}</Button>
              <Button className="min-h-[44px] px-4 font-bold" onClick={handleCompleteMicro} disabled={completing}>
                {completing ? copy.completing : copy.completeBtn}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
