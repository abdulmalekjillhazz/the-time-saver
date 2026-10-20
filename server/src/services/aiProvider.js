import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';

const GEMINI_URL = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const unavailable = () => new AppError(503, 'UNAVAILABLE', {
  en: 'AI features are not configured on the server.',
  bn: 'সার্ভারে AI ফিচার কনফিগার করা নেই।',
});

export const failed = () => new AppError(502, 'UPSTREAM_UNAVAILABLE', {
  en: 'The AI service could not complete this request. Please try again later.',
  bn: 'AI সার্ভিস এখন অনুরোধটি সম্পন্ন করতে পারেনি। পরে আবার চেষ্টা করুন।',
});

// messages: [{ role: 'system' | 'user', content: string }]

async function callGemini({ messages, config, maxTokens = 700, temperature = 0.4 }) {
  if (!config.GEMINI_API_KEY) return null;
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');

  const res = await fetch(GEMINI_URL(config.GEMINI_MODEL, config.GEMINI_API_KEY), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const payload = await res.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n').trim();
  return text || null;
}

async function callGroq({ messages, config, maxTokens = 700, temperature = 0.4 }) {
  if (!config.GROQ_API_KEY) return null;
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.GROQ_API_KEY}` },
    body: JSON.stringify({ model: config.GROQ_MODEL, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const payload = await res.json();
  const text = payload.choices?.[0]?.message?.content?.trim();
  return text || null;
}

// Tries Gemini first, then Groq. Throws only if neither is configured or both fail.
export async function askAI({ messages, config, maxTokens = 700, temperature = 0.4, allowFallback = true }) {
  if (!config.GEMINI_API_KEY && !config.GROQ_API_KEY) throw unavailable();

  if (!allowFallback) {
    if (!config.GEMINI_API_KEY) throw unavailable();
    try {
      const text = await callGemini({ messages, config, maxTokens, temperature });
      if (text) return { text, provider: 'gemini' };
    } catch (err) {
      logger.error({ err }, 'gemini call failed');
    }
    throw failed();
  }

  try {
    const text = await callGemini({ messages, config, maxTokens, temperature });
    if (text) return { text, provider: 'gemini' };
  } catch (err) {
    logger.error({ err }, 'gemini call failed, trying groq fallback');
  }

  try {
    const text = await callGroq({ messages, config, maxTokens, temperature });
    if (text) return { text, provider: 'groq' };
  } catch (err) {
    logger.error({ err }, 'groq call failed');
  }

  throw failed();
}
