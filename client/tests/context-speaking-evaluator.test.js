import { describe, expect, it, vi } from 'vitest';
import {
  evaluateContextSpeech,
  evaluateContextSpeechWithServerAI,
  extractContextKeywords,
} from '../lib/contextSpeakingEvaluator.js';

describe('contextSpeakingEvaluator', () => {
  const sampleSituation = {
    id: 'cafe',
    title: { en: 'At a café', bn: 'ক্যাফেতে অর্ডার' },
    description: { en: 'Order a drink and food politely.', bn: 'ভদ্রভাবে খাবার অর্ডার করুন।' },
    dialogue: 'Could I have a cup of tea please? How much is everything?',
  };

  it('extracts context keywords for predefined situations', () => {
    const keywords = extractContextKeywords(sampleSituation);
    expect(keywords).toContain('coffee');
    expect(keywords).toContain('tea');
    expect(keywords).toContain('order');
    expect(keywords).toContain('menu');
  });

  it('returns 0 score when user spoke nothing or duration is too short', () => {
    const res = evaluateContextSpeech({
      transcript: '',
      situation: sampleSituation,
      durationSeconds: 2,
    });
    expect(res.score).toBe(0);
    expect(res.wordCount).toBe(0);
    expect(res.feedback.en).toContain('Please speak');
  });

  it('evaluates rich, sustained cafe speech and awards earned score', () => {
    const transcript =
      'Good morning. Could I please order a hot cup of tea and a fresh vegetable sandwich from your breakfast menu? I would like a little milk and no sugar, please. Also, could I sit near the window table while I wait? How much is the bill altogether? Thank you very much for your kind recommendation and quick service.';
    const res = evaluateContextSpeech({
      transcript,
      situation: sampleSituation,
      durationSeconds: 45,
    });

    expect(res.score).toBeGreaterThanOrEqual(65);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.matchedKeywords.length).toBeGreaterThanOrEqual(5);
    expect(res.relevanceScore).toBeGreaterThanOrEqual(25);
    expect(res.fluencyScore).toBeGreaterThanOrEqual(20);
    expect(res.vocabularyScore).toBeGreaterThanOrEqual(15);
  });

  it('evaluates non-contextual or short speech with a realistic low score', () => {
    const transcript = 'I am looking at the blue sky today.';
    const res = evaluateContextSpeech({
      transcript,
      situation: sampleSituation,
      durationSeconds: 15,
    });

    expect(res.score).toBeLessThan(35);
    expect(res.feedback.bn).toContain('কথা অনেক কম');
  });

  it('evaluates with server AI when endpoint succeeds', async () => {
    const mockAiResponse = {
      score: 88,
      relevanceScore: 36,
      fluencyScore: 28,
      vocabularyScore: 24,
      feedback: {
        en: 'Excellent ordering! Polite and natural.',
        bn: 'চমৎকার অর্ডার করেছেন! ভদ্র ও সাবলীল।',
      },
      grammarTips: [],
      suggestedPhrases: ['Could I get the check, please?'],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, evaluation: mockAiResponse }),
    });

    try {
      const res = await evaluateContextSpeechWithServerAI({
        transcript: 'I would like to order a warm cup of coffee and a fresh sandwich please.',
        situation: sampleSituation,
        durationSeconds: 30,
        lang: 'bn',
      });

      expect(res.score).toBe(88);
      expect(res.aiEvaluated).toBe(true);
      expect(res.suggestedPhrases).toContain('Could I get the check, please?');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('gracefully falls back to heuristic scoring when server AI is unavailable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      const res = await evaluateContextSpeechWithServerAI({
        transcript: 'I would like to order a warm cup of coffee and sandwich.',
        situation: sampleSituation,
        durationSeconds: 20,
        lang: 'bn',
      });

      expect(typeof res.score).toBe('number');
      expect(res.aiEvaluated).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
