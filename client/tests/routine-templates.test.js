import { describe, expect, it } from 'vitest';
import { routineCreateSchema } from '@smart-routine/shared';
import { ROUTINE_TEMPLATES, templateTitle } from '../lib/routineTemplates.js';

describe('routine templates', () => {
  it('provides unique templates that satisfy the routine creation schema', () => {
    const ids = ROUTINE_TEMPLATES.map((template) => template.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(30);

    for (const template of ROUTINE_TEMPLATES) {
      const result = routineCreateSchema.safeParse({
        title: templateTitle(template, 'en'),
        startTime: template.startTime,
        endTime: template.endTime,
        category: template.category,
        priority: template.priority,
        isFrog: template.isFrog,
        clientId: 'a12b3456-7890-4123-8123-123456789abc',
      });
      expect(result.success, template.id).toBe(true);
    }
  });
});
