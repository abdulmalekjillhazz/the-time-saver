import { Router } from 'express';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@smart-routine/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { AppError, MSG } from '../lib/AppError.js';
import { PushSubscription } from '../models/PushSubscription.js';

const MINUTE = 60 * 1000;
const subscriptionStatusSchema = pushUnsubscribeSchema;
const unavailable = () => new AppError(503, 'UNAVAILABLE', MSG.unavailable);

export function pushRouter(config) {
  const r = Router();

  // The public key is not secret. The browser needs it to subscribe. No login required.
  r.get('/public-key', (_req, res, next) => {
    if (!config.VAPID_PUBLIC_KEY) return next(unavailable());
    res.json({ publicKey: config.VAPID_PUBLIC_KEY });
  });

  r.use(requireAuth);

  r.get(
    '/subscriptions/preferences',
    rateLimit({ name: 'push-preferences', limit: 30, windowMs: MINUTE, by: 'user' }),
    validate({ query: subscriptionStatusSchema }),
    async (req, res, next) => {
      try {
        const subscription = await PushSubscription.findOne({
          endpoint: req.query.endpoint,
          userId: req.userId,
        }).lean();
        res.json({
          routineReminders: Boolean(subscription && subscription.routineReminders !== false),
          holidayReminders: subscription?.holidayReminders === true,
          alarmReminders: Boolean(!subscription || subscription.alarmReminders !== false),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post(
    '/subscriptions',
    rateLimit({ name: 'push-subscribe', limit: 10, windowMs: MINUTE, by: 'user' }),
    validate({ body: pushSubscribeSchema }),
    async (req, res, next) => {
      try {
        if (!config.VAPID_PUBLIC_KEY) throw unavailable();
        const { endpoint, keys, routineReminders, holidayReminders, alarmReminders } = req.body;
        const updates = { userId: req.userId, keys };
        if (routineReminders !== undefined) updates.routineReminders = routineReminders;
        if (holidayReminders !== undefined) updates.holidayReminders = holidayReminders;
        if (alarmReminders !== undefined) updates.alarmReminders = alarmReminders;
        const defaults = {};
        if (routineReminders === undefined) defaults.routineReminders = true;
        if (holidayReminders === undefined) defaults.holidayReminders = false;
        if (alarmReminders === undefined) defaults.alarmReminders = true;
        const update = { $set: { ...updates, failureCount: 0 } };
        if (Object.keys(defaults).length) update.$setOnInsert = defaults;
        await PushSubscription.findOneAndUpdate(
          { endpoint },
          update,
          { upsert: true }
        );
        res.status(201).json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  r.delete(
    '/subscriptions',
    validate({ body: pushUnsubscribeSchema }),
    async (req, res, next) => {
      try {
        await PushSubscription.deleteOne({ endpoint: req.body.endpoint, userId: req.userId });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return r;
}
