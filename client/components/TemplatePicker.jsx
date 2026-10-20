'use client';

import { useEffect, useState } from 'react';
import { enqueueAndFlush, getOutboxOperations, subscribeOutbox } from '../lib/outboxClient.js';
import { clearTemplateClientId, getTemplateClientId, peekTemplateClientId } from '../lib/templateClientId.js';
import { ROUTINE_TEMPLATES, templateTitle } from '../lib/routineTemplates.js';
import { Card } from './ui/Card.jsx';

const COPY = {
  en: { title: 'Quick-add templates', added: 'Added', queued: 'Queued on this device; will sync when online.', error: 'Could not add this routine. Check your connection and try again.' },
  bn: { title: 'দ্রুত টেমপ্লেট যোগ করো', added: 'যোগ হয়েছে', queued: 'ডিভাইসে সিঙ্কের জন্য অপেক্ষমাণ রাখা হয়েছে; ইন্টারনেট এলে সিঙ্ক হবে।', error: 'রুটিন যোগ করা যায়নি। ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করো।' },
};

export function TemplatePicker({ lang = 'en', userId, onRoutineAdded }) {
  const copy = COPY[lang] ?? COPY.en;
  const [addedIds, setAddedIds] = useState(new Set());
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [queuedIds, setQueuedIds] = useState(new Set());

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    const reconcileFailedTemplates = async () => {
      try {
        const operations = await getOutboxOperations(userId);
        if (!active) return;
        const routineOps = operations.filter((op) => op.type === 'routine.create');
        const activeClientIds = new Set(routineOps.map((op) => op.data?.clientId).filter(Boolean));
        const failedClientIds = new Set(routineOps.filter((op) => op.status === 'failed').map((op) => op.data?.clientId));
        const failedTemplates = ROUTINE_TEMPLATES.filter((template) => {
          const clientId = peekTemplateClientId(userId, template.id);
          return clientId ? failedClientIds.has(clientId) : false;
        });
        setQueuedIds((prev) => new Set([...prev].filter((id) => {
          const clientId = peekTemplateClientId(userId, id);
          return clientId ? activeClientIds.has(clientId) : false;
        })));
        if (!failedTemplates.length) return;
        const failedIds = new Set(failedTemplates.map((template) => template.id));
        setAddedIds((prev) => new Set([...prev].filter((id) => !failedIds.has(id))));
        setQueuedIds((prev) => new Set([...prev].filter((id) => !failedIds.has(id))));
        setError(copy.error);
      } catch {
        // The outbox status is best-effort UI feedback; never crash the picker.
      }
    };
    reconcileFailedTemplates();
    const unsubscribe = subscribeOutbox(userId, reconcileFailedTemplates);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, copy.error]);

  async function addTemplate(template) {
    if (!userId || busyId) return;
    setError('');
    setBusyId(template.id);
    try {
      const result = await enqueueAndFlush(userId, {
        type: 'routine.create',
        data: {
          title: templateTitle(template, lang),
          startTime: template.startTime,
          endTime: template.endTime,
          category: template.category,
          priority: template.priority,
          isFrog: template.isFrog,
          clientId: getTemplateClientId(userId, template.id),
        },
      });
      if (result.operationStatus === 'failed') throw new Error('Routine was rejected by the server.');
      // Keep the clientId while pending so retries remain idempotent. Once the
      // outbox confirms delivery, release it so a future intentional add can
      // create a new routine instead of resolving to the old one forever.
      if (!(result.operationStatus === 'pending' || result.retryable || result.busy)) {
        clearTemplateClientId(userId, template.id);
      }
      setAddedIds((prev) => new Set(prev).add(template.id));
      if (result.operationStatus === 'pending' || result.retryable || result.busy) {
        setQueuedIds((prev) => new Set(prev).add(template.id));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smart-routine:sync', { detail: { userId } }));
      }
      onRoutineAdded?.();
    } catch (requestError) {
      setError(requestError?.message ? `${copy.error} (${requestError.message})` : copy.error);
    } finally {
      setBusyId('');
    }
  }

  return (
    <Card className="surface-card space-y-3">
      <h2 className="section-heading">{copy.title}</h2>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {queuedIds.size ? <p role="status" className="text-sm opacity-80">{copy.queued}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ROUTINE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => addTemplate(template)}
            disabled={!userId || busyId === template.id || addedIds.has(template.id)}
            className="flex items-center justify-between gap-2 rounded-xl border border-sapphire/20 px-3 py-2 text-left text-sm disabled:opacity-50"
          >
            <span>
              <span className="block font-semibold">{templateTitle(template, lang)}</span>
              <span className="block opacity-70">{template.startTime}–{template.endTime}</span>
            </span>
            {busyId === template.id ? <span aria-label="Adding">…</span> : addedIds.has(template.id) ? <span aria-hidden="true">{queuedIds.has(template.id) ? '🕓' : '✅'}</span> : <span aria-hidden="true">➕</span>}
          </button>
        ))}
      </div>
    </Card>
  );
}
