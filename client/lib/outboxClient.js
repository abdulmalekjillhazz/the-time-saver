import { createOutbox } from '@smart-routine/shared';
import { createIndexedDbStore } from './idbStore.js';

const instances = new Map();
const stores = new Map();
const listeners = new Map();

async function getCsrfToken() {
  if (typeof globalThis.document !== 'undefined') {
    const cookie = globalThis.document.cookie.split('; ').find((item) => item.startsWith('sr_csrf='));
    if (cookie) return decodeURIComponent(cookie.slice('sr_csrf='.length));
  }
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.csrfToken !== 'string') {
    throw new Error('Could not establish a security token for this request.');
  }
  return body.csrfToken;
}

async function sendBatch(ops) {
  const token = await getCsrfToken();
  const response = await fetch('/api/sync', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ ops }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message?.en || 'Sync request failed.');
    error.status = response.status;
    throw error;
  }
  if (!Array.isArray(body.results)) throw new Error('The sync response did not contain operation results.');
  return body.results;
}

function notify(userId) {
  for (const listener of listeners.get(userId) || []) listener();
  if (typeof globalThis.window !== 'undefined') {
    globalThis.window.dispatchEvent(new globalThis.CustomEvent('smart-routine:sync', { detail: { userId } }));
  }
}

function getClient(userId) {
  if (!instances.has(userId)) {
    const store = createIndexedDbStore(userId);
    stores.set(userId, store);
    const outbox = createOutbox(store);
    instances.set(userId, outbox);
  }
  return instances.get(userId);
}

export async function getOutboxOperations(userId) {
  getClient(userId);
  return stores.get(userId).list();
}

export async function getOutboxSummary(userId) {
  const summary = await getClient(userId).summary();
  return summary;
}

export function subscribeOutbox(userId, listener) {
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId).add(listener);
  return () => {
    const subscribers = listeners.get(userId);
    subscribers?.delete(listener);
    if (subscribers?.size === 0) listeners.delete(userId);
  };
}

export async function flushOutbox(userId) {
  const result = await getClient(userId).flush(sendBatch);
  notify(userId);
  return result;
}

export async function enqueueAndFlush(userId, operation) {
  const outbox = getClient(userId);
  const opId = await outbox.enqueue(operation);
  notify(userId);
  const result = await flushOutbox(userId);
  const queuedOperation = (await stores.get(userId).list()).find((op) => op.opId === opId);
  return {
    ...result,
    operationStatus: queuedOperation?.status ?? 'applied',
  };
}

export async function retryOutboxOperation(userId, opId) {
  const outbox = getClient(userId);
  await outbox.retry(opId);
  notify(userId);
  return flushOutbox(userId);
}

export async function discardOutboxOperation(userId, opId) {
  await getClient(userId).discard(opId);
  notify(userId);
}
