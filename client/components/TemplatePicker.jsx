'use client';

import { useState } from 'react';
import { apiRequest } from '../lib/apiClient.js';
import { ROUTINE_TEMPLATES, templateTitle } from '../lib/routineTemplates.js';
import { Card } from './ui/Card.jsx';

const COPY = {
  en: { title: 'Quick-add templates', added: 'Added', error: 'Could not add this routine.' },
  bn: { title: 'দ্রুত টেমপ্লেট যোগ করো', added: 'যোগ হয়েছে', error: 'এই রুটিনটি যোগ করা যায়নি।' },
};

export function TemplatePicker({ lang = 'en', onRoutineAdded }) {
  const copy = COPY[lang] ?? COPY.en;
  const [addedIds, setAddedIds] = useState(new Set());
  const [error, setError] = useState('');

  async function addTemplate(template) {
    setError('');
    try {
      await apiRequest('/api/routines', {
        method: 'POST',
        body: {
          title: templateTitle(template, lang),
          startTime: template.startTime,
          endTime: template.endTime,
          category: template.category,
          priority: template.priority,
          isFrog: template.isFrog,
        },
      });
      setAddedIds((prev) => new Set(prev).add(template.id));
      onRoutineAdded?.();
    } catch {
      setError(copy.error);
    }
  }

  return (
    <Card className="surface-card space-y-3">
      <h2 className="section-heading">{copy.title}</h2>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ROUTINE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => addTemplate(template)}
            disabled={addedIds.has(template.id)}
            className="flex items-center justify-between gap-2 rounded-xl border border-sapphire/20 px-3 py-2 text-left text-sm disabled:opacity-50"
          >
            <span>
              <span className="block font-semibold">{templateTitle(template, lang)}</span>
              <span className="block opacity-70">{template.startTime}–{template.endTime}</span>
            </span>
            {addedIds.has(template.id) ? <span aria-hidden="true">✅</span> : <span aria-hidden="true">➕</span>}
          </button>
        ))}
      </div>
    </Card>
  );
}
