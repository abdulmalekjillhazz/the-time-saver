import { describe, it, expect } from 'vitest';
import { alarmClientIdSchema, alarmCreateSchema, alarmMissedQuerySchema, alarmUpdateSchema } from '../src/index.js';

describe('alarm schemas', () => {
  it('accepts a well-formed alarm', () => {
    expect(alarmCreateSchema.safeParse({
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      at: Date.now() + 60000,
      name: 'ফজর',
      timezone: 'Asia/Dhaka',
    }).success).toBe(true);
  });

  it('rejects bad ids, times, names, and timezones', () => {
    expect(alarmCreateSchema.safeParse({ clientId: '', at: 1, name: '', timezone: 'Asia/Dhaka' }).success).toBe(false);
    expect(alarmCreateSchema.safeParse({ clientId: 'a', at: -1, name: '', timezone: 'Asia/Dhaka' }).success).toBe(false);
    expect(alarmCreateSchema.safeParse({ clientId: 'a', at: 1, name: 'x'.repeat(61), timezone: 'Asia/Dhaka' }).success).toBe(false);
    expect(alarmCreateSchema.safeParse({ clientId: 'a', at: 1, name: '', timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(alarmCreateSchema.safeParse({ clientId: 'a', at: 1, name: '', timezone: 'Asia/Dhaka', extra: 1 }).success).toBe(false);
  });

  it('requires at least one field to update', () => {
    expect(alarmUpdateSchema.safeParse({}).success).toBe(false);
    expect(alarmUpdateSchema.safeParse({ name: 'New name' }).success).toBe(true);
    expect(alarmUpdateSchema.safeParse({ acknowledged: true }).success).toBe(true);
  });

  it('parses the missed list query with a safe limit', () => {
    expect(alarmMissedQuerySchema.safeParse({})).toMatchObject({ success: true });
    expect(alarmMissedQuerySchema.safeParse({}).data).toMatchObject({ limit: 10 });
    expect(alarmMissedQuerySchema.safeParse({ missed: '1', limit: '5' }).data).toMatchObject({ missed: '1', limit: 5 });
    expect(alarmMissedQuerySchema.safeParse({ limit: '99' }).success).toBe(false);
  });

  it('accepts client ids used by the app', () => {
    expect(alarmClientIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
    expect(alarmClientIdSchema.safeParse('').success).toBe(false);
  });
});
