import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuidV4 } from '../src/uuid.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UUID generation across browser runtimes', () => {
  it('uses the platform UUID generator when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'a12b3456-7890-4123-8123-123456789abc' });

    expect(createUuidV4()).toBe('a12b3456-7890-4123-8123-123456789abc');
  });

  it('generates an RFC 4122 v4 UUID when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes) => {
        bytes.fill(0);
        return bytes;
      },
    });

    expect(createUuidV4()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('still generates a valid UUID when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);

    expect(createUuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
