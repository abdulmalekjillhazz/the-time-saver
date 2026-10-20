import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/aiProvider.js', () => ({
  askAI: vi.fn(),
  failed: () => new Error('Invalid AI routine response.'),
}));

import { askAI } from '../../src/services/aiProvider.js';
import { generateRoutineDraft } from '../../src/services/routineAssistant.js';

const routine = (title, startTime, endTime, extra = {}) => ({
  title,
  startTime,
  endTime,
  priority: 'high',
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateRoutineDraft', () => {
  it('returns cleaned, ordered, non-overlapping routines with one frog task', async () => {
    askAI.mockResolvedValue({
      text: JSON.stringify([
        routine('  Study  ', '09:00', '10:00'),
        routine('Exercise', '07:00', '07:30', { category: '  ' }),
      ]),
    });

    await expect(generateRoutineDraft({ intent: 'Study better', lang: 'en', config: {} })).resolves.toEqual([
      {
        title: 'Exercise',
        startTime: '07:00',
        endTime: '07:30',
        priority: 'high',
        isFrog: true,
        category: 'general',
      },
      {
        title: 'Study',
        startTime: '09:00',
        endTime: '10:00',
        priority: 'high',
        isFrog: false,
        category: 'general',
      },
    ]);
  });

  it('rejects overlapping AI-generated routines instead of offering an unusable add-all action', async () => {
    askAI.mockResolvedValue({
      text: JSON.stringify([
        routine('Study', '09:00', '10:30'),
        routine('Exercise', '10:00', '10:45'),
      ]),
    });

    await expect(generateRoutineDraft({ intent: 'Study better', lang: 'en', config: {} }))
      .rejects.toThrow('Invalid AI routine response.');
  });

  it('rejects a response that contains no usable routine duration', async () => {
    askAI.mockResolvedValue({
      text: JSON.stringify([
        routine('Empty', '09:00', '09:00'),
        routine('Overnight', '23:00', '01:00'),
        routine('   ', '12:00', '12:30'),
      ]),
    });

    await expect(generateRoutineDraft({ intent: 'Study better', lang: 'en', config: {} }))
      .rejects.toThrow('Invalid AI routine response.');
  });
});
