'use client';

import { useState } from 'react';
import { createUuidV4 } from '@smart-routine/shared';
import { apiRequest } from '../lib/apiClient.js';
import { enqueueAndFlush } from '../lib/outboxClient.js';
import { Button } from './ui/Button.jsx';
import { Card } from './ui/Card.jsx';

const COPY = {
  en: {
    title: 'Turn a goal into a routine', hint: 'e.g. "I want to study for my HSC exam and also learn JavaScript"',
    placeholder: 'What do you want to achieve?', generate: 'Generate routine', generating: 'Thinking…',
    addAll: 'Add all to my routines', added: 'Added to your routines.', queued: 'Queued on this device; will sync when online.', frog: 'Frog task', error: 'Could not generate or add the routine. Check your connection and try again.',
  },
  bn: {
    title: 'লক্ষ্য থেকে রুটিন বানাও', hint: 'যেমন: "আমি HSC পরীক্ষার পড়া শেষ করতে চাই আর JavaScript শিখতে চাই"',
    placeholder: 'তুমি কী অর্জন করতে চাও?', generate: 'রুটিন তৈরি করো', generating: 'ভাবছে…',
    addAll: 'সব রুটিনে যোগ করো', added: 'তোমার রুটিনে যোগ হয়ে গেছে।', frog: 'প্রধান কাজ', error: 'রুটিন তৈরি বা যোগ করা যায়নি। ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করো।',
  },
};

export function GoalToRoutine({ lang = 'en', userId, onRoutinesAdded }) {
  const copy = COPY[lang] ?? COPY.en;
  const [intent, setIntent] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [queued, setQueued] = useState(false);

  async function generate(event) {
    event.preventDefault();
    if (!intent.trim()) return;
    setBusy(true);
    setError('');
    setAdded(false);
    try {
      const data = await apiRequest('/api/assistant/generate', { method: 'POST', body: { intent, lang } });
      setDrafts((Array.isArray(data.drafts) ? data.drafts : []).map((draft) => ({
        title: String(draft.title || '').trim().slice(0, 120),
        startTime: draft.startTime,
        endTime: draft.endTime,
        category: typeof draft.category === 'string' ? draft.category.slice(0, 40) : 'general',
        priority: ['high', 'medium', 'low'].includes(draft.priority) ? draft.priority : 'medium',
        isFrog: Boolean(draft.isFrog),
        note: typeof draft.note === 'string' ? draft.note.slice(0, 300) : '',
        anchorHabit: typeof draft.anchorHabit === 'string' ? draft.anchorHabit.slice(0, 120) : '',
        clientId: draft.clientId || createUuidV4(),
      })));
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  async function addAll() {
    if (!userId || !drafts.length) return;
    setBusy(true);
    setError('');
    setAdded(false);
    setQueued(false);
    try {
      let hasQueued = false;
      for (const draft of drafts) {
        const payload = {
          title: String(draft.title || '').trim().slice(0, 120),
          startTime: draft.startTime,
          endTime: draft.endTime,
          category: typeof draft.category === 'string' ? draft.category.slice(0, 40) : 'general',
          priority: ['high', 'medium', 'low'].includes(draft.priority) ? draft.priority : 'medium',
          isFrog: Boolean(draft.isFrog),
          note: typeof draft.note === 'string' ? draft.note.slice(0, 300) : '',
          anchorHabit: typeof draft.anchorHabit === 'string' ? draft.anchorHabit.slice(0, 120) : '',
          clientId: draft.clientId || createUuidV4(),
        };
        const result = await enqueueAndFlush(userId, {
          type: 'routine.create',
          data: payload,
        });
        if (result.operationStatus === 'failed') throw new Error('A routine was rejected by the server.');
        if (result.operationStatus === 'pending' || result.retryable || result.busy) hasQueued = true;
      }
      setAdded(true);
      setQueued(hasQueued);
      setDrafts([]);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smart-routine:sync', { detail: { userId } }));
      }
      onRoutinesAdded?.();
    } catch (requestError) {
      setError(requestError?.message ? `${copy.error} (${requestError.message})` : copy.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="surface-card space-y-3">
      <header className="flex items-center gap-2">
        <span aria-hidden="true">🎯</span>
        <h2 className="section-heading">{copy.title}</h2>
      </header>
      <p className="text-sm opacity-80">{copy.hint}</p>
      <form onSubmit={generate} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder={copy.placeholder}
          className="min-w-[200px] flex-1 rounded-xl border border-sapphire/30 px-3 py-2"
        />
        <Button type="submit" disabled={busy}>{busy ? copy.generating : copy.generate}</Button>
      </form>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {added ? <p role="status" className="text-sm text-green-700">{queued ? copy.queued : copy.added}</p> : null}

      {drafts.length ? (
        <div className="space-y-2">
          <ul className="space-y-1">
            {drafts.map((d, i) => (
              <li key={`${d.title}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{d.startTime}–{d.endTime}</span>
                <span>{d.title}</span>
                {d.isFrog ? <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold">🐸 {copy.frog}</span> : null}
              </li>
            ))}
          </ul>
          <Button onClick={addAll} disabled={busy}>{copy.addAll}</Button>
        </div>
      ) : null}
    </Card>
  );
}
