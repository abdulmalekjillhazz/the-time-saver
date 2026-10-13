import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { getDailyIslamicReflection } from '../services/islamicReflections.js';

const MINUTE = 60 * 1000;

export function islamicReflectionsRouter() {
  const router = Router();

  router.get('/today', rateLimit({ name: 'islamic-reflection', limit: 60, windowMs: MINUTE }), async (req, res, next) => {
    try {
      const reflection = await getDailyIslamicReflection({
        locale: req.query.locale === 'en' ? 'en' : 'bn',
      });
      res.json({ reflection });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
