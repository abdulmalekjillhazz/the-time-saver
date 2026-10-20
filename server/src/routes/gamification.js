import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { AppError } from '../lib/AppError.js';
import { Completion } from '../models/Completion.js';
import { EveningReflection } from '../models/EveningReflection.js';
import { getLearningLeaderboard } from '../services/gamification.js';
import { calculateGamificationStats } from '../services/gamificationStats.js';
import { todayInZone } from '@smart-routine/shared';

const MINUTE = 60 * 1000;

export function gamificationRouter() {
  const r = Router();
  r.use(requireAuth);
  r.use(rateLimit({ name: 'gamification', limit: 60, windowMs: MINUTE, by: 'user' }));

  r.get('/leaderboard', async (_req, res, next) => {
    try {
      res.json({ members: await getLearningLeaderboard() });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/gamification/stats - user XP, Level, Shields
  r.get('/stats', async (req, res, next) => {
    try {
      const totalDone = await Completion.countDocuments({ userId: req.userId, status: 'done' });
      const reflectionsCount = await EveningReflection.countDocuments({ userId: req.userId });
      
      res.json(calculateGamificationStats({ totalDone, reflectionsCount }));
    } catch (err) {
      next(err);
    }
  });

  // POST /api/gamification/reflection - save evening mood & debrief
  r.post('/reflection', async (req, res, next) => {
    try {
      const { mood, note, date } = req.body;
      if (!mood || !['happy', 'neutral', 'tired'].includes(mood)) {
        throw new AppError(400, 'VALIDATION_FAILED', { en: 'Invalid mood selection.', bn: 'মুড নির্বাচন সঠিক নয়।' });
      }

      const today = date || todayInZone(req.user?.timezone || 'Asia/Dhaka');
      // XP is awarded once per user/day. Editing the same reflection must not
      // claim another 30 XP when the dashboard derives XP from reflection count.
      const result = await EveningReflection.findOneAndUpdate(
        { userId: req.userId, date: today },
        { $set: { mood, note: note || '' } },
        { upsert: true, new: true, includeResultMetadata: true }
      );
      const reflection = result?.value ?? result;
      const earnedXP = result?.lastErrorObject?.upserted ? 30 : 0;

      res.status(earnedXP > 0 ? 201 : 200).json({ success: true, reflection, earnedXP });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
