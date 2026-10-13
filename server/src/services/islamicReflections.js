import { z } from 'zod';
import { todayInZone } from '@smart-routine/shared';
import { IslamicReflection } from '../models/IslamicReflection.js';
import { askAI } from './aiProvider.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';

const reflectionSchema = z.object({
  title: z.string().trim().min(1).max(100),
  reflection: z.string().trim().min(1).max(900),
  practicalAction: z.string().trim().min(1).max(220),
  sourceType: z.enum(['quran', 'hadith', 'general']),
  sourceCitation: z.string().trim().max(180),
}).strict().superRefine((reflection, context) => {
  if (reflection.sourceType !== 'general' && !reflection.sourceCitation) {
    context.addIssue({
      code: 'custom',
      path: ['sourceCitation'],
      message: 'A cited source must include its exact reference.',
    });
  }
  if (reflection.sourceType === 'general' && reflection.sourceCitation) {
    context.addIssue({
      code: 'custom',
      path: ['sourceCitation'],
      message: 'A general reflection must not include an unverified citation.',
    });
  }
});

const SYSTEM_PROMPT = `Write one short, gentle Islamic daily reflection in the requested language (Bengali or English) for a habit and prayer-time app.
Connect Islam's message of peace, mercy, unity, and compassion—including Allah's name Ar-Rahman when relevant—with one realistic, repeatable daily habit. Explain how sincere consistency can invite barakah, but do not guarantee a specific reward or outcome for a particular person.
Be warm, respectful, practical, and non-judgmental. Do not issue a fatwa, shame the reader, or invent religious claims.
Return exactly one JSON object with: title, reflection (2-4 concise sentences), practicalAction (one small action for today), sourceType ("quran", "hadith", or "general"), and sourceCitation.
Only use sourceType "quran" or "hadith" if you are certain of the exact source and reference; cite the Surah and verse, or the hadith collection and number only when certain. Never invent or approximate a citation. If uncertain, use sourceType "general" and an empty sourceCitation. Do not quote scripture unless certain the wording is accurate. Return no markdown or extra fields.`;

function parseReflection(text) {
  const cleaned = text?.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return reflectionSchema.parse(JSON.parse(cleaned));
  } catch (error) {
    logger.warn({ errName: error.name }, 'Gemini daily Islamic reflection failed schema validation');
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', {
      en: 'Gemini returned an invalid daily reflection. No reflection was published.',
      bn: 'Gemini অবৈধ দৈনিক অনুপ্রেরণা পাঠিয়েছে। কোনো লেখা প্রকাশ করা হয়নি।',
    });
  }
}

export async function getDailyIslamicReflection({ date, locale = 'bn' } = {}) {
  const targetDate = date || todayInZone('Asia/Dhaka');
  const targetLocale = locale === 'en' ? 'en' : 'bn';
  return IslamicReflection.findOne({ date: targetDate, locale: targetLocale }).lean();
}

export async function generateDailyIslamicReflection({ date, locale = 'bn', config } = {}) {
  const targetDate = date || todayInZone('Asia/Dhaka');
  const targetLocale = locale === 'en' ? 'en' : 'bn';
  const existing = await IslamicReflection.findOne({ date: targetDate, locale: targetLocale }).lean();
  if (existing) return { reflection: existing, reused: true };

  if (!config?.GEMINI_API_KEY) {
    throw new AppError(503, 'UNAVAILABLE', {
      en: 'Gemini is not configured for daily Islamic reflections.',
      bn: 'দৈনিক ইসলামি অনুপ্রেরণার জন্য Gemini কনফিগার করা নেই।',
    });
  }

  const { text } = await askAI({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Date: ${targetDate}\nLanguage: ${targetLocale === 'bn' ? 'Bengali' : 'English'}\nWrite today's original reflection.`,
      },
    ],
    config,
    maxTokens: 600,
    temperature: 0.35,
    allowFallback: false,
  });
  const content = parseReflection(text);
  const reflection = await IslamicReflection.findOneAndUpdate(
    { date: targetDate, locale: targetLocale },
    { $setOnInsert: { ...content, date: targetDate, locale: targetLocale, generatedAt: new Date() } },
    { upsert: true, new: true, runValidators: true }
  ).lean();
  return { reflection, reused: false };
}
