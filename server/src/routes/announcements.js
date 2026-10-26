import { Router } from 'express';
import { Announcement } from '../models/Announcement.js';

export function announcementsRouter() {
  const r = Router();
  r.get('/latest', async (_req, res, next) => {
    try {
      const since = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const announcement = await Announcement.findOne({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .lean();
      if (!announcement) return res.json({ announcement: null });
      res.json({
        announcement: {
          id: String(announcement._id),
          title: announcement.title,
          body: announcement.body,
          url: announcement.url,
          createdAt: announcement.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });
  return r;
}

