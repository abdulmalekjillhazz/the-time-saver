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
    rescheduleTitle: isBn ? 'বা অন্য সময়ে শিফট করতে পারেন:' : 'Or reschedule to another time:',
    close: isBn ? 'বন্ধ করুন' : 'Close',
    error: isBn ? 'সাজেশন তৈরি করতে সমস্যা হয়েছে।' : 'Failed to generate re-plan.',
  };

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
  }, [routine, lang]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <Card className="surface-card w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gold/20 pb-3">
          <h2 className="section-heading text-lg">{copy.title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink/60 hover:text-ink">✕</button>
        </div>

        <p className="mt-2 text-sm font-semibold text-sapphire">{routine.title} ({routine.startTime} - {routine.endTime})</p>

        {loading ? (
          <div className="py-8 text-center text-sm font-medium text-ink/75 animate-pulse">
            {copy.loading}
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-red-400">{error}</div>
        ) : (
          <div className="mt-4 space-y-4">
            {data?.coachTip && (
              <div className="routine-tile p-3 text-sm text-ink/90">
                💬 <span className="italic">{data.coachTip}</span>
              </div>
            )}

            <div className="routine-tile p-4">
              <h3 className="eyebrow">
                {copy.doingFiveMin}
              </h3>
              <p className="mt-1 text-base font-bold">
                ⚡ {data?.microAction}
              </p>
            </div>

            {data?.rescheduleTime && (
              <div className="routine-tile p-3 text-xs text-ink/85">
                ⏰ <strong>{data.rescheduleTime}</strong> — {data.rescheduleReason}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
              <Button variant="secondary" onClick={onClose}>{copy.close}</Button>
              <Button onClick={handleCompleteMicro} disabled={completing}>
                {completing ? copy.completing : copy.completeBtn}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
