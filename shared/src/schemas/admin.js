import { z } from 'zod';
import { localeSchema } from './common.js';

export const roleValues = ['user', 'viewer', 'editor', 'owner'];

export const roleChangeSchema = z.object({ role: z.enum(roleValues) }).strict();

export const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'six digits') }).strict();

export const uploadSignatureSchema = z.object({ resourceType: z.enum(['image', 'video', 'audio']) }).strict();

// Only public ids the server could have issued. A client cannot point at arbitrary Cloudinary files.
export const attachMediaSchema = z
  .object({
    publicId: z.string().regex(/^smart-routine\/lessons\/[A-Za-z0-9]{12,40}$/, 'invalid upload id'),
    resourceType: z.enum(['image', 'video', 'audio']),
  })
  .strict();

export const routineAssistantSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    includeRoutineContext: z.literal(true),
    locale: localeSchema,
  })
  .strict();

export const auditQuerySchema = z
  .object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
