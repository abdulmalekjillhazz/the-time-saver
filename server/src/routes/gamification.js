import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { AppError } from '../lib/AppError.js';
import { Completion } from '../models/Completion.js';
import { EveningReflection } from '../models/EveningReflection.js';
import { getLearningLeaderboard } from '../services/gamification.js';
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
      
      const totalXP = (totalDone * 50) + (reflectionsCount * 30);
      const level = Math.floor(totalXP / 200) + 1;
      const currentLevelXP = totalXP % 200;
      const streakShields = Math.max(1, 3 - Math.floor(totalDone / 50));

      const titles = [
        { en: 'Habit Initiate', bn: 'নবাগত সাধক' },
        { en: 'Steadfast Learner', bn: 'অটল শিক্ষার্থী' },
        { en: 'Discipline Warrior', bn: 'সংকল্পের যোদ্ধা' },
        { en: 'Routine Master', bn: 'অভ্যাসগুরু' },
        { en: 'Grand Achiever', bn: 'মহাজ্ঞানী সাধক' },
      ];
      const title = titles[Math.min(level - 1, titles.length - 1)];

      res.json({
        xp: totalXP,
        level,
        currentLevelXP,
        nextLevelXP: 200,
        streakShields,
        title,
      });
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
      const reflection = await EveningReflection.findOneAndUpdate(
        { userId: req.userId, date: today },
        { mood, note: note || '' },
        { upsert: true, new: true }
      );

      res.status(201).json({ success: true, reflection, earnedXP: 30 });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
