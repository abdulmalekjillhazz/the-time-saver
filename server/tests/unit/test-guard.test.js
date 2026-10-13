import { afterEach, describe, it, expect, vi } from 'vitest';
import setup, { dbNameFromUri } from '../integration/guard.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('database name guard', () => {
  it('reads the database name from a standard URI', () => {
    expect(dbNameFromUri('mongodb://127.0.0.1:27017/smart-routine-ci')).toBe('smart-routine-ci');
  });

  it('ignores query options', () => {
    expect(dbNameFromUri('mongodb://127.0.0.1:27017/smart-routine-test?authSource=admin')).toBe('smart-routine-test');
  });

  it('reads the name from an SRV URI with several hosts', () => {
    expect(dbNameFromUri('mongodb+srv://user:pw@cluster.example.net/app-test')).toBe('app-test');
  });

  it('returns an empty name when no database is given', () => {
    expect(dbNameFromUri('mongodb://127.0.0.1:27017')).toBe('');
  });

  it('reads the name from a URI with several hosts, which the URL class cannot parse', () => {
    expect(dbNameFromUri('mongodb://a.example:27017,b.example:27017/x-test')).toBe('x-test');
  });

  it('requires an explicit test database URI', () => {
    vi.stubEnv('MONGODB_URI_TEST', '');
    expect(() => setup()).toThrow(/MONGODB_URI_TEST is not set/);
  });

  it('rejects a URI without a database name', () => {
    vi.stubEnv('MONGODB_URI_TEST', 'mongodb://127.0.0.1:27017');
    expect(() => setup()).toThrow(/must name a database/);
  });

  it('refuses database names that do not contain "test"', () => {
    vi.stubEnv('MONGODB_URI_TEST', 'mongodb://127.0.0.1:27017/smart-routine');
    expect(() => setup()).toThrow(/whose name contains "test"/);
  });

  it('accepts an explicitly configured test database', () => {
    vi.stubEnv('MONGODB_URI_TEST', 'mongodb://127.0.0.1:27017/smart-routine-test');
    expect(() => setup()).not.toThrow();
  });
});
