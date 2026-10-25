import { z } from 'zod';
import { emailSchema, passwordSchema, localeSchema, timeZoneSchema } from './common.js';

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z.string().trim().min(1).max(60),
    locale: localeSchema.default('bn'),
    timezone: timeZoneSchema.default('Asia/Dhaka'),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const googleLoginSchema = z
  .object({
    credential: z.string().min(100).max(10_000),
    locale: localeSchema.default('bn'),
    timezone: timeZoneSchema.default('Asia/Dhaka'),
  })
  .strict();

export const googleHandoffExchangeSchema = z
  .object({
    code: z.string().min(32).max(128),
  })
  .strict();

export const profileAvatarIds = [
  'sunrise',
  'wave',
  'curls',
  'hijab',
  'glasses',
  'cap',
];

// Used for export and delete: the user must type their password again.
export const passwordOnlySchema = z.object({ password: z.string().min(1).max(128) }).strict();

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    avatarId: z.enum(profileAvatarIds).optional(),
    locale: localeSchema.optional(),
    timezone: timeZoneSchema.optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'nothing to update');

export const consentSchema = z
  .object({
    granted: z.boolean(),
    version: z.string().trim().min(1).max(20),
  })
  .strict();
