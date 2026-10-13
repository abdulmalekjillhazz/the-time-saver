import { z } from 'zod';

const bn = (max) => z.string().trim().min(1).max(max);
const bilingual = (max) => z.object({ bn: bn(max), en: bn(max) }).strict();

export const lessonSlugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, digits and hyphens only');

// A lesson as written by an author. Bilingual throughout (Bangla first).
export const lessonDraftSchema = z
  .object({
    slug: lessonSlugSchema,
    title: bilingual(200),
    body: bilingual(5000),
    vocabulary: z
      .array(z.object({ word: bn(60), meaning: bilingual(200) }).strict())
      .max(30)
      .default([]),
    quiz: z
      .array(
        z
          .object({
            question: bilingual(300),
            options: z.array(bilingual(120)).length(4),
            answerIndex: z.number().int().min(0).max(3),
          })
          .strict()
      )
      .max(20)
      .default([]),
    aiDrafted: z.boolean().default(false),
  })
  .strict();

export const lessonEditSchema = z
  .object({
    title: bilingual(200),
    body: bilingual(5000),
    vocabulary: lessonDraftSchema.shape.vocabulary.optional(),
    quiz: lessonDraftSchema.shape.quiz.optional(),
  })
  .strict();

// What a learner sends when submitting a quiz. One answer per question, each 0 to 3.
export const lessonAttemptSchema = z
  .object({
    answers: z.array(z.number().int().min(0).max(3)).min(1).max(20),
  })
  .strict();

// Daily AI-generated lesson attributes matching MASTER_PROMPT specification
export const dailyLessonItemSchema = z
  .object({
    slug: lessonSlugSchema,
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(3).max(200),
    content: z.string().trim().min(50),
    category: z.enum(['sleep', 'focus', 'health', 'social', 'growth']),
    locale: z.enum(['en', 'bn']),
    storyType: z.enum(['personal', 'science', 'myth', 'tool']),
    keyTakeaway: z.string().trim().min(3).max(300),
    vocabulary: z
      .array(
        z
          .object({
            term: z.string().trim().min(1).max(100),
            definition: z.string().trim().min(1).max(300),
          })
          .strict()
      )
      .default([]),
  })
  .strict();

export const dailyQuizOptionSchema = z
  .object({
    text: z.string().trim().min(1).max(200),
    correct: z.boolean(),
  })
  .strict();

export const dailyQuizQuestionSchema = z
  .object({
    text: z.string().trim().min(3).max(300),
    options: z.array(dailyQuizOptionSchema).length(4),
    explanation: z.string().trim().min(3).max(500),
  })
  .strict();

export const dailyQuizItemSchema = z
  .object({
    lessonSlug: lessonSlugSchema,
    questions: z.array(dailyQuizQuestionSchema).min(1).max(10),
  })
  .strict();

export const dailyLessonPayloadSchema = z
  .object({
    lesson: dailyLessonItemSchema,
    quiz: dailyQuizItemSchema,
  })
  .strict();

export const dailyLessonEditSchema = dailyLessonPayloadSchema.refine(
  (payload) => payload.quiz.questions.length === 3,
  'a daily lesson must have exactly three quiz questions'
).refine(
  (payload) => payload.quiz.questions.every((question) => question.options.filter((option) => option.correct).length === 1),
  'each daily quiz question must have exactly one correct answer'
);

export const dailyQuizAttemptSchema = z
  .object({
    answers: z.array(z.number().int().min(0).max(3)).min(1).max(10),
  })
  .strict();
