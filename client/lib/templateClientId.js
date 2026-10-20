import { createUuidV4 } from '@smart-routine/shared';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Return a stable client ID for a user's template operation.
 *
 * If a request reaches the server but the response is lost, retrying the same
 * template must reuse the same clientId. The server can then return the
 * existing routine instead of creating a duplicate. Storage is best-effort:
 * if browser storage is unavailable, we still return a valid UUID.
 */
export function getTemplateClientId(userId, templateId, options = {}) {
  const makeId = options.makeId || createUuidV4;
  if (!userId || !templateId) return makeId();

  const key = `smart-routine:template-client-id:${String(userId)}:${String(templateId)}`;
  let storage = options.storage;
  try {
    if (!storage) storage = globalThis.localStorage;
  } catch {
    // Accessing localStorage itself can throw in restricted browser contexts.
    return makeId();
  }

  let existing;
  try {
    existing = storage?.getItem(key);
  } catch {
    // Private browsing / storage restrictions must not prevent adding a routine.
    return makeId();
  }
  if (existing && UUID_PATTERN.test(existing)) return existing;

  const id = makeId();
  if (UUID_PATTERN.test(id)) {
    try {
      storage?.setItem(key, id);
    } catch {
      // The current operation can still proceed; persistence is best-effort.
    }
  }
  return id;
}


/** Read an existing template ID without allocating one during reconciliation. */
export function peekTemplateClientId(userId, templateId, options = {}) {
  if (!userId || !templateId) return null;
  const key = `smart-routine:template-client-id:${String(userId)}:${String(templateId)}`;
  let storage = options.storage;
  try {
    if (!storage) storage = globalThis.localStorage;
    const value = storage?.getItem(key);
    return value && UUID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** Clear the id after the outbox confirms the operation, so a future intentional
 * add of the same template receives a fresh id. Pending retries keep their id. */
export function clearTemplateClientId(userId, templateId, options = {}) {
  if (!userId || !templateId) return;
  const key = `smart-routine:template-client-id:${String(userId)}:${String(templateId)}`;
  let storage = options.storage;
  try {
    if (!storage) storage = globalThis.localStorage;
    storage?.removeItem(key);
  } catch {
    // Storage cleanup is best-effort; successful server writes must remain successful.
  }
}
