import { Router } from 'express';
import {
  completionSchema,
  heatmapQuerySchema,
  emptyQuerySchema,
  streakFreezeSchema,
  todayInZone,
  addDays,
  computeStreak,
} from '@smart-routine/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { AppError, MSG } from '../lib/AppError.js';
import { Routine } from '../models/Routine.js';
import { Completion } from '../models/Completion.js';
import { StreakFreeze } from '../models/StreakFreeze.js';
import { evaluateAndAwardBadges, applyStreakFreeze } from '../services/gamification.js';
import { getCompletionHeatmap, getCompletionInsights } from '../services/completionAnalytics.js';
import { isEnabledFor } from '../services/flags.js';

const MINUTE = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getIsoWeek(date) {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value - yearStart) / DAY_MS) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function completionsRouter() {
  const r = Router();
  r.use(requireAuth);
  r.use(rateLimit({ name: 'completions', limit: 120, windowMs: MINUTE, by: 'user' }));

  // Per-day done/missed/skipped counts for the last N days, for the dashboard graph.
  r.get('/summary', async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
      const today = todayInZone(req.user.timezone);
      const from = new Date(`${today}T00:00:00.000Z`);
      from.setUTCDate(from.getUTCDate() - (days - 1));
      const fromDate = from.toISOString().slice(0, 10);

      const rows = await Completion.find({ userId: req.userId, date: { $gte: fromDate, $lte: today } })
        .select('date status')
        .lean();

      const byDate = new Map();
      for (const row of rows) {
        if (!byDate.has(row.date)) byDate.set(row.date, { done: 0, missed: 0, skipped: 0 });
        byDate.get(row.date)[row.status] += 1;
      }

      const summary = [];
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(`${today}T00:00:00.000Z`);
        d.setUTCDate(d.getUTCDate() - i);
        const date = d.toISOString().slice(0, 10);
        const counts = byDate.get(date) ?? { done: 0, missed: 0, skipped: 0 };
        const total = counts.done + counts.missed + counts.skipped;
        summary.push({ date, ...counts, total, rate: total ? Math.round((counts.done / total) * 100) : null });
      }
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  });

  r.get('/heatmap', validate({ query: heatmapQuerySchema }), async (req, res, next) => {
    try {
      const result = await getCompletionHeatmap({
        userId: req.userId,
        timezone: req.user.timezone,
        days: req.query.days,
      });
      const heatmap = result.days.map((day) => ({
        date: day.date,
        count: day.count,
        level: day.count >= 4 ? 4 : day.count,
      }));
      res.json({ ...result, heatmap });
    } catch (err) {
      next(err);
    }
  });

  r.get('/insights', validate({ query: emptyQuerySchema }), async (req, res, next) => {
    try {
      if (!(await isEnabledFor('analytics.insights', req.userId))) {
        throw new AppError(403, 'FEATURE_DISABLED', {
          en: 'Completion insights are not available for you yet.',
          bn: 'এখন আপনার জন্য কাজ সম্পন্নের বিশ্লেষণ চালু হয়নি।',
        });
      }
      res.json(await getCompletionInsights({ userId: req.userId, timezone: req.user.timezone }));
    } catch (err) {
      next(err);
    }
  });

  r.post('/streak-freeze', validate({ body: streakFreezeSchema }), async (req, res, next) => {
    try {
      if (!(await isEnabledFor('gamification.badges', req.userId))) {
        throw new AppError(403, 'FEATURE_DISABLED', {
          en: 'Streak protection is not available for you yet.',
          bn: 'এখন আপনার জন্য স্ট্রিক সুরক্ষা চালু হয়নি।',
        });
      }
      const freeze = await applyStreakFreeze({
        userId: req.userId,
        date: req.body.date,
        timezone: req.user.timezone,
      });
      res.status(201).json({ freeze });
    } catch (err) {
      next(err);
    }
  });

  // Current and best streak of days with at least one completed routine or an applied freeze.
  r.get('/streak', async (req, res, next) => {
    try {
      const today = todayInZone(req.user.timezone);
      const freezesEnabled = await isEnabledFor('gamification.badges', req.userId);
      const [doneDates, freezeDates] = await Promise.all([
        Completion.distinct('date', { userId: req.userId, status: 'done', date: { $lte: today } }),
        freezesEnabled ? StreakFreeze.distinct('date', { userId: req.userId, date: { $lte: today } }) : [],
      ]);
      res.json({
        streak: computeStreak([...doneDates, ...freezeDates], today),
        totalDaysLogged: doneDates.length,
        streakFreezeAvailable: freezesEnabled
          ? !(await StreakFreeze.exists({ userId: req.userId, week: getIsoWeek(today) }))
          : false,
        streakFreezeDates: freezeDates,
      });
    } catch (err) {
      next(err);
    }
  });
  // GET /api/completions/badges - Habit milestone badges & achievements
  r.get('/badges', async (req, res, next) => {
    try {
      const today = todayInZone(req.user.timezone);
      const totalDone = await Completion.countDocuments({ userId: req.userId, status: 'done' });
      const doneDates = await Completion.distinct('date', {
        userId: req.userId,
        status: 'done',
        date: { $gte: addDays(today, -365),$lte: today },
      });
      const streakInfo = computeStreak(doneDates, today);
      const currentStreak = streakInfo.current || 0;

      const badges = [
        {
          id: 'early_bird',
          icon: '🌅',
          title: { bn: 'প্রভাতী সাধক', en: 'Early Bird' },
          desc: { bn: 'সকালের রুটিন সম্পন্ন করা', en: 'Completed morning routine' },
          unlocked: totalDone >= 5,
          progress: Math.min(Math.round((totalDone / 5) * 100), 100),
        },
        {
          id: 'streak_7',
          icon: '🔥',
          title: { bn: 'সপ্তপদ ধারা', en: '7-Day Streak' },
          desc: { bn: 'টানা ৭ দিনের অভ্যাস স্ট্রিক', en: 'Maintained 7 consecutive days' },
          unlocked: currentStreak >= 7,
          progress: Math.min(Math.round((currentStreak / 7) * 100), 100),
        },
        {
          id: 'iron_will',
          icon: '🛡️',
          title: { bn: 'অটল সংকল্প', en: 'Iron Will' },
          desc: { bn: '৩০টি রুটিন সম্পন্ন করা', en: 'Completed 30 total routines' },
          unlocked: totalDone >= 30,
          progress: Math.min(Math.round((totalDone / 30) * 100), 100),
        },
        {
          id: 'century',
          icon: '🏆',
          title: { bn: 'শতকের সাধনা', en: 'Century Club' },
          desc: { bn: '১০০টি রুটিন সম্পন্ন করা', en: 'Completed 100 total routines' },
          unlocked: totalDone >= 100,
          progress: Math.min(Math.round((totalDone / 100) * 100), 100),
        },
      ];

      res.json({ badges, totalCompleted: totalDone, currentStreak });
    } catch (err) {
      next(err);
    }
  });

  // PUT is idempotent: sending the same status twice leaves one row.
  r.put('/', validate({ body: completionSchema }), async (req, res, next) => {
    try {
      const { routineId, date, status, fallbackUsed } = req.body;

      // "Today" is judged in the user's timezone, not the server's.
      if (date > todayInZone(req.user.timezone)) {
        throw new AppError(400, 'VALIDATION_FAILED', MSG.futureDate, [{ path: 'date', message: 'future date' }]);
      }

      const routine = await Routine.findOne({ _id: routineId, userId: req.userId }).select('fallbackDuration').lean();
      if (!routine) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
      if (fallbackUsed) {
        if (status !== 'done' || routine.fallbackDuration === null || routine.fallbackDuration === undefined) {
          throw new AppError(400, 'VALIDATION_FAILED', {
            en: 'A short routine version can only be used to complete a routine that has one configured.',
            bn: 'শুধু নির্ধারিত ছোট সংস্করণ থাকা রুটিন সম্পন্ন করতেই এটি ব্যবহার করা যাবে।',
          });
        }
        if (!(await isEnabledFor('routines.microfallbacks', req.userId))) {
          throw new AppError(403, 'FEATURE_DISABLED', {
            en: 'Short routine versions are not available for you yet.',
            bn: 'এখন আপনার জন্য ছোট রুটিনের সংস্করণ চালু হয়নি।',
          });
        }
      }

      try {
        await Completion.findOneAndUpdate(
          { userId: req.userId, routineId, date },
          { $set: { status, fallbackUsed } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (err) {
        if (err.code === 11000) {
          // Concurrent upsert raced. Update the existing record.
          await Completion.findOneAndUpdate(
            { userId: req.userId, routineId, date },
            { $set: { status, fallbackUsed } },
            { new: true }
          );
        } else {
          throw err;
        }
      }
      const awardedBadges = status === 'done'
        ? await evaluateAndAwardBadges(req.userId, req.user.timezone)
        : [];
      res.json({ completion: { routineId, date, status, fallbackUsed }, awardedBadges });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
