'use client';

import { useState } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

export function EveningReflectionModal({ lang = 'bn', onClose, onSaved }) {
  const [selectedMood, setSelectedMood] = useState('happy');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const isBn = lang === 'bn';

  const copy = {
    title: isBn ? '🌙 ইভনিং ডিব্রিফ ও মুড ট্র্যাকার' : '🌙 Evening Debrief & Mood Tracker',
    prompt: isBn ? 'আজকের দিনটি আপনার কেমন কাটল?' : 'How did you feel about today?',
    notePlaceholder: isBn ? 'আজকের দিনের একটি ভালো দিক বা অনুভূতি লিখুন (ঐচ্ছিক)...' : 'Write a quick highlight or thought (optional)...',
    save: isBn ? 'সংরক্ষণ করুন (+৩০ XP)' : 'Save Reflection (+30 XP)',
    saving: isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...',
    close: isBn ? 'পরে করব' : 'Later',
    happy: isBn ? 'চনমনে' : 'Great',
    neutral: isBn ? 'স্বাভাবিক' : 'Neutral',
    tired: isBn ? 'ক্লান্ত' : 'Tired',
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/gamification/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: selectedMood, note }),
      });
      if (res.ok) {
        if (onSaved) onSaved();
        onClose();
      }
    } catch {}
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <Card className="surface-card w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gold/20 pb-3">
          <h3 className="section-heading text-lg">{copy.title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink/60 hover:text-ink">✕</button>
        </div>

        <p className="mt-4 text-sm font-semibold text-ink/90">{copy.prompt}</p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { id: 'happy', emoji: '😊', label: copy.happy },
            { id: 'neutral', emoji: '😐', label: copy.neutral },
            { id: 'tired', emoji: '😔', label: copy.tired },
          ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMood(m.id)}
                className={`rounded-xl border p-3 text-center transition-all ${
                  selectedMood === m.id
                    ? 'border-gold bg-gold/15 font-bold text-gold-soft shadow-sm'
                    : 'border-gold/25 bg-paper/60 text-ink/80 hover:bg-gold/10'
                }`}
              >
              <span className="text-2xl">{m.emoji}</span>
              <p className="mt-1 text-xs">{m.label}</p>
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={copy.notePlaceholder}
          className="mt-4 w-full rounded-xl border border-gold/25 p-3 text-sm focus:border-gold focus:outline-hidden"
        />

        <div className="mt-5 flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="secondary" onClick={onClose}>{copy.close}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? copy.saving : copy.save}
          </Button>
        </div>
      </Card>
    </div>
  );
}
