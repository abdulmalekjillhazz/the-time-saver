'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from './ui/Button.jsx';
import { Card } from './ui/Card.jsx';
import {
  discardOutboxOperation,
  flushOutbox,
  getOutboxOperations,
  getOutboxSummary,
  retryOutboxOperation,
  subscribeOutbox,
} from '../lib/outboxClient.js';

const COPY = {
  en: {
    pending: (count) => `${count} change${count === 1 ? '' : 's'} waiting to sync.`,
    failed: (count) => `${count} change${count === 1 ? '' : 's'} need attention.`,
    retry: 'Sync now',
    retryOne: 'Retry',
    discard: 'Discard',
    failedOperation: (type, title) => `${type}${title ? `: ${title}` : ''}`,
    offline: 'Offline. Changes will sync when you reconnect.',
    error: 'Could not read the sync queue.',
  },
  bn: {
    pending: (count) => `সিঙ্কের জন্য ${count}টি পরিবর্তন অপেক্ষায় আছে।`,
    failed: (count) => `${count}টি পরিবর্তনের জন্য আপনার পদক্ষেপ দরকার।`,
    retry: 'এখন সিঙ্ক করুন',
    retryOne: 'আবার চেষ্টা',
    discard: 'বাদ দিন',
    failedOperation: (type, title) => `${type}${title ? `: ${title}` : ''}`,
    offline: 'ইন্টারনেট নেই। সংযোগ ফিরলে পরিবর্তনগুলো সিঙ্ক হবে।',
    error: 'সিঙ্কের তালিকা পড়া যায়নি।',
  },
};

export function SyncStatus({ userId, lang = 'bn' }) {
  const [summary, setSummary] = useState({ pending: 0, failed: 0 });
  const [failedOperations, setFailedOperations] = useState([]);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const copy = COPY[lang] || COPY.en;

  const refresh = useCallback(async () => {
    try {
      setSummary(await getOutboxSummary(userId));
      setFailedOperations((await getOutboxOperations(userId)).filter((operation) => operation.status === 'failed'));
      setError('');
    } catch {
      setError(copy.error);
    }
  }, [copy.error, userId]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const unsubscribe = subscribeOutbox(userId, refresh);
    const handleOnline = () => {
      setOnline(true);
      flushOutbox(userId).catch(() => setError(copy.error));
    };
    const handleOffline = () => setOnline(false);
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [copy.error, refresh, userId]);

  async function syncNow() {
    setBusy(true);
    try {
      await flushOutbox(userId);
      await refresh();
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  async function retryOne(opId) {
    setBusy(true);
    try {
      await retryOutboxOperation(userId, opId);
      await refresh();
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  async function discardOne(opId) {
    setBusy(true);
    try {
      await discardOutboxOperation(userId, opId);
      await refresh();
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  if (!error && online && summary.pending === 0 && summary.failed === 0) return null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3" role="status" aria-live="polite">
      <div className="space-y-1">
        {!online ? <p>{copy.offline}</p> : null}
        {summary.pending ? <p>{copy.pending(summary.pending)}</p> : null}
        {summary.failed ? <p>{copy.failed(summary.failed)}</p> : null}
        {error ? <p>{error}</p> : null}
      </div>
      {online && (summary.pending > 0 || summary.failed > 0) ? (
        <Button onClick={syncNow} disabled={busy}>{copy.retry}</Button>
      ) : null}
      {failedOperations.length ? (
        <ul className="w-full space-y-2">
          {failedOperations.map((operation) => {
            const name = operation.data?.title || operation.routineId || '';
            return (
              <li key={operation.opId} className="flex flex-wrap items-center justify-between gap-2">
                <span>{copy.failedOperation(operation.type, name)}</span>
                <span className="flex gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => retryOne(operation.opId)}>{copy.retryOne}</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => discardOne(operation.opId)}>{copy.discard}</Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
