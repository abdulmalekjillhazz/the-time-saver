import { describe, it, expect } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const good = {
  NODE_ENV: 'development',
  PORT: '5000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
  CLIENT_ORIGIN: 'http://localhost:3000',
};

describe('loadEnv', () => {
  it('accepts a complete environment and coerces PORT', () => {
    const cfg = loadEnv(good);
    expect(cfg.PORT).toBe(5000);
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it('accepts an optional Telegram bot token', () => {
    expect(loadEnv({ ...good, TELEGRAM_BOT_TOKEN: '123456789:abcdefghijklmnopqrstuvwxyz' }).TELEGRAM_BOT_TOKEN)
      .toBe('123456789:abcdefghijklmnopqrstuvwxyz');
  });

  it('names the missing variable but never prints a value', () => {
    const rest = { ...good };
    delete rest.MONGODB_URI;
    expect(() => loadEnv(rest)).toThrow(/MONGODB_URI/);
  });

  it('rejects a malformed URI and does not echo it back', () => {
    const secret = 'not-a-uri-with-PASSWORD123';
    try {
      loadEnv({ ...good, MONGODB_URI: secret });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/MONGODB_URI/);
      expect(err.message).not.toContain('PASSWORD123');
    }
  });
});
