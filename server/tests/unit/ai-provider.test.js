import { afterEach, describe, expect, it, vi } from 'vitest';
import { askAI } from '../../src/services/aiProvider.js';

afterEach(() => vi.unstubAllGlobals());

describe('AI provider selection', () => {
  it('does not fall back to Groq when Gemini is explicitly required', async () => {
    const request = vi.fn(async () => ({ ok: false, status: 503 }));
    vi.stubGlobal('fetch', request);

    await expect(askAI({
      messages: [{ role: 'user', content: 'Generate a story.' }],
      config: { GEMINI_API_KEY: 'gemini-key', GROQ_API_KEY: 'groq-key' },
      allowFallback: false,
    })).rejects.toThrow();

    expect(request).toHaveBeenCalledOnce();
    expect(String(request.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });

  it('fails clearly when Gemini is required but not configured', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(askAI({
      messages: [{ role: 'user', content: 'Generate a story.' }],
      config: { GROQ_API_KEY: 'groq-key' },
      allowFallback: false,
    })).rejects.toMatchObject({ status: 503 });

    expect(request).not.toHaveBeenCalled();
  });
});
