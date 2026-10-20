import test from 'node:test';
import assert from 'node:assert/strict';
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

test('reuses the same client ID for the same user and template', () => {
  const storage = createStorage();
  let generated = 0;
  const makeId = () => (++generated === 1 ? UUID_A : UUID_B);

  const first = getTemplateClientId('user-1', 'wake-early', { storage, makeId });
  const retry = getTemplateClientId('user-1', 'wake-early', { storage, makeId });

  assert.equal(first, UUID_A);
  assert.equal(retry, UUID_A);
  assert.equal(generated, 1);
});

test('isolates IDs by user and template', () => {
  const storage = createStorage();
  let generated = 0;
  const makeId = () => [UUID_A, UUID_B, 'c12b3456-7890-4123-8123-123456789abc'][generated++];

  const a = getTemplateClientId('user-1', 'wake-early', { storage, makeId });
  const b = getTemplateClientId('user-1', 'drink-water', { storage, makeId });
  const c = getTemplateClientId('user-2', 'wake-early', { storage, makeId });

  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(b, c);
});

test('does not fail when storage throws', () => {
  const storage = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('storage unavailable'); },
  };
  const id = getTemplateClientId('user-1', 'wake-early', { storage, makeId: () => UUID_A });
  assert.equal(id, UUID_A);
});


test('keeps an ID for pending retries, then allows a fresh ID after success', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  let generated = 0;
  const makeId = () => (++generated === 1 ? UUID_A : UUID_B);

  const pendingId = getTemplateClientId('user-1', 'wake-early', { storage, makeId });
  assert.equal(peekTemplateClientId('user-1', 'wake-early', { storage }), UUID_A);
  assert.equal(getTemplateClientId('user-1', 'wake-early', { storage, makeId }), pendingId);

  clearTemplateClientId('user-1', 'wake-early', { storage });
  assert.equal(peekTemplateClientId('user-1', 'wake-early', { storage }), null);
  assert.equal(getTemplateClientId('user-1', 'wake-early', { storage, makeId }), UUID_B);
});
