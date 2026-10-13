import { describe, it, expect } from 'vitest';
import {
  roleChangeSchema,
  attachMediaSchema,
  routineAssistantSchema,
  mfaCodeSchema,
  auditQuerySchema,
} from '../src/index.js';
import * as shared from '../src/index.js';

describe('admin schemas', () => {
  it('accepts only the four known roles', () => {
    expect(roleChangeSchema.safeParse({ role: 'editor' }).success).toBe(true);
    expect(roleChangeSchema.safeParse({ role: 'superadmin' }).success).toBe(false);
  });
  it('MFA codes are exactly six digits', () => {
    expect(mfaCodeSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(mfaCodeSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(mfaCodeSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
  });
  it('a client cannot attach an arbitrary Cloudinary path', () => {
    expect(attachMediaSchema.safeParse({ publicId: 'someone-else/secret', resourceType: 'image' }).success).toBe(false);
    expect(attachMediaSchema.safeParse({ publicId: 'smart-routine/lessons/aB3dE5fG7hJ9', resourceType: 'image' }).success).toBe(true);
  });
  it('only allows lesson uploads and validates assistant requests', () => {
    expect(shared).not.toHaveProperty('attachRoutineMediaSchema');
    expect(routineAssistantSchema.safeParse({ message: 'Help me plan', includeRoutineContext: true, locale: 'en' }).success).toBe(true);
    expect(routineAssistantSchema.safeParse({ message: 'Help me plan', includeRoutineContext: false, locale: 'en' }).success).toBe(false);
    expect(routineAssistantSchema.safeParse({ message: 'Help me plan', includeRoutineContext: true, locale: 'fr' }).success).toBe(false);
    expect(routineAssistantSchema.safeParse({ message: 'x'.repeat(2001), includeRoutineContext: true, locale: 'bn' }).success).toBe(false);
  });
  it('audit query limit is capped at 100', () => {
    expect(auditQuerySchema.parse({}).limit).toBe(50);
    expect(auditQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
