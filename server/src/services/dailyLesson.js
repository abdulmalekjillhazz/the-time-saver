import crypto from 'node:crypto';
import { dailyLessonPayloadSchema, todayInZone } from '@smart-routine/shared';
import { DailyLesson } from '../models/DailyLesson.js';
import { Quiz } from '../models/Quiz.js';
import { DailyQuizScore } from '../models/DailyQuizScore.js';
import { DailyLessonFeedback } from '../models/DailyLessonFeedback.js';
import { QuizReport } from '../models/QuizReport.js';
import { askAI } from './aiProvider.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { evaluateAndAwardBadges } from './gamification.js';
import { hasCompleteStoryScript } from './geminiLessons.js';
import { createCuratedDailyLesson } from './dailyLessonFallback.js';
import { generateAndUploadLessonAudio, getNarrationVoiceConfigVersion } from './elevenLabs.js';
import { cloudinary } from './cloudinary.js';

const NARRATION_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;

export const MASTER_PROMPT = `# Master Prompt: Smart Routine Daily Lesson & Quiz Generator

## Context
You are the lesson & quiz generator for Smart Routine, a daily planner & habit coach app.
Users are from Bangladesh and other South Asian countries.
Users range from students to working professionals.
Lessons teach habit formation, time management, mental health, and productivity.
Lessons are read in Bengali or English; quizzes reinforce learning.

## Your Role & The 80/20 Magnetic Storytelling Formula
Generate ONE complete lesson + ONE quiz pair per day.
The lesson is a 280-350 word humanized story told as realistic dialogue between three fictional family characters ([Rahim - Father], [Asha - Mother], [Rafi - Child]), framed by [Storyteller].
1. **Magnetic First-Line Hook (Crucial):** The very first line must hook the reader immediately with suspense, curiosity, a relatable emotional conflict, a sudden problem, or a humorous surprise so the reader cannot stop reading until the end.
2. **The 80/20 Language Rule (80% Basic Conversational + 20% Smart Advanced English):**
   - **80% Simple & Short Everyday Conversation:** 80% of the dialogue must use short, natural, crystal-clear sentences (5 to 10 words per sentence) that even a basic beginner can understand and use in daily conversation immediately.
   - **20% Smart Advanced English:** Naturally weave 20% richer, high-value vocabulary, idioms, or expressive phrases into the dialogue so learners upgrade their English in context. Always include these 20% advanced words in the `vocabulary` array with clear meanings.
3. **Human Warmth & Realism:** Show real human emotions, gentle family banter, relatable South Asian daily struggles, and end with one practical 5-minute habit action. Never sound robotic or lecture-like.
Quizzes are exactly 3 HARD multiple-choice questions testing inference, application, and character trade-offs.

## Topic Selection Strategy
- Rotate through these themes weekly:
  Week 1: Sleep & Recovery (Mon-Sun)
  Week 2: Focus & Deep Work (Mon-Sun)
  Week 3: Health & Energy (Mon-Sun)
  Week 4: Relationships & Social Habits (Mon-Sun)
  Week 5: Learning & Growth (Mon-Sun)
  
- Vary story types:
  * Personal story (day 1-2): a fictional family's relatable experience
  * Science explainer (day 3-4): explain a practical idea through family dialogue, without invented claims
  * Myth-buster (day 5): clarify a common belief through family dialogue
  * Tool/technique (day 6-7): act out an actionable method
  
- Avoid repeating lessons within 90 days.
- Link lesson topic to season/context (e.g., winter routines in January, exam stress in May).

## Lesson Structure (mandatory)
### Lesson Attributes
{
  "slug": "kebab-case-title",
  "title": "Human-readable title (5-10 words)",
  "description": "1-2 sentence hook (under 100 chars)",
  "content": "A 280-350 word humanized dialogue script with one tagged speaker per line (12-16 dialogue lines)",
  "category": "sleep|focus|health|social|growth",
  "locale": "en|bn",
  "storyType": "personal|science|myth|tool",
  "keyTakeaway": "One sentence: what should the reader do?",
  "vocabulary": [
    { "term": "word", "definition": "short definition in the same language" }
  ]
}

### Lesson Content Guidelines
1. Use exactly these four voice tags and keep them unchanged in both languages:
    - [Rahim - Father]: (adult male)
    - [Asha - Mother]: (adult female)
    - [Rafi - Child]: (child)
    - [Storyteller]: (storyteller voice; not a fourth family character)
2. Every non-empty content line must start with exactly one speaker tag. The story must be 12-16 dialogue lines: start with a short storyteller introduction, alternate the three family characters through the story with real back-and-forth (reactions, questions, gentle disagreement), add a short storyteller transition or observation around the middle, and end with a storyteller closing line after the family's agreed action.
3. Give the family a believable everyday problem connected to the selected theme. Let them react like real humans — show feelings, ask questions, disagree gently, laugh a little, and work out one small practical step together. The outcome must stay reasonable and achievable.
4. Make the characters sound distinct and natural. Keep English dialogue simple and conversational. For Bengali, use clear, respectful Bengali while retaining the English speaker tags.
5. End with one small action they agree to try within five minutes.
6. Always include 5-8 vocabulary entries: pick the hardest or most useful words from the story, each with a short definition in the same language, so readers can tap any word and learn its meaning.
6. **Tone**:
   - Friendly, conversational, and encouraging without toxic positivity.
   - South Asian friendly: respect for family, elders, and practical constraints.
   - Use a little artistic storytelling: a few concrete sounds, sights, gestures, pauses, or small setting details that help readers picture the scene naturally. Weave these into the storyteller's tagged lines and dialogue; do not add untagged stage directions or image/design instructions.
   - Include one or two gentle, character-specific funny moments or witty observations. Keep humour affectionate and rooted in the situation; never turn people into caricatures or let a joke interrupt the practical lesson.

7. **Avoid**:
   - Medical diagnosis or treatment claims.
   - Repeating the same examples.
   - Unverified claims, invented science, or statistics.
   - Anything that requires equipment or money.

## Quiz Structure (mandatory)
### Quiz Attributes
{
  "lessonSlug": "same as lesson slug",
  "questions": [
    {
      "text": "Question (5-15 words, clear)",
      "options": [
        { "text": "Correct answer (must be unambiguous)", "correct": true },
        { "text": "Plausible distractor (common misconception)", "correct": false },
        { "text": "Plausible distractor (related but wrong)", "correct": false },
        { "text": "Plausible distractor (sounds right but isn't)", "correct": false }
      ],
      "explanation": "Why this is correct. 1-2 sentences."
    }
  ]
}

### Quiz Design Rules
Create exactly 3 HARD questions, and base every answer only on the generated story and its stated lesson.
1. Make the quiz genuinely hard: the reader must connect multiple story details, infer a hidden reason, or apply the lesson to a new but similar situation. At least one question must be inference/analysis, one must apply the lesson to a new situation, and one must test the trade-off or choice the characters made. Never make answers obvious from a single sentence, and never use direct recall as the whole quiz.
2. **Question types**: Include one inference/analysis question, one application-to-a-new-situation question, and one question about the choice or trade-off the characters made. A direct recall question may support one of these, but must not be the whole quiz.

3. **Distractors MUST be**:
    - Wrong but highly believable — a hurried reader should find them tempting (not obviously silly).
    - Related to the topic (not random).
    - Based on common misconceptions (not made up).
   
4. **Avoid**:
   - True/false (too easy).
   - "All of the above" or "None of the above" (ambiguous).
   - Overly long questions (should be one sentence max).
   - Trick questions.

5. **Explanations**:
   - Reinforce the correct answer.
   - Explain why distractors are wrong.
   - 1-2 sentences, plain language.

## Language-Specific Rules
### English Lessons
- Use Oxford spelling (colour, realise).
- Inclusive language (they/them for singular they; avoid gendered assumptions).
- Examples from UK, South Asia, North America (not US-only).

### Bengali Lessons
- Use formal address (আপনি), not casual.
- Prioritize clarity over poetic language.
- Use common Bengali words; avoid overly Arabic/Persian terms unless necessary.
- Examples from Bangladeshi daily life (classroom, office, home, bazaar).
- Translate technical terms clearly.

## Daily Output Format
Return ONLY a JSON object (no markdown fences, no preamble):
{
  "lesson": { ... },
  "quiz": { ... }
}`;

const THEMES = [
  'Sleep & Recovery',
  'Focus & Deep Work',
  'Health & Energy',
  'Relationships & Social Habits',
  'Learning & Growth',
];

export function getSeasonBangladesh(dateInput) {
  const d = typeof dateInput === 'string' ? new Date(`${dateInput}T00:00:00.000Z`) : new Date(dateInput);
  const month = d.getUTCMonth() + 1; // 1-12
  if (month === 12 || month === 1 || month === 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'monsoon';
}

export function getThemeForDate(dateInput) {
  const d = typeof dateInput === 'string' ? new Date(`${dateInput}T00:00:00.000Z`) : new Date(dateInput);
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const pastDays = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(pastDays / 7);
  return THEMES[weekNum % THEMES.length];
}

export function getStoryTypeForDate(dateInput) {
  const d = typeof dateInput === 'string' ? new Date(`${dateInput}T00:00:00.000Z`) : new Date(dateInput);
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  if (day === 1 || day === 2) return 'personal'; // Mon, Tue
  if (day === 3 || day === 4) return 'science';  // Wed, Thu
  if (day === 5) return 'myth';                  // Fri
  return 'tool';                                 // Sat, Sun
}

export function parseAndValidateDailyLessonPayload(rawText) {
  const cleaned = rawText
    ?.replace(/^```(?:json)?\s*/i, '')
    ?.replace(/\s*```$/i, '')
    ?.trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', {
      en: 'AI returned invalid JSON for daily lesson.',
      bn: 'দৈনিক পাঠের জন্য AI অবৈধ JSON প্রদান করেছে।',
    });
  }

  let payload;
  try {
    payload = dailyLessonPayloadSchema.parse(parsed);
  } catch (err) {
    logger.warn({ err }, 'Daily lesson payload schema validation failed');
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', {
      en: 'AI generated daily lesson does not match required schema.',
      bn: 'AI দ্বারা তৈরি দৈনিক পাঠ প্রয়োজনীয় কাঠামো পূরণ করেনি।',
    });
  }

  if (
    payload.quiz.questions.length !== 3
    || !hasCompleteStoryScript(payload.lesson.content)
  ) {
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', {
      en: 'AI lesson must be a three-character story with a three-question quiz.',
      bn: 'AI পাঠে তিনটি চরিত্রের গল্প ও তিনটি কুইজ প্রশ্ন থাকতে হবে।',
    });
  }

  for (const q of payload.quiz.questions) {
    const hasCorrect = q.options.some((opt) => opt.correct === true);
    if (!hasCorrect) {
      throw new AppError(502, 'UPSTREAM_UNAVAILABLE', {
        en: 'Quiz question lacks a correct answer.',
        bn: 'কুইজ প্রশ্নে সঠিক উত্তর চিহ্নিত করা নেই।',
      });
    }
  }

  return payload;
}

export function formatQuizForLearner(quiz) {
  if (!quiz) return null;
  return {
    _id: quiz._id,
    dailyLessonId: quiz.dailyLessonId,
    lessonSlug: quiz.lessonSlug,
    questions: quiz.questions.map((q) => ({
      text: q.text,
      options: q.options.map((o) => ({ text: o.text })),
    })),
    questionCount: quiz.questions.length,
  };
}

function formatDailyLessonForLearner(lesson) {
  const dailyLesson = lesson.toObject ? lesson.toObject() : lesson;
  return {
    ...dailyLesson,
    audio: dailyLesson.audio ? {
      status: dailyLesson.audio.status,
      url: dailyLesson.audio.url,
      durationSeconds: dailyLesson.audio.durationSeconds,
    } : null,
  };
}

export async function generateDailyLesson({ date, locale = 'bn', config, force = false, context = '', strictAI = false }) {
  const dateStr = date || todayInZone('Asia/Dhaka');
  const targetLocale = locale === 'en' ? 'en' : 'bn';
  let shouldUpsert = force;
  const existingForDate = await DailyLesson.findOne({ date: dateStr, locale: targetLocale });

  if (!force) {
    if (existingForDate) {
      const quiz = await Quiz.findOne({ dailyLessonId: existingForDate._id }).lean();
      if (quiz) return { dailyLesson: formatDailyLessonForLearner(existingForDate), quiz };
      shouldUpsert = true;
    }
  }

  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = daysOfWeek[d.getUTCDay()];
  const season = getSeasonBangladesh(d);
  const theme = getThemeForDate(d);
  const storyType = getStoryTypeForDate(d);

  const recentSlugs = await DailyLesson.distinct('slug', {
    createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  });

  const userPrompt = `
Current date: ${dateStr}
Current day of week: ${dayOfWeek}
Current season in Bangladesh: ${season}
Selected theme: ${theme}
Selected story type: ${storyType}
Locale: ${targetLocale} (${targetLocale === 'bn' ? 'Bengali (বাংলা)' : 'English'})
Style direction: HOOK the reader in line 1 with an irresistible curiosity/emotional situation so they stay glued till the end. Follow the 80/20 English rule strictly: 80% short, simple everyday conversational sentences for basic learners + 20% smart advanced English words/phrases explained in vocabulary. Make all three quiz questions challenging through inference, application, or character-choice analysis.
Recent lesson slugs to avoid (last 90 days): ${recentSlugs.slice(0, 30).join(', ') || '(none)'}

${context.trim() ? `Admin-provided story direction (follow where compatible with the safety and format rules): ${context.trim()}` : 'No extra context was provided.'}

Generate today's complete lesson and quiz pair according to the Master Prompt rules. Return ONLY the JSON object.
`.trim();

  let payload;
  let generationSource = 'ai';
  try {
    const { text } = await askAI({
      messages: [
        { role: 'system', content: MASTER_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      config,
      maxTokens: 4096,
      temperature: 0.6,
      allowFallback: !strictAI,
    });
    payload = parseAndValidateDailyLessonPayload(text);
  } catch (err) {
    if (strictAI) {
      logger.warn({ locale: targetLocale, date: dateStr, errName: err.name, code: err.code }, 'admin daily story generation failed');
      throw new AppError(502, 'UPSTREAM_UNAVAILABLE', {
        en: 'Gemini could not generate a replacement story. The published story was not changed.',
        bn: 'Gemini নতুন গল্প তৈরি করতে পারেনি। প্রকাশিত গল্পটি বদলানো হয়নি।',
      });
    }
    generationSource = 'curated-fallback';
    logger.warn({ locale: targetLocale, date: dateStr, errName: err.name, code: err.code }, 'using curated daily lesson fallback');
    payload = createCuratedDailyLesson(dateStr, targetLocale);
  }

  let slug = payload.lesson.slug;
  const slugFilter = (candidate) => ({
    slug: candidate,
    ...(existingForDate ? { _id: { $ne: existingForDate._id } } : {}),
  });
  let collision = await DailyLesson.exists(slugFilter(slug));
  for (let suffixNumber = 0; collision; suffixNumber += 1) {
    const suffix = `-${dateStr}-${targetLocale}${suffixNumber ? `-${suffixNumber}` : ''}`;
    slug = `${payload.lesson.slug.slice(0, 80 - suffix.length).replace(/-+$/, '')}${suffix}`;
    collision = await DailyLesson.exists(slugFilter(slug));
  }
  if (slug !== payload.lesson.slug) {
    payload.lesson.slug = slug;
    payload.quiz.lessonSlug = slug;
  }

  const keepAudio = existingForDate?.content === payload.lesson.content;
  const lessonAudio = keepAudio
    ? existingForDate.audio
    : { status: 'pending', url: null, publicId: null, error: null };
  let dailyLesson;
  if (shouldUpsert) {
    dailyLesson = await DailyLesson.findOneAndUpdate(
      { date: dateStr, locale: targetLocale },
      {
        ...payload.lesson,
        date: dateStr,
        locale: targetLocale,
        generationSource,
        generatedAt: new Date(),
        audio: lessonAudio,
      },
      { upsert: true, new: true }
    );
  } else {
    dailyLesson = await DailyLesson.create({
      ...payload.lesson,
      date: dateStr,
      locale: targetLocale,
      generationSource,
      generatedAt: new Date(),
    });
  }
  if (existingForDate?.audio?.status === 'ready' && existingForDate.audio.publicId && !keepAudio) {
    try {
      // Keep audio permanently in Cloudinary: // await cloudinary().client.destroy(existingForDate.audio.publicId, 'video');
    } catch (err) {
      logger.warn({ lessonId: String(existingForDate._id), errName: err.name }, 'could not remove superseded daily lesson narration');
    }
  }

  const quiz = await Quiz.findOneAndUpdate(
    { dailyLessonId: dailyLesson._id },
    {
      dailyLessonId: dailyLesson._id,
      lessonSlug: dailyLesson.slug,
      questions: payload.quiz.questions,
      generatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  if (!dailyLesson.quizId || String(dailyLesson.quizId) !== String(quiz._id)) {
    dailyLesson.quizId = quiz._id;
    await dailyLesson.save();
  }

  logger.info({ slug: dailyLesson.slug, date: dateStr, locale: targetLocale, generationSource }, 'daily lesson generated');
  return { dailyLesson: formatDailyLessonForLearner(dailyLesson), quiz };
}

export async function generateAdminDailyLessonAudio(id, config) {
  if (!config?.ELEVENLABS_API_KEY || !config?.CLOUDINARY_CLOUD_NAME || !config?.CLOUDINARY_API_KEY || !config?.CLOUDINARY_API_SECRET) {
    throw new AppError(503, 'UNAVAILABLE', {
      en: 'Configure ElevenLabs and Cloudinary on the server before generating narration.',
      bn: 'নির্দেশিত অডিও তৈরির আগে সার্ভারে ElevenLabs ও Cloudinary কনফিগার করুন।',
    });
  }

  const lesson = await DailyLesson.findById(id);
  if (!lesson) {
    throw new AppError(404, 'NOT_FOUND', { en: 'Daily lesson not found.', bn: 'দৈনিক পাঠ পাওয়া যায়নি।' });
  }
  const previousAudio = lesson.audio?.toObject?.() || lesson.audio;
  const requestedVoiceConfig = getNarrationVoiceConfigVersion(config);
  if (
    lesson.audio?.status === 'ready'
    && lesson.audio.url
    && lesson.audio.voiceConfigVersion === requestedVoiceConfig
  ) {
    return { lesson, reused: true };
  }
  const processingIsFresh = lesson.audio?.status === 'processing'
    && Date.now() - new Date(lesson.audio.updatedAt || 0).getTime() < NARRATION_PROCESSING_TIMEOUT_MS;
  if (processingIsFresh) {
    throw new AppError(409, 'CONFLICT', {
      en: 'Narration is already being generated for this story.',
      bn: 'এই গল্পের অডিও তৈরি হচ্ছে।',
    });
  }

  const claimId = crypto.randomUUID();
  const processing = await DailyLesson.findOneAndUpdate(
    {
      _id: lesson._id,
      $or: [
        { 'audio.status': { $nin: ['ready', 'processing'] } },
        {
          'audio.status': 'processing',
          'audio.updatedAt': { $lt: new Date(Date.now() - NARRATION_PROCESSING_TIMEOUT_MS) },
        },
        {
          'audio.status': 'ready',
          $or: [
            { 'audio.url': { $in: [null, ''] } },
            { 'audio.voiceConfigVersion': { $ne: requestedVoiceConfig } },
          ],
        },
      ],
    },
    {
      $set: {
        'audio.status': 'processing',
        'audio.error': null,
        'audio.updatedAt': new Date(),
        'audio.voiceConfigVersion': claimId,
      },
    },
    { new: true }
  );
  if (!processing) {
    const latest = await DailyLesson.findById(id);
    if (latest?.audio?.status === 'ready' && latest.audio.url) return { lesson: latest, reused: true };
    throw new AppError(409, 'CONFLICT', {
      en: 'Narration is already being generated for this story.',
      bn: 'এই গল্পের অডিও তৈরি হচ্ছে।',
    });
  }

  try {
    const audio = await generateAndUploadLessonAudio({ lesson: processing.toObject(), config });
    const savedLesson = await DailyLesson.findOneAndUpdate(
      {
        _id: processing._id,
        content: processing.content,
        'audio.status': 'processing',
        'audio.voiceConfigVersion': claimId,
      },
      { $set: { audio } },
      { new: true }
    );
    if (!savedLesson) {
      throw new AppError(409, 'CONFLICT', {
        en: 'The story changed while narration was being generated. Retry with the latest story.',
        bn: 'অডিও তৈরির সময় গল্পটি বদলেছে। সর্বশেষ গল্পের জন্য আবার চেষ্টা করুন।',
      });
    }
    if (previousAudio?.publicId && previousAudio.publicId !== audio.publicId) {
      try {
        // Keep audio permanently in Cloudinary: // await cloudinary().client.destroy(previousAudio.publicId, 'video');
      } catch (err) {
        logger.warn({ lessonId: String(lesson._id), errName: err.name }, 'could not remove replaced daily lesson narration');
      }
    }
    return { lesson: savedLesson, reused: false };
  } catch (err) {
    await DailyLesson.updateOne(
      { _id: processing._id, content: processing.content, 'audio.status': 'processing', 'audio.voiceConfigVersion': claimId },
      {
        $set: {
          'audio.status': 'failed',
          'audio.url': null,
          'audio.publicId': null,
          'audio.durationSeconds': null,
          'audio.voiceConfigVersion': null,
          'audio.createdAt': null,
          'audio.updatedAt': new Date(),
          'audio.error': 'Narration generation failed. Check server logs and provider configuration.',
        },
      }
    );
    if (err instanceof AppError && err.status === 409) throw err;
    logger.error({ lessonId: String(lesson._id), errName: err.name }, 'daily lesson narration generation failed');
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', {
      en: 'Narration could not be generated or saved. Please check provider configuration and try again.',
      bn: 'অডিও তৈরি বা সংরক্ষণ করা যায়নি। provider কনফিগারেশন যাচাই করে আবার চেষ্টা করুন।',
    });
  }
}

export async function getTodayDailyLesson({ date, locale = 'bn' }) {
  const targetDate = date || todayInZone('Asia/Dhaka');
  const targetLocale = locale === 'en' ? 'en' : 'bn';

  let dailyLesson = await DailyLesson.findOne({ date: targetDate, locale: targetLocale }).lean();
  if (!dailyLesson) {
    dailyLesson = await DailyLesson.findOne({ locale: targetLocale }).sort({ date: -1 }).lean();
  }

  if (!dailyLesson) {
    return {
      dailyLesson: null,
      quiz: null,
      message: {
        en: "No daily lesson is available yet. New lessons are generated daily at midnight Bangladesh time.",
        bn: "আজকের দৈনিক পাঠ এখনও তৈরি হয়নি। নতুন পাঠ প্রতিদিন বাংলাদেশ সময় রাত ১২টায় তৈরি হয়।",
      },
    };
  }

  const quiz = await Quiz.findOne({ dailyLessonId: dailyLesson._id }).lean();
  return {
    dailyLesson: formatDailyLessonForLearner(dailyLesson),
    quiz: formatQuizForLearner(quiz),
  };
}

export async function getLatestDailyQuiz({ locale = 'bn' }) {
  const targetLocale = locale === 'en' ? 'en' : 'bn';
  const latestLesson = await DailyLesson.findOne({ locale: targetLocale }).sort({ date: -1 }).lean();
  if (!latestLesson) {
    return {
      quiz: null,
      message: {
        en: 'No quiz available yet.',
        bn: 'এখনও কোনো কুইজ পাওয়া যায়নি।',
      },
    };
  }

  const quiz = await Quiz.findOne({ dailyLessonId: latestLesson._id }).lean();
  return {
    quiz: formatQuizForLearner(quiz),
    lessonSlug: latestLesson.slug,
  };
}

export async function listAdminDailyLessons() {
  const lessons = await DailyLesson.find({}).sort({ date: -1, locale: 1 }).limit(60).lean();
  const quizzes = await Quiz.find({ dailyLessonId: { $in: lessons.map((lesson) => lesson._id) } }).lean();
  const quizByLesson = new Map(quizzes.map((quiz) => [String(quiz.dailyLessonId), quiz]));
  return lessons.map((lesson) => ({
    ...lesson,
    id: String(lesson._id),
    quiz: quizByLesson.get(String(lesson._id)) || null,
  }));
}

export async function updateAdminDailyLesson(id, payload) {
  const lesson = await DailyLesson.findById(id);
  if (!lesson) {
    throw new AppError(404, 'NOT_FOUND', { en: 'Daily lesson not found.', bn: 'দৈনিক পাঠ পাওয়া যায়নি।' });
  }
  if (payload.lesson.locale !== lesson.locale || payload.lesson.slug !== lesson.slug) {
    throw new AppError(400, 'VALIDATION_FAILED', {
      en: 'The lesson language and URL cannot be changed here.',
      bn: 'এখান থেকে পাঠের ভাষা ও URL বদলানো যাবে না।',
    });
  }

  const contentChanged = payload.lesson.content !== lesson.content;
  const previousAudio = lesson.audio?.toObject?.() || lesson.audio;
  Object.assign(lesson, payload.lesson, { date: lesson.date, locale: lesson.locale, generatedAt: new Date() });
  if (contentChanged) {
    lesson.audio = { status: 'pending', url: null, publicId: null, error: null };
  }
  await lesson.save();
  if (contentChanged && previousAudio?.publicId && previousAudio.status === 'ready') {
    try {
      // Keep audio permanently in Cloudinary: // await cloudinary().client.destroy(previousAudio.publicId, 'video');
    } catch (err) {
      logger.warn({ lessonId: String(lesson._id), errName: err.name }, 'could not remove superseded daily lesson narration');
    }
  }
  const quiz = await Quiz.findOneAndUpdate(
    { dailyLessonId: lesson._id },
    {
      dailyLessonId: lesson._id,
      lessonSlug: lesson.slug,
      questions: payload.quiz.questions,
      generatedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true }
  );
  lesson.quizId = quiz._id;
  await lesson.save();
  return { lesson, quiz };
}

export async function submitDailyQuizAttempt({ quizId, userId, answers, timezone }) {
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) {
    throw new AppError(404, 'NOT_FOUND', {
      en: 'Quiz not found.',
      bn: 'কুইজ পাওয়া যায়নি।',
    });
  }

  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    throw new AppError(400, 'VALIDATION_FAILED', {
      en: 'Answer count must match question count.',
      bn: 'উত্তরের সংখ্যা প্রশ্নের সংখ্যার সমান হতে হবে।',
    });
  }

  const results = quiz.questions.map((q, i) => {
    const correctIndex = q.options.findIndex((opt) => opt.correct === true);
    const selectedIndex = answers[i];
    const isCorrect = selectedIndex === correctIndex;
    return {
      questionIndex: i,
      selectedIndex,
      correctIndex,
      correct: isCorrect,
      explanation: q.explanation,
    };
  });

  const score = results.filter((r) => r.correct).length;
  const total = quiz.questions.length;

  if (userId) {
    await DailyQuizScore.create({
      userId,
      quizId: quiz._id,
      dailyLessonId: quiz.dailyLessonId,
      score,
      total,
      answers,
    });
  }

  const awardedBadges = userId ? await evaluateAndAwardBadges(userId, timezone) : [];
  return { score, total, results, awardedBadges };
}

export async function recordLessonFeedback({ dailyLessonId, userId = null, helpful = null, accurate = null, rating = null, comment = null }) {
  const lesson = await DailyLesson.findById(dailyLessonId);
  if (!lesson) {
    throw new AppError(404, 'NOT_FOUND', { en: 'Daily lesson not found.', bn: 'দৈনিক পাঠ পাওয়া যায়নি।' });
  }

  const feedback = await DailyLessonFeedback.create({
    dailyLessonId: lesson._id,
    userId,
    helpful,
    accurate,
    rating,
    comment,
  });

  // Automated quality gatekeeper: if 3+ users flag lesson as inaccurate, flag for human review
  if (accurate === false) {
    const inaccurateCount = await DailyLessonFeedback.countDocuments({
      dailyLessonId: lesson._id,
      accurate: false,
    });
    if (inaccurateCount >= 3 && !lesson.flaggedForReview) {
      lesson.flaggedForReview = true;
      lesson.flagReason = `Flagged by ${inaccurateCount} users as inaccurate.`;
      lesson.flaggedAt = new Date();
      await lesson.save();
      logger.warn({ lessonId: lesson._id, slug: lesson.slug }, 'Daily lesson flagged for editorial review due to inaccuracy reports');
    }
  }

  return feedback;
}

export async function reportQuizQuestion({ quizId, userId = null, questionIndex, reason }) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new AppError(404, 'NOT_FOUND', { en: 'Quiz not found.', bn: 'কুইজ পাওয়া যায়নি।' });
  }

  if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
    throw new AppError(400, 'VALIDATION_FAILED', { en: 'Invalid question index.', bn: 'ভুল প্রশ্ন নম্বর।' });
  }

  const report = await QuizReport.create({
    quizId: quiz._id,
    dailyLessonId: quiz.dailyLessonId,
    userId,
    questionIndex,
    reason,
  });

  // Increment report count on quiz
  quiz.reportCount = (quiz.reportCount || 0) + 1;

  // Automated quality gatekeeper: if reports >= 10, flag quiz for review
  if (quiz.reportCount >= 10 && !quiz.flaggedForReview) {
    quiz.flaggedForReview = true;
    quiz.flagReason = `Flagged due to ${quiz.reportCount} user reports on question accuracy.`;
    quiz.flaggedAt = new Date();
    logger.warn({ quizId: quiz._id, slug: quiz.lessonSlug }, 'Quiz flagged for editorial review due to user reports');
  }
  await quiz.save();

  return report;
}

export async function recordLessonShare({ dailyLessonId }) {
  const lesson = await DailyLesson.findByIdAndUpdate(
    dailyLessonId,
    { $inc: { shareCount: 1 } },
    { new: true }
  );
  if (!lesson) {
    throw new AppError(404, 'NOT_FOUND', { en: 'Daily lesson not found.', bn: 'দৈনিক পাঠ পাওয়া যায়নি।' });
  }
  return { shared: true, shareCount: lesson.shareCount };
}

export async function calculateDailyLessonMetrics() {
  const totalLessons = await DailyLesson.countDocuments();
  const flaggedLessons = await DailyLesson.countDocuments({ flaggedForReview: true });
  const flaggedQuizzes = await Quiz.countDocuments({ flaggedForReview: true });

  // Quiz accuracy: % of attempts with score / total >= 0.75
  const scores = await DailyQuizScore.find().select('score total userId attemptedAt').lean();
  const totalAttempts = scores.length;
  const highScorers = scores.filter((s) => s.total > 0 && (s.score / s.total) >= 0.75).length;
  const quizAccuracyPercent = totalAttempts > 0 ? Math.round((highScorers / totalAttempts) * 100) : 0;

  // Feedback scores
  const feedbacks = await DailyLessonFeedback.find().select('rating helpful accurate').lean();
  const rated = feedbacks.filter((f) => typeof f.rating === 'number');
  const avgRating = rated.length > 0
    ? Number((rated.reduce((sum, f) => sum + f.rating, 0) / rated.length).toFixed(2))
    : 0;

  const helpfulCount = feedbacks.filter((f) => f.helpful === true).length;
  const helpfulPercent = feedbacks.length > 0
    ? Math.round((helpfulCount / feedbacks.length) * 100)
    : 0;

  // Shares
  const allLessons = await DailyLesson.find().select('shareCount').lean();
  const totalShares = allLessons.reduce((sum, l) => sum + (l.shareCount || 0), 0);

  return {
    overview: {
      totalLessons,
      flaggedLessons,
      flaggedQuizzes,
      totalAttempts,
      totalFeedback: feedbacks.length,
      totalShares,
    },
    metrics: {
      quizAccuracyPercent, // Target: 75%+
      averageRating: avgRating, // Target: 4.0+/5
      helpfulPercent,
      completionCount: totalAttempts,
    },
  };
}
