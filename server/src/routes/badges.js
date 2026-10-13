import { Router } from 'express';
import { emptyQuerySchema } from '@smart-routine/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { getGamificationSummary } from '../services/gamification.js';
import { isEnabledFor } from '../services/flags.js';

const MINUTE = 60 * 1000;

export function badgesRouter() {
  const r = Router();
  r.use(requireAuth);
  r.use(rateLimit({ name: 'badges', limit: 60, windowMs: MINUTE, by: 'user' }));

  r.get('/', validate({ query: emptyQuerySchema }), async (req, res, next) => {
    try {
      if (!(await isEnabledFor('gamification.badges', req.userId))) {
        throw new AppError(403, 'FEATURE_DISABLED', {
          en: 'Streaks and badges are not available for you yet.',
          bn: 'এখন আপনার জন্য স্ট্রিক ও ব্যাজ চালু হয়নি।',
        });
      }
      const summary = await getGamificationSummary(req.userId, req.user.timezone);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  return r;
}
