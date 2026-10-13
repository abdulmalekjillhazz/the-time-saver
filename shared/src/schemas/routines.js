import { z } from 'zod';
import { clockSchema, dateStringSchema } from './common.js';

const fallbackFields = {
  fallbackDuration: z.number().int().min(1).max(60).nullable().optional(),
  fallbackPrompt: z.string().trim().min(1).max(200).nullable().optional(),
};

function validateFallbackPair(routine, context) {
  const hasDuration = routine.fallbackDuration !== undefined;
  const hasPrompt = routine.fallbackPrompt !== undefined;
  if (hasDuration !== hasPrompt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'fallbackDuration and fallbackPrompt must be provided together',
      path: [hasDuration ? 'fallbackPrompt' : 'fallbackDuration'],
    });
    return;
  }
  if (hasDuration && (routine.fallbackDuration === null) !== (routine.fallbackPrompt === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'fallbackDuration and fallbackPrompt must both be set or both be cleared',
      path: ['fallbackPrompt'],
    });
  }
}

export const routineFallbackSchema = z.object(fallbackFields).strict().superRefine(validateFallbackPair);

const routineFields = z
  .object({
    title: z.string().trim().min(1).max(120),
    startTime: clockSchema,
    endTime: clockSchema,
    category: z.string().trim().min(1).max(40).default('general'),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    note: z.string().max(300).default(''),
    anchorHabit: z.string().trim().max(120).default(''),
    isFrog: z.boolean().default(false),
    ...fallbackFields,
  })
  .strict();

const routinePartialFields = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    startTime: clockSchema.optional(),
    endTime: clockSchema.optional(),
    category: z.string().trim().min(1).max(40).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    note: z.string().max(300).optional(),
    anchorHabit: z.string().trim().max(120).optional(),
    isFrog: z.boolean().optional(),
    ...fallbackFields,
  })
  .strict();

// clientId is the id the device generated while offline. The server stores it to avoid duplicates on retry.
export const routineCreateSchema = routineFields
  .extend({ clientId: z.string().uuid().optional() })
  .superRefine(validateFallbackPair)
  .refine((r) => r.startTime !== r.endTime, { message: 'start and end must differ', path: ['endTime'] });

// Normal edits: expectedVersion enables optimistic concurrency (409 on mismatch).
export const routineUpdateSchema = routinePartialFields
  .extend({ expectedVersion: z.number().int().min(0).optional() })
  .strict()
  .superRefine(validateFallbackPair)
  .refine((o) => Object.keys(o).some((k) => k !== 'expectedVersion'), 'nothing to update');

// Sync edits: no version check. Sync uses last write wins by server arrival order.
export const routineChangeSchema = routinePartialFields
  .superRefine(validateFallbackPair)
  .refine((o) => Object.keys(o).length > 0, 'nothing to update');

export const routineListQuerySchema = z.object({ date: dateStringSchema.optional() }).strict();
