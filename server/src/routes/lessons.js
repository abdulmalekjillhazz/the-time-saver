import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { lessonAttemptSchema, dailyQuizAttemptSchema, dailyLessonReadSchema } from '@smart-routine/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { AppError, MSG } from '../lib/AppError.js';
import { listPublished, findPublishedBySlug, toPublicLesson, submitAttempt, recordPublishedLessonRead } from '../services/lessons.js';
import {
  getTodayDailyLesson,
  generateDailyLesson,
  submitDailyQuizAttempt,
  recordLessonFeedback,
  recordLessonShare,
  calculateDailyLessonMetrics,
} from '../services/dailyLesson.js';
import { recordDailyLessonRead } from '../services/gamification.js';
import { isEnabledFor } from '../services/flags.js';
import { SESSION_COOKIE } from '../lib/cookies.js';
import { loadSession, loadUserForSession } from '../services/session.js';
import { listPublicLandingQuizzes, submitLandingQuizAnswer } from '../services/landingQuizzes.js';

const MINUTE = 60 * 1000;
const landingQuizAnswerSchema = z.object({
  answerIndex: z.number().int().min(0).max(3),
  locale: z.enum(['bn', 'en']).default('bn'),
}).strict();

function parseLandingQuizSlot(value) {
  const slot = Number(value);
  if (![1, 2].includes(slot)) {
    throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
  }
  return slot;
}

async function tryAttachUser(req) {
  try {
    const session = await loadSession(req.cookies?.[SESSION_COOKIE]);
    if (session) {
      const user = await loadUserForSession(session);
      req.session = session;
      req.user = user;
      req.userId = String(user._id);
    }
  } catch {
    // Unauthenticated request is permitted
  }
}

export function lessonsRouter(config) {
  const r = Router();

  // Public: published lessons only. No answer keys, no author or status fields.
  r.get('/', rateLimit({ name: 'lessons-list', limit: 120, windowMs: MINUTE }), async (_req, res, next) => {
    try {
      res.json({ lessons: await listPublished() });
    } catch (err) {
      next(err);
    }
  });

  r.get('/landing-quizzes', rateLimit({ name: 'landing-quizzes', limit: 120, windowMs: MINUTE }), async (_req, res, next) => {
    try {
      res.json({ quizzes: await listPublicLandingQuizzes() });
    } catch (err) {
      next(err);
    }
  });

  r.post(
    '/landing-quizzes/:slot/attempts',
    rateLimit({ name: 'landing-quiz-attempt', limit: 30, windowMs: MINUTE, by: 'ip' }),
    validate({ body: landingQuizAnswerSchema }),
    async (req, res, next) => {
      try {
        const result = await submitLandingQuizAnswer(
          parseLandingQuizSlot(req.params.slot),
          req.body.answerIndex,
          req.body.locale
        );
        if (!result) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/lessons/today - fetch today's daily lesson and quiz
  r.get('/today', rateLimit({ name: 'lessons-today', limit: 60, windowMs: MINUTE }), async (req, res, next) => {
    try {
      await tryAttachUser(req);
      if (req.userId && !(await isEnabledFor('lessons.daily', req.userId))) {
        throw new AppError(403, 'FEATURE_DISABLED', {
          en: 'Daily lessons are not available for you yet.',
          bn: 'এখন আপনার জন্য দৈনিক পাঠ চালু হয়নি।',
        });
      }

      const locale = req.query.locale || req.user?.locale || 'bn';
      const date = req.query.date;
      const data = await getTodayDailyLesson({ date, locale });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  r.post(
    '/today/read',
    requireAuth,
    rateLimit({ name: 'daily-lesson-read', limit: 30, windowMs: MINUTE, by: 'user' }),
    validate({ body: dailyLessonReadSchema }),
    async (req, res, next) => {
      try {
        if (!(await isEnabledFor('lessons.daily', req.userId))) {
          throw new AppError(403, 'FEATURE_DISABLED', {
            en: 'Daily lessons are not available for you yet.',
            bn: 'এখন আপনার জন্য দৈনিক পাঠ চালু হয়নি।',
          });
        }
        if (!(await isEnabledFor('gamification.badges', req.userId))) {
          throw new AppError(403, 'FEATURE_DISABLED', {
            en: 'Learning badges are not available for you yet.',
            bn: 'এখন আপনার জন্য শেখার ব্যাজ চালু হয়নি।',
          });
        }
        const result = await recordDailyLessonRead({
          userId: req.userId,
          dailyLessonId: req.body.dailyLessonId,
          timezone: req.user.timezone,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/lessons/today/attempts - submit answers for today's daily quiz
  r.post(
    '/today/attempts',
    requireAuth,
    rateLimit({ name: 'daily-quiz-attempt', limit: 20, windowMs: MINUTE, by: 'user' }),
    validate({ body: dailyQuizAttemptSchema }),
    async (req, res, next) => {
      try {
        if (!(await isEnabledFor('lessons.daily', req.userId))) {
          throw new AppError(403, 'FEATURE_DISABLED', {
            en: 'Daily lessons are not available for you yet.',
            bn: 'এখন আপনার জন্য দৈনিক পাঠ চালু হয়নি।',
          });
        }

        const locale = req.user?.locale || 'bn';
        const { quiz } = await getTodayDailyLesson({ date: req.body.date, locale });
        if (!quiz || !quiz._id) {
          throw new AppError(404, 'NOT_FOUND', {
            en: "Today's quiz is not available.",
            bn: 'আজকের কুইজ পাওয়া যায়নি।',
          });
        }

        const result = await submitDailyQuizAttempt({
          quizId: quiz._id,
          userId: req.userId,
          answers: req.body.answers,
          timezone: req.user.timezone,
        });

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/lessons/today/feedback - submit feedback ("Was this helpful?", "Was this accurate?")
  r.post('/today/feedback', async (req, res, next) => {
    try {
      await tryAttachUser(req);
      const locale = req.query.locale || req.user?.locale || 'bn';
      const { dailyLesson } = await getTodayDailyLesson({ date: req.body.date, locale });
      if (!dailyLesson) {
        throw new AppError(404, 'NOT_FOUND', { en: 'Daily lesson not found.', bn: 'দৈনিক পাঠ পাওয়া যায়নি।' });
      }

      const feedback = await recordLessonFeedback({
        dailyLessonId: dailyLesson._id,
        userId: req.userId || null,
        helpful: typeof req.body.helpful === 'boolean' ? req.body.helpful : null,
        accurate: typeof req.body.accurate === 'boolean' ? req.body.accurate : null,
        rating: typeof req.body.rating === 'number' ? req.body.rating : null,
        comment: req.body.comment || null,
      });

      res.status(201).json({ success: true, feedbackId: feedback._id });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/lessons/today/share - record lesson share
  r.post('/today/share', async (req, res, next) => {
    try {
      const locale = req.query.locale || req.user?.locale || 'bn';
      const { dailyLesson } = await getTodayDailyLesson({ date: req.body.date, locale });
      if (!dailyLesson) {
        throw new AppError(404, 'NOT_FOUND', { en: 'Daily lesson not found.', bn: 'দৈনিক পাঠ পাওয়া যায়নি।' });
      }
      const result = await recordLessonShare({ dailyLessonId: dailyLesson._id });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/lessons/metrics - success metrics and quality tracking
  r.get('/metrics', async (_req, res, next) => {
    try {
      const metrics = await calculateDailyLessonMetrics();
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/lessons/daily/generate - manually trigger daily lesson generation
  r.post(
    '/daily/generate',
    requireAuth,
    rateLimit({ name: 'daily-lesson-generate', limit: 5, windowMs: MINUTE, by: 'user' }),
    async (req, res, next) => {
      try {
        if (req.user.role !== 'owner' && req.user.role !== 'editor') {
          throw new AppError(403, 'FORBIDDEN', MSG.forbidden);
        }

        const date = req.body.date;
        const locale = req.body.locale || req.user.locale || 'bn';
        const force = Boolean(req.body.force);

        const result = await generateDailyLesson({
          date,
          locale,
          config,
          force,
        });

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  r.get('/:slug', rateLimit({ name: 'lessons-read', limit: 120, windowMs: MINUTE }), async (req, res, next) => {
    try {
      const lesson = await findPublishedBySlug(req.params.slug);
      res.json({ lesson: toPublicLesson(lesson) });
    } catch (err) {
      next(err);
    }
  });

  // Signed-in learners only. Requires a published lesson id.
  r.post(
    '/:id/read',
    requireAuth,
    rateLimit({ name: 'published-lesson-read', limit: 30, windowMs: MINUTE, by: 'user' }),
    async (req, res, next) => {
      try {
        if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
        if (!(await isEnabledFor('lessons.quiz', req.userId))) {
          throw new AppError(503, 'UNAVAILABLE', { en: 'Lessons are not available for you yet.', bn: 'এখন আপনার জন্য পাঠ চালু হয়নি।' });
        }
        const result = await recordPublishedLessonRead(req.params.id, req.user);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  r.post(
    '/:id/attempts',
    requireAuth,
    rateLimit({ name: 'lesson-attempt', limit: 10, windowMs: MINUTE, by: 'user' }),
    validate({ body: lessonAttemptSchema }),
    async (req, res, next) => {
      try {
        if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
        if (!(await isEnabledFor('lessons.quiz', req.userId))) {
          throw new AppError(503, 'UNAVAILABLE', { en: 'Quizzes are not available for you yet.', bn: 'এখন আপনার জন্য কুইজ চালু হয়নি।' });
        }
        const result = await submitAttempt(req.params.id, req.user, req.body.answers);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return r;
}
