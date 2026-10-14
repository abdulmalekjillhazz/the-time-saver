import { lessonDraftSchema } from '@smart-routine/shared';
import { Lesson } from '../models/Lesson.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';

const unavailable = () => new AppError(503, 'UNAVAILABLE', {
  en: 'AI lesson drafting is not configured on the server.',
  bn: 'সার্ভারে AI দিয়ে পাঠ তৈরির ব্যবস্থা কনফিগার করা নেই।',
});

const failed = () => new AppError(502, 'UPSTREAM_UNAVAILABLE', {
  en: 'Gemini could not create lesson drafts. Please try again later.',
  bn: 'Gemini পাঠের খসড়া তৈরি করতে পারেনি। পরে আবার চেষ্টা করুন।',
});
const STORY_SPEAKER_TAG = /^\[(?:Rahim - Father|Asha - Mother|Rafi - Child|Storyteller)\]:/;

export function hasCompleteStoryScript(body) {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const storytellerLines = lines.flatMap((line, index) => line.startsWith('[Storyteller]:') ? [index] : []);
  return lines.length > 0
    && lines.every((line) => STORY_SPEAKER_TAG.test(line))
    && ['Rahim - Father', 'Asha - Mother', 'Rafi - Child', 'Storyteller']
      .every((speaker) => body.includes(`[${speaker}]:`))
    && storytellerLines.length >= 3
    && storytellerLines[0] === 0
    && storytellerLines.at(-1) === lines.length - 1;
}

function responseText(payload) {
  return payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseDrafts(text, count) {
  const json = text?.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    throw failed();
  }
  if (!Array.isArray(payload) || payload.length !== count) throw failed();
  const drafts = payload.map((item) => lessonDraftSchema.parse({ ...item, aiDrafted: true }));
  if (
    drafts.some((draft) => draft.quiz.length !== 3)
    || drafts.some((draft) => !hasCompleteStoryScript(draft.body.bn) || !hasCompleteStoryScript(draft.body.en))
    || new Set(drafts.map((draft) => draft.slug)).size !== drafts.length
  ) throw failed();
  return drafts;
}

export async function generateLessonDraftsWithGemini(config, author, count = 12, context = '') {
  if (!config.GEMINI_API_KEY) throw unavailable();
  const existingSlugs = await Lesson.distinct('slug');
  const modelName = (config.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');
  const endpoint = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`);
  endpoint.searchParams.set('key', config.GEMINI_API_KEY);

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'Create practical, original, safe learning lessons about routines, focus, habit formation, time management, rest, and wellbeing. Return only a JSON array, with every lesson fully bilingual in Bengali and simple English. Each lesson must have a unique lowercase-hyphen slug, an informative title, and a longer, reasonable, clearly humanized 280-350 word story (12-16 dialogue lines) as realistic dialogue between exactly three fictional family characters plus a storyteller voice (not a fourth family character). The body in both languages must use these unchanged speaker tags, one turn per line: [Storyteller]:, [Rahim - Father]:, [Asha - Mother]:, [Rafi - Child]:. Start with a short storyteller introduction, alternate the family dialogue with real human back-and-forth full of feelings and gentle humour, include one brief storyteller transition around the middle, and end with a storyteller closing after the family chooses one practical action. Make reactions believable for everyday family life; never claim the fictional characters are real people. Start every story with an irresistible emotional or curiosity hook in line 1 that keeps readers glued until the end. Follow the 80/20 language formula strictly: 80% of the story must be short, simple, everyday conversational sentences (5-10 words) so basic beginners can learn spoken English easily, and 20% must be natural advanced English expressions/vocabulary so intermediate learners level up. Always include 5-8 vocabulary entries covering the 20% advanced words with clear Bengali and English definitions. Generate exactly three HARD bilingual quiz questions based only on that story — each must need inference or application to a new situation, never direct recall alone; each question has four bilingual options and a correct answerIndex from 0 to 3, with distractors that are wrong but highly believable and rooted in common misconceptions. Never include medical advice, invented research claims, or user data. Output objects with exactly: slug, title {bn,en}, body {bn,en}, vocabulary [{word, meaning {bn,en}} x5-8], quiz [{question {bn,en}, options [{bn,en} x4], answerIndex} x3].',
          }],
        },
        contents: [{
          role: 'user',
          parts: [{
            text: `Create exactly ${count} distinct lessons. Avoid these already-used slugs: ${existingSlugs.join(', ') || '(none)'}. Make the lessons useful to Bengali-speaking learners and vary the subjects. ${context.trim() ? `Follow this owner-provided context where it is compatible with safety and the required format: ${context.trim()}` : 'No extra context was provided. Create a fresh, original, short everyday family story and choose a useful learning topic yourself.'} JSON array only.`,
          }],
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: Math.min(32768, count * 8192) },
      }),
    });
  } catch (err) {
    logger.warn({ errName: err.name }, 'Gemini lesson generation request failed');
    throw failed();
  }

  if (!response.ok) {
    logger.warn({ status: response.status }, 'Gemini lesson generation returned an error');
    throw failed();
  }

  let payload;
  try {
    payload = await response.json();
  } catch (err) {
    logger.warn({ errName: err.name }, 'Gemini lesson generation returned invalid JSON');
    throw failed();
  }

  let drafts;
  try {
    drafts = parseDrafts(responseText(payload), count);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn({ errName: err.name }, 'Gemini lesson drafts failed validation');
    throw failed();
  }

  const duplicate = drafts.find((draft) => existingSlugs.includes(draft.slug));
  if (duplicate) throw failed();
  try {
    return await Lesson.insertMany(
      drafts.map((draft) => ({ ...draft, createdBy: author._id })),
      { ordered: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError(409, 'CONFLICT', {
        en: 'A lesson with a generated slug already exists. Please generate again.',
        bn: 'তৈরি হওয়া একটি slug দিয়ে পাঠ আগে থেকেই আছে। আবার তৈরি করুন।',
      });
    }
    throw err;
  }
}
