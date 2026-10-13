import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { AppError } from '../lib/AppError.js';
import { Circle } from '../models/Circle.js';
import { User } from '../models/User.js';
import { Completion } from '../models/Completion.js';
import { todayInZone, computeStreak, addDays } from '@smart-routine/shared';

const MINUTE = 60 * 1000;

export function circlesRouter() {
  const r = Router();
  r.use(requireAuth);
  r.use(rateLimit({ name: 'circles', limit: 60, windowMs: MINUTE, by: 'user' }));

  r.get('/my', async (req, res, next) => {
    try {
      const today = todayInZone(req.user?.timezone || 'Asia/Dhaka');
      const circles = await Circle.find({ 'members.userId': req.userId }).lean();

      const populatedCircles = await Promise.all(
        circles.map(async (c) => {
          const memberUserIds = c.members.map((m) => m.userId);
          const users = await User.find({ _id: { $in: memberUserIds } }).select('displayName email locale').lean();

          const leaderboard = await Promise.all(
            users.map(async (u) => {
              const doneToday = await Completion.countDocuments({ userId: u._id, date: today, status: 'done' });
              const doneDates = await Completion.distinct('date', {
                userId: u._id,
                status: 'done',
                date: { $gte: addDays(today, -365),$lte: today },
              });
              const streak = computeStreak(doneDates, today).current || 0;

              return {
                id: u._id,
                name: u.displayName,
                doneToday,
                streak,
                isMe: String(u._id) === String(req.userId),
              };
            })
          );

          leaderboard.sort((a, b) => b.doneToday - a.doneToday || b.streak - a.streak);

          return {
            id: c._id,
            name: c.name,
            code: c.code,
            isOwner: String(c.ownerId) === String(req.userId),
            memberCount: c.members.length,
            leaderboard,
          };
        })
      );

      res.json({ circles: populatedCircles });
    } catch (err) {
      next(err);
    }
  });

  r.post('/', async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name) throw new AppError(400, 'VALIDATION_FAILED', { en: 'Circle name required', bn: 'সার্কেলের নাম প্রয়োজন' });

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const circle = await Circle.create({
        name,
        code,
        ownerId: req.userId,
        members: [{ userId: req.userId }],
      });

      res.status(201).json({ circle: { id: circle._id, name: circle.name, code: circle.code } });
    } catch (err) {
      next(err);
    }
  });

  r.post('/join', async (req, res, next) => {
    try {
      const code = String(req.body.code || '').trim().toUpperCase();
      const circle = await Circle.findOne({ code });
      if (!circle) {
        throw new AppError(404, 'NOT_FOUND', { en: 'Invalid circle invite code', bn: 'আমন্ত্রণ কোডটি সঠিক নয়' });
      }

      const alreadyMember = circle.members.some((m) => String(m.userId) === String(req.userId));
      if (!alreadyMember) {
        circle.members.push({ userId: req.userId });
        await circle.save();
      }

      res.json({ success: true, circleId: circle._id, name: circle.name });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
