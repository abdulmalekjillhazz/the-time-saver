import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { getBangladeshPublicHolidays } from '../services/holidays.js';
import { fetchPrayerTimings } from '../services/prayerTimes.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';

const yearSchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100),
}).strict();

const prayerLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  date: z.string().regex(/^\d{2}-\d{2}-\d{4}$/).optional(),
}).strict();

export function calendarRouter() {
  const r = Router();
  r.get(
    '/holidays',
    rateLimit({ name: 'calendar-holidays', limit: 30, windowMs: 60 * 1000, by: 'ip' }),
    validate({ query: yearSchema }),
    (req, res) => {
      res.json({ year: req.query.year, holidays: getBangladeshPublicHolidays(req.query.year) });
    }
  );

  r.get(
    '/prayers',
    rateLimit({ name: 'calendar-prayers', limit: 60, windowMs: 60 * 1000, by: 'ip' }),
    validate({ query: prayerLocationSchema }),
    async (req, res, next) => {
      try {
        const { timings, timezone } = await fetchPrayerTimings(req.query.latitude, req.query.longitude, req.query.date);
        res.json({
          timings,
          timezone,
          method: 'Karachi',
          school: 'Hanafi',
          source: 'Aladhan API (device coordinates, Karachi method)',
        });
      } catch (err) {
        logger.warn({ errName: err.name, message: err.message }, 'could not load device-location prayer timings');
        next(new AppError(503, 'UPSTREAM_UNAVAILABLE', {
          en: 'Accurate prayer times are temporarily unavailable. Please try again later.',
          bn: 'আপনার অবস্থানের সঠিক নামাজের সময় এখন পাওয়া যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।',
        }));
      }
    }
  );

  return r;
}
