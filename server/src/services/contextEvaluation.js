import { askAI } from './aiProvider.js';
import { logger } from '../lib/logger.js';

export async function evaluateContextSpeechWithAI({
  transcript = '',
  situation = {},
  durationSeconds = 0,
  lang = 'bn',
  config = {},
}) {
  if (!transcript || transcript.trim().length < 5) return null;

  const isBn = lang === 'bn';
  const title = typeof situation.title === 'object'
    ? (situation.title?.[isBn ? 'bn' : 'en'] || situation.title?.en || '')
    : String(situation.title || 'Daily Conversation');
  const description = typeof situation.description === 'object'
    ? (situation.description?.[isBn ? 'bn' : 'en'] || situation.description?.en || '')
    : String(situation.description || '');

  const system = `You are an expert, encouraging English communication coach and speech evaluator for language learners.
Evaluate the user's spoken English response for this situation:
Situation: "${title}" - "${description}"
Duration: ${durationSeconds} seconds.

Evaluate strictly but constructively on:
1. Relevance to situation (0-40)
2. Fluency, pacing, conversational completeness (0-35)
3. Vocabulary, grammar, and natural polite expressions (0-25)

Return ONLY valid JSON without markdown code fences or backticks:
{
  "score": 75,
  "relevanceScore": 32,
  "fluencyScore": 25,
  "vocabularyScore": 18,
  "feedback": {
    "en": "Good attempt! You communicated your message clearly. Try adding more detail to improve.",
    "bn": "ভালো চেষ্টা! আপনি আপনার বক্তব্য স্পষ্টভাবে প্রকাশ করেছেন। আরও বিস্তারিত বললে স্কোর আরও বাড়বে।"
  },
  "grammarTips": [
    { "original": "snippet from user", "suggestion": "natural native phrasing", "explanation": "brief helpful reason" }
  ],
  "suggestedPhrases": ["natural expression 1", "natural expression 2"],
  "strengths": ["Clear situational context", "Polite tone"],
  "areasToImprove": ["Expand sentences with connectors"]
}`;

  const user = `User Spoken Transcript:\n"${transcript}"`;

  try {
    const { text, provider } = await askAI({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      config,
      maxTokens: 850,
      temperature: 0.3,
    });

    const clean = String(text || '')
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(clean);
    return {
      ...parsed,
      aiGenerated: true,
      provider,
    };
  } catch (err) {
    logger.warn({ errName: err?.name }, 'AI context evaluation failed');
    return null;
  }
}

