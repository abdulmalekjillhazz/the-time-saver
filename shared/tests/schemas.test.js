import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  profileUpdateSchema,
  routineCreateSchema,
  routineFallbackSchema,
  routineUpdateSchema,
  completionSchema,
  badgeSchema,
  userBadgeSchema,
} from '../src/index.js';

describe('registerSchema', () => {
  it('rejects unknown keys', () => {
    const r = registerSchema.safeParse({
      email: 'a@example.com', password: 'long-enough-pass', displayName: 'A', role: 'admin',
    });
    expect(r.success).toBe(false);
  });
  it('accepts a 4–6 digit PIN', () => {
    for (const password of ['1234', '123456']) {
      expect(registerSchema.safeParse({ email: 'a@example.com', password, displayName: 'A' }).success).toBe(true);
    }
  });
  it('rejects PINs outside 4–6 digits and short non-numeric passwords', () => {
    for (const password of ['123', '1234567', 'abcde', 'short']) {
      expect(registerSchema.safeParse({ email: 'a@example.com', password, displayName: 'A' }).success).toBe(false);
    }
  });
  it('continues to accept existing strong passphrases', () => {
    expect(registerSchema.safeParse({
      email: 'a@example.com', password: 'long-enough-pass', displayName: 'A',
    }).success).toBe(true);
  });
  it('lowercases email and applies defaults', () => {
    const r = registerSchema.parse({ email: 'A@Example.COM', password: 'long-enough-pass', displayName: 'A' });
    expect(r.email).toBe('a@example.com');
    expect(r.timezone).toBe('Asia/Dhaka');
    expect(r.locale).toBe('bn');
  });
});

describe('profileUpdateSchema', () => {
  it('accepts a built-in avatar selection and a display name', () => {
    expect(profileUpdateSchema.safeParse({ displayName: 'Amina', avatarId: 'hijab' }).success).toBe(true);
  });

  it('rejects unknown avatars, extra fields, and empty updates', () => {
    expect(profileUpdateSchema.safeParse({ avatarId: 'remote-image-url' }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ displayName: 'Amina', role: 'admin' }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe('routine schemas', () => {
  const base = { title: 'Read', startTime: '07:00', endTime: '07:30' };

  it('rejects a userId sent by the client (ownership comes from the session only)', () => {
    const r = routineCreateSchema.safeParse({ ...base, userId: '65f0c0ffee0000000000abcd' });
    expect(r.success).toBe(false);
  });
  it('rejects start equal to end', () => {
    expect(routineCreateSchema.safeParse({ ...base, endTime: '07:00' }).success).toBe(false);
  });
  it('accepts a midnight-crossing routine', () => {
    expect(routineCreateSchema.safeParse({ title: 'Sleep', startTime: '22:00', endTime: '02:00' }).success).toBe(true);
  });
  it('rejects an empty update', () => {
    expect(routineUpdateSchema.safeParse({}).success).toBe(false);
    expect(routineUpdateSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
  });
  it('accepts complete fallback settings and requires their fields as a pair', () => {
    expect(routineCreateSchema.safeParse({
      ...base,
      fallbackDuration: 5,
      fallbackPrompt: 'Do five push-ups',
    }).success).toBe(true);
    expect(routineFallbackSchema.safeParse({ fallbackDuration: 5 }).success).toBe(false);
    expect(routineUpdateSchema.safeParse({ fallbackDuration: 5 }).success).toBe(false);
    expect(routineUpdateSchema.safeParse({ fallbackDuration: null, fallbackPrompt: null }).success).toBe(true);
  });
  it('rejects fallback values outside the allowed duration and prompt lengths', () => {
    expect(routineFallbackSchema.safeParse({ fallbackDuration: 0, fallbackPrompt: 'Short version' }).success).toBe(false);
    expect(routineFallbackSchema.safeParse({ fallbackDuration: 5, fallbackPrompt: '   ' }).success).toBe(false);
  });
});

describe('completionSchema', () => {
  it('rejects an impossible date like 2026-13-45', () => {
    const r = completionSchema.safeParse({
      routineId: '65f0c0ffee0000000000abcd', date: '2026-13-45', status: 'done',
    });
    expect(r.success).toBe(false);
  });
  it('rejects unknown status values', () => {
    const r = completionSchema.safeParse({
      routineId: '65f0c0ffee0000000000abcd', date: '2026-10-10', status: 'maybe',
    });
    expect(r.success).toBe(false);
  });
  it('defaults fallback completion to false and only accepts booleans', () => {
    const input = { routineId: '65f0c0ffee0000000000abcd', date: '2026-10-10', status: 'done' };
    expect(completionSchema.parse(input).fallbackUsed).toBe(false);
    expect(completionSchema.safeParse({ ...input, fallbackUsed: 'yes' }).success).toBe(false);
  });
});

describe('gamification schemas', () => {
  it('validates localized badge definitions and earned badge records', () => {
    const badge = {
      key: 'early-bird',
      name: { en: 'Early Bird', bn: 'প্রভাতী' },
      description: { en: 'Five early routines.', bn: 'পাঁচটি সকালের রুটিন।' },
    };
    expect(badgeSchema.safeParse(badge).success).toBe(true);
    expect(badgeSchema.safeParse({ ...badge, key: 'unknown' }).success).toBe(false);
    expect(userBadgeSchema.safeParse({
      id: '65f0c0ffee0000000000abcd',
      badge,
      awardedAt: '2026-10-10T00:00:00.000Z',
    }).success).toBe(true);
  });
});
