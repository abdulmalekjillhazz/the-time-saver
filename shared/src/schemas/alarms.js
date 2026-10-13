import { z } from 'zod';
import { timeZoneSchema } from './common.js';

// One-shot alarms. The browser owns the countdown while it is open; the
// server copy lets push and Telegram reach the user when the app is closed.
// `at` is a millisecond epoch (UTC) so no timezone math is needed to fire.
const alarmName = z.string().trim().max(60);
const alarmAt = z.number().int().positive().max(4102444800000);

export const alarmClientIdSchema = z.string().trim().min(1).max(64);

export const alarmCreateSchema = z
  .object({
    clientId: alarmClientIdSchema,
    at: alarmAt,
    name: alarmName.default(''),
    timezone: timeZoneSchema,
  })
  .strict();

export const alarmUpdateSchema = z
  .object({
    at: alarmAt.optional(),
    name: alarmName.optional(),
    acknowledged: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.at !== undefined || value.name !== undefined || value.acknowledged !== undefined, {
    message: 'nothing to update',
  });

export const alarmMissedQuerySchema = z
  .object({
    missed: z.enum(['1', 'true']).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .strict();
