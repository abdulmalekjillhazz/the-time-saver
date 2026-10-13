import { Router } from 'express';
import { dailyQuizAttemptSchema } from '@smart-routine/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { isEnabledFor } from '../services/flags.js';
import { getLatestDailyQuiz, submitDailyQuizAttempt, reportQuizQuestion } from '../services/dailyLesson.js';

const MINUTE = 60 * 1000;

export function quizzesRouter() {
  const r = Router();

  // GET /api/quizzes/latest - fetch latest daily quiz (options without answer key)
  r.get('/latest', rateLimit({ name: 'quizzes-latest', limit: 60, windowMs: MINUTE }), async (req, res, next) => {
    try {
      const locale = req.query.locale || req.user?.locale || 'bn';
      const result = await getLatestDailyQuiz({ locale });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/quizzes/:id/attempts - submit answers for a daily quiz
  r.post(
    '/:id/attempts',
    requireAuth,
    rateLimit({ name: 'quiz-attempt', limit: 20, windowMs: MINUTE, by: 'user' }),
    validate({ body: dailyQuizAttemptSchema }),
    async (req, res, next) => {
      try {
        if (!(await isEnabledFor('lessons.daily', req.userId))) {
          throw new AppError(403, 'FEATURE_DISABLED', {
            en: 'Daily lessons are not available for you yet.',
            bn: 'এখন আপনার জন্য দৈনিক পাঠ চালু হয়নি।',
          });
        }

        const result = await submitDailyQuizAttempt({
          quizId: req.params.id,
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

  // POST /api/quizzes/:id/report - report incorrect question or answer
  r.post('/:id/report', async (req, res, next) => {
    try {
      const questionIndex = Number(req.body.questionIndex);
      const reason = req.body.reason || 'Incorrect answer reported by user';
      const report = await reportQuizQuestion({
        quizId: req.params.id,
        userId: req.userId || null,
        questionIndex,
        reason,
      });
      res.status(201).json({ success: true, reportId: report._id });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
