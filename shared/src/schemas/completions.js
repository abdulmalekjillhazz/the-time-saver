import { z } from 'zod';
import { dateStringSchema, objectIdSchema } from './common.js';

export const completionSchema = z
  .object({
    routineId: objectIdSchema,
    date: dateStringSchema,
    status: z.enum(['done', 'missed', 'skipped']),
    fallbackUsed: z.boolean().optional().default(false),
  })
  .strict();

export const streakFreezeSchema = z.object({ date: dateStringSchema }).strict();

export const heatmapQuerySchema = z.object({
  days: z.coerce.number().int().min(30).max(366).default(365),
}).strict();

export const emptyQuerySchema = z.object({}).strict();
