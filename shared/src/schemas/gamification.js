import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const badgeKeySchema = z.enum([
  'early-bird',
  'century-focus',
  'quiz-master',
  'consistent-learner',
]);

const localizedTextSchema = z.object({ en: z.string(), bn: z.string() }).strict();

export const badgeSchema = z.object({
  key: badgeKeySchema,
  name: localizedTextSchema,
  description: localizedTextSchema,
}).strict();

export const userBadgeSchema = z.object({
  id: objectIdSchema,
  badge: badgeSchema,
  awardedAt: z.string().datetime(),
}).strict();

export const gamificationSummarySchema = z.object({
  badges: z.array(badgeSchema.extend({
    earned: z.boolean(),
    awardedAt: z.string().datetime().nullable(),
  })),
  newlyAwarded: z.array(userBadgeSchema),
  stats: z.object({
    streak: z.object({
      current: z.number().int().nonnegative(),
      longest: z.number().int().nonnegative(),
    }).strict(),
    totalDaysLogged: z.number().int().nonnegative(),
    totalRoutinesCompleted: z.number().int().nonnegative(),
    streakFreezeAvailable: z.boolean(),
    streakFreezeDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  }).strict(),
}).strict();

export const dailyLessonReadSchema = z.object({
  dailyLessonId: objectIdSchema,
}).strict();
