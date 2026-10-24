import { createOutbox } from '@smart-routine/shared';
import { createIndexedDbStore } from './idbStore.js';
import { getStoredSessionToken, resolveApiUrl } from './apiClient.js';

const instances = new Map();
const stores = new Map();
const listeners = new Map();
let cachedCsrfToken = '';

async function getCsrfToken(forceRefresh = false) {
  if (!forceRefresh && typeof globalThis.document !== 'undefined') {
    const cookie = globalThis.document.cookie.split('; ').find((item) => item.startsWith('sr_csrf='));
    if (cookie) return decodeURIComponent(cookie.slice('sr_csrf='.length));
  }
  if (!forceRefresh && cachedCsrfToken) return cachedCsrfToken;

  const sessionToken = getStoredSessionToken();
  const csrfUrl = resolveApiUrl('/api/auth/csrf');
  const credentialsMode = csrfUrl.startsWith('http') ? 'include' : 'same-origin';
  const response = await fetch(csrfUrl, {
    credentials: credentialsMode,
    cache: 'no-store',
    ...(sessionToken ? { headers: { Authorization: `Bearer ${sessionToken}` } } : {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Security token request failed (HTTP ${response.status}).`);
  if (typeof body.csrfToken !== 'string') throw new Error('The security token response was invalid.');
  cachedCsrfToken = body.csrfToken;
  return body.csrfToken;
}

async function sendBatch(ops) {
  let token = await getCsrfToken();
  const sessionToken = getStoredSessionToken();
  const syncUrl = resolveApiUrl('/api/sync');
  const credentialsMode = syncUrl.startsWith('http') ? 'include' : 'same-origin';

  const doPost = (csrf) => {
    const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    return fetch(syncUrl, {
      method: 'POST',
      credentials: credentialsMode,
      headers,
      body: JSON.stringify({ ops }),
    });
  };

  let response = await doPost(token);
  if (response.status === 403) {
    token = await getCsrfToken(true);
    response = await doPost(token);
  }
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
