import { expect, it } from 'vitest';
import { clearTemplateClientId, getTemplateClientId, peekTemplateClientId } from '../lib/templateClientId.js';

const UUID_A = 'a12b3456-7890-4123-8123-123456789abc';
const UUID_B = 'b12b3456-7890-4123-8123-123456789abc';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

it('reuses the same client ID for the same user and template', () => {
  const storage = createStorage();
  let generated = 0;
  const makeId = () => (++generated === 1 ? UUID_A : UUID_B);

  const first = getTemplateClientId('user-1', 'wake-early', { storage, makeId });
  const retry = getTemplateClientId('user-1', 'wake-early', { storage, makeId });

  expect(first).toBe(UUID_A);
  expect(retry).toBe(UUID_A);
  expect(generated).toBe(1);
});

it('isolates IDs by user and template', () => {
  const storage = createStorage();
  let generated = 0;
  const makeId = () => [UUID_A, UUID_B, 'c12b3456-7890-4123-8123-123456789abc'][generated++];

  const a = getTemplateClientId('user-1', 'wake-early', { storage, makeId });
  const b = getTemplateClientId('user-1', 'drink-water', { storage, makeId });
  const c = getTemplateClientId('user-2', 'wake-early', { storage, makeId });

  expect(a).not.toBe(b);
  expect(a).not.toBe(c);
  expect(b).not.toBe(c);
});

it('does not fail when storage throws', () => {
  const storage = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('storage unavailable'); },
  };
  const id = getTemplateClientId('user-1', 'wake-early', { storage, makeId: () => UUID_A });
  expect(id).toBe(UUID_A);
});


it('keeps an ID for pending retries, then allows a fresh ID after success', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  let generated = 0;
  const makeId = () => (++generated === 1 ? UUID_A : UUID_B);

  const pendingId = getTemplateClientId('user-1', 'wake-early', { storage, makeId });
  expect(peekTemplateClientId('user-1', 'wake-early', { storage })).toBe(UUID_A);
  expect(getTemplateClientId('user-1', 'wake-early', { storage, makeId })).toBe(pendingId);

  clearTemplateClientId('user-1', 'wake-early', { storage });
  expect(peekTemplateClientId('user-1', 'wake-early', { storage })).toBeNull();
  expect(getTemplateClientId('user-1', 'wake-early', { storage, makeId })).toBe(UUID_B);
});
