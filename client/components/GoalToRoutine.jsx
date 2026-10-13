'use client';

import { useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { AiBadge } from './ui/AiBadge.jsx';
import { Button } from './ui/Button.jsx';
import { Card } from './ui/Card.jsx';

const COPY = {
  en: {
    title: 'Turn a goal into a routine', hint: 'e.g. "I want to study for my HSC exam and also learn JavaScript"',
    placeholder: 'What do you want to achieve?', generate: 'Generate routine', generating: 'Thinking…',
    addAll: 'Add all to my routines', added: 'Added to your routines.', frog: 'Frog task', error: 'Could not generate a routine right now. Please try again.',
  },
  bn: {
    title: 'লক্ষ্য থেকে রুটিন বানাও', hint: 'যেমন: "আমি HSC পরীক্ষার পড়া শেষ করতে চাই আর JavaScript শিখতে চাই"',
    placeholder: 'তুমি কী অর্জন করতে চাও?', generate: 'রুটিন তৈরি করো', generating: 'ভাবছে…',
    addAll: 'সব রুটিনে যোগ করো', added: 'তোমার রুটিনে যোগ হয়ে গেছে।', frog: 'প্রধান কাজ', error: 'এখন রুটিন তৈরি করা যায়নি। আবার চেষ্টা করো।',
  },
};

export function GoalToRoutine({ lang = 'en', onRoutinesAdded }) {
  const copy = COPY[lang] ?? COPY.en;
  const [intent, setIntent] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  async function generate(event) {
    event.preventDefault();
    if (!intent.trim()) return;
    setBusy(true);
    setError('');
    setAdded(false);
    try {
      const data = await apiRequest('/api/assistant/generate', { method: 'POST', body: { intent, lang } });
      setDrafts(data.drafts);
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  async function addAll() {
    setBusy(true);
    try {
      for (const draft of drafts) {
        // eslint-disable-next-line no-await-in-loop
        await apiRequest('/api/routines', { method: 'POST', body: draft });
      }
      setAdded(true);
      setDrafts([]);
      onRoutinesAdded?.();
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="surface-card space-y-3">
      <header className="flex items-center gap-2">
        <AiBadge lang={lang} />
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
      {added ? <p role="status" className="text-sm text-green-700">{copy.added}</p> : null}

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
