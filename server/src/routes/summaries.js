import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { AppError } from '../lib/AppError.js';
import { isEnabledFor } from '../services/flags.js';
import { generateSummary } from '../services/weeklySummary.js';
import { WeeklySummary } from '../models/WeeklySummary.js';

const MINUTE = 60 * 1000;

export function summariesRouter(config) {
  const r = Router();
  r.use(requireAuth);
  r.use(rateLimit({ name: 'summaries', limit: 10, windowMs: MINUTE, by: 'user' }));

  // GET /api/summaries - fetch the latest summary for the user's locale
  r.get('/', async (req, res, next) => {
    try {
      const enabled = await isEnabledFor('summaries.weekly', req.userId);
      if (!enabled) {
        throw new AppError(403, 'FEATURE_DISABLED', {
          en: 'Weekly summaries are not available yet.',
          bn: 'সাপ্তাহিক সারসংক্ষেপ এখনও পাওয়া যায় না।',
        });
      }

      const locale = req.user.locale || 'bn';
      const summary = await WeeklySummary.findOne({ userId: req.userId, locale })
        .sort({ weekEndDate: -1 })
        .lean();

      if (!summary) {
        res.json({ summary: null, message: {
          en: 'No summary yet. Generate one or wait for Sunday.',
          bn: 'এখনও কোনো সারসংক্ষেপ নেই। একটি তৈরি করুন বা রবিবারের জন্য অপেক্ষা করুন।',
        } });
        return;
      }

      res.json({ summary });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/summaries/generate - manually trigger summary generation
  r.post('/generate', async (req, res, next) => {
    try {
      const enabled = await isEnabledFor('summaries.weekly', req.userId);
      if (!enabled) {
        throw new AppError(403, 'FEATURE_DISABLED', {
          en: 'Weekly summaries are not available yet.',
          bn: 'সাপ্তাহিক সারসংক্ষেপ এখনও পাওয়া যায় না।',
        });
      }

      const locale = req.user.locale || 'bn';
      const summary = await generateSummary({
        userId: req.userId,
        locale,
        timezone: req.user.timezone,
        config,
      });

      res.json({ summary });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
