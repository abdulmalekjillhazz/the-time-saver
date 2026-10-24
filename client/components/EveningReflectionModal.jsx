'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

export function EveningReflectionModal({ lang = 'bn', onClose, onSaved }) {
  const [selectedMood, setSelectedMood] = useState('happy');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isBn = lang === 'bn';

  const copy = {
    title: isBn ? '🌙 ইভনিং ডিব্রিফ ও মুড ট্র্যাকার' : '🌙 Evening Debrief & Mood Tracker',
    prompt: isBn ? 'আজকের দিনটি আপনার কেমন কাটল?' : 'How did you feel about today?',
    notePlaceholder: isBn ? 'আজকের দিনের একটি ভালো দিক বা অনুভূতি লিখুন (ঐচ্ছিক)...' : 'Write a quick highlight or thought (optional)...',
    save: isBn ? 'সংরক্ষণ করুন' : 'Save Reflection',
    saving: isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...',
    error: isBn ? 'সংরক্ষণ করা যায়নি। ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।' : 'Could not save your reflection. Check your connection and try again.',
    close: isBn ? 'পরে করব' : 'Later',
    happy: isBn ? 'চনমনে' : 'Great',
    neutral: isBn ? 'স্বাভাবিক' : 'Neutral',
    tired: isBn ? 'ক্লান্ত' : 'Tired',
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await apiRequest('/api/gamification/reflection', {
        method: 'POST',
        body: { mood: selectedMood, note },
        locale: lang,
      });
      onSaved?.(result);
      onClose();
    } catch (requestError) {
      setError(requestError?.message || copy.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evening-reflection-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <Card className="surface-card glass-panel glow-border modal-pop w-full max-w-md p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-gold/20 pb-3">
          <h2 id="evening-reflection-title" className="section-heading text-lg">{copy.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 font-bold text-ink/70 hover:bg-gold/15 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            ✕
          </button>
        </div>

        <p className="mt-4 text-sm font-semibold text-ink/90">{copy.prompt}</p>
        {error ? (
          <p role="alert" className="mt-3 rounded-lg border border-rose-400/50 bg-rose-500/10 p-2.5 text-sm font-semibold text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { id: 'happy', emoji: '😊', label: copy.happy },
            { id: 'neutral', emoji: '😐', label: copy.neutral },
            { id: 'tired', emoji: '😔', label: copy.tired },
          ].map((m, index) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMood(m.id)}
              style={{ '--enter-delay': `${120 + index * 70}ms` }}
              className={`enter-up flex min-h-[44px] flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                selectedMood === m.id
                  ? 'border-gold bg-gold/15 font-bold text-gold-soft shadow-[0_0_14px_rgba(242,193,78,0.4)]'
                  : 'border-gold/25 bg-paper/60 text-ink/80 hover:bg-gold/10'
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{m.emoji}</span>
              <p className="mt-1 text-xs font-bold">{m.label}</p>
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={copy.notePlaceholder}
          className="mt-4 w-full rounded-xl border border-gold/25 bg-paper/70 p-3 text-sm text-ink focus:border-gold focus:outline-none"
        />

        <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-gold/20 pt-3">
          <Button variant="secondary" className="min-h-[44px] px-4" onClick={onClose}>{copy.close}</Button>
          <Button className="min-h-[44px] px-4 font-bold" onClick={handleSave} disabled={saving}>
            {saving ? copy.saving : copy.save}
          </Button>
        </div>
      </Card>
    </div>
  );
}
