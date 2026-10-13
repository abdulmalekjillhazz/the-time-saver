import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslamicReflection } from '../../src/models/IslamicReflection.js';
import { askAI } from '../../src/services/aiProvider.js';
import {
  generateDailyIslamicReflection,
  getDailyIslamicReflection,
} from '../../src/services/islamicReflections.js';

vi.mock('../../src/services/aiProvider.js', () => ({ askAI: vi.fn() }));

const validReflection = {
  title: 'A little mercy, every day',
  reflection: 'A kind word can bring calm to a busy home. Small, sincere acts of care help make daily routines more compassionate.',
  practicalAction: 'Make one task easier for someone today.',
  sourceType: 'general',
  sourceCitation: '',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(askAI).mockReset();
});

describe('daily Islamic reflections', () => {
  it('generates and caches separate localized reflections using Gemini only', async () => {
    const saved = { ...validReflection, date: '2026-10-12', locale: 'en' };
    const lookup = vi.spyOn(IslamicReflection, 'findOne').mockReturnValue({ lean: async () => null });
    const save = vi.spyOn(IslamicReflection, 'findOneAndUpdate').mockReturnValue({ lean: async () => saved });
    vi.mocked(askAI).mockResolvedValue({ text: JSON.stringify(validReflection), provider: 'gemini' });

    const result = await generateDailyIslamicReflection({
      date: '2026-10-12',
      locale: 'en',
      config: { GEMINI_API_KEY: 'configured' },
    });

    expect(result).toEqual({ reflection: saved, reused: false });
    expect(lookup).toHaveBeenCalledWith({ date: '2026-10-12', locale: 'en' });
    expect(save).toHaveBeenCalledWith(
      { date: '2026-10-12', locale: 'en' },
      { $setOnInsert: expect.objectContaining({ ...validReflection, date: '2026-10-12', locale: 'en' }) },
      { upsert: true, new: true, runValidators: true },
    );
    expect(askAI).toHaveBeenCalledWith(expect.objectContaining({
      config: { GEMINI_API_KEY: 'configured' },
      allowFallback: false,
    }));
  });

  it('reuses the cached daily reflection without calling AI', async () => {
    const cached = { ...validReflection, date: '2026-10-12', locale: 'bn' };
    vi.spyOn(IslamicReflection, 'findOne').mockReturnValue({ lean: async () => cached });

    await expect(generateDailyIslamicReflection({ date: '2026-10-12', locale: 'bn' }))
      .resolves.toEqual({ reflection: cached, reused: true });
    expect(askAI).not.toHaveBeenCalled();
  });

  it('does not invent a citation when Gemini cannot confidently identify a source', async () => {
    const lookup = vi.spyOn(IslamicReflection, 'findOne').mockReturnValue({ lean: async () => null });
    vi.mocked(askAI).mockResolvedValue({
      text: JSON.stringify({ ...validReflection, sourceType: 'quran', sourceCitation: '' }),
      provider: 'gemini',
    });
    const save = vi.spyOn(IslamicReflection, 'findOneAndUpdate');

    await expect(generateDailyIslamicReflection({
      date: '2026-10-12',
      locale: 'bn',
      config: { GEMINI_API_KEY: 'configured' },
    })).rejects.toMatchObject({ status: 502 });
    expect(lookup).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not fall back to another provider when Gemini is not configured', async () => {
    vi.spyOn(IslamicReflection, 'findOne').mockReturnValue({ lean: async () => null });

    await expect(generateDailyIslamicReflection({ date: '2026-10-12', config: { GROQ_API_KEY: 'configured' } }))
      .rejects.toMatchObject({ status: 503 });
    expect(askAI).not.toHaveBeenCalled();
  });

  it('loads only the requested locale for the Bangladesh-local current date', async () => {
    const find = vi.spyOn(IslamicReflection, 'findOne').mockReturnValue({ lean: async () => null });
    await getDailyIslamicReflection({ locale: 'en' });
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en', date: expect.any(String) }));
  });
});
