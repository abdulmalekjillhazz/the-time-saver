import { Router } from 'express';
import { alarmClientIdSchema, alarmCreateSchema, alarmMissedQuerySchema, alarmUpdateSchema } from '@smart-routine/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { AppError, MSG } from '../lib/AppError.js';
import { Alarm } from '../models/Alarm.js';

const MINUTE = 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function toJSON(alarm) {
  return {
    clientId: alarm.clientId,
    at: alarm.at instanceof Date ? alarm.at.getTime() : alarm.at,
    name: alarm.name,
    timezone: alarm.timezone,
    firedAt: alarm.firedAt ? alarm.firedAt.getTime() : null,
    acknowledgedAt: alarm.acknowledgedAt ? alarm.acknowledgedAt.getTime() : null,
  };
}

function parseClientId(value) {
  const parsed = alarmClientIdSchema.safeParse(value);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
  return parsed.data;
}

export function alarmsRouter() {
  const r = Router();
  r.use(requireAuth);

  // Upsert by client id so a retried request (flaky mobile network) never duplicates.
  r.post(
    '/',
    rateLimit({ name: 'alarms-create', limit: 30, windowMs: MINUTE, by: 'user' }),
    validate({ body: alarmCreateSchema }),
    async (req, res, next) => {
      try {
        const { clientId, at, name, timezone } = req.body;
        const existing = await Alarm.findOne({ userId: req.userId, clientId }).lean();
        const alarm = await Alarm.findOneAndUpdate(
          { userId: req.userId, clientId },
          {
            $set: {
              at: new Date(at),
              name,
              timezone,
              cancelledAt: null,
              firedAt: null,
              acknowledgedAt: null,
              expiresAt: new Date(at + RETENTION_MS),
            },
          },
          { upsert: true, new: true }
        ).lean();
        res.status(existing ? 200 : 201).json({ alarm: toJSON(alarm) });
      } catch (err) {
        next(err);
      }
    }
  );

  // Plain list: upcoming plus unacknowledged fired (for catch-up).
  // ?missed=1: only fired, unacknowledged alarms, newest first.
  r.get(
    '/',
    rateLimit({ name: 'alarms-list', limit: 60, windowMs: MINUTE, by: 'user' }),
    validate({ query: alarmMissedQuerySchema }),
    async (req, res, next) => {
      try {
        const filter = { userId: req.userId, cancelledAt: null, acknowledgedAt: null };
        if (req.query.missed) filter.firedAt = { $ne: null };
        const alarms = await Alarm.find(filter)
          .sort(req.query.missed ? { firedAt: -1 } : { at: 1 })
          .limit(req.query.limit)
          .lean();
        res.json({ alarms: alarms.map(toJSON) });
      } catch (err) {
        next(err);
      }
    }
  );

  r.patch(
    '/:clientId',
    rateLimit({ name: 'alarms-update', limit: 30, windowMs: MINUTE, by: 'user' }),
    validate({ body: alarmUpdateSchema }),
    async (req, res, next) => {
      try {
        const clientId = parseClientId(req.params.clientId);
        const { at, name, acknowledged } = req.body;
        const update = {};
        if (at !== undefined) {
          update.at = new Date(at);
          update.expiresAt = new Date(at + RETENTION_MS);
          if (at > Date.now()) {
            // Re-armed for the future (snooze): ring again.
            update.firedAt = null;
            update.acknowledgedAt = null;
          }
        }
        if (name !== undefined) update.name = name;
        if (acknowledged !== undefined) update.acknowledgedAt = acknowledged ? new Date() : null;
        const alarm = await Alarm.findOneAndUpdate(
          { userId: req.userId, clientId, cancelledAt: null },
          { $set: update },
          { new: true }
        ).lean();
        if (!alarm) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
        res.json({ alarm: toJSON(alarm) });
      } catch (err) {
        next(err);
      }
    }
  );

  // The open app rang this alarm itself (voice played). Mark it fired so the
  // scheduler tick does not send a duplicate closed-app push.
  r.post(
    '/:clientId/fired',
    rateLimit({ name: 'alarms-fired', limit: 60, windowMs: MINUTE, by: 'user' }),
    async (req, res, next) => {
      try {
        const clientId = parseClientId(req.params.clientId);
        const alarm = await Alarm.findOneAndUpdate(
          { userId: req.userId, clientId, cancelledAt: null, firedAt: null },
          { $set: { firedAt: new Date() } },
          { new: true }
        ).lean();
        res.json({ alarm: alarm ? toJSON(alarm) : null, alreadyFired: !alarm });
      } catch (err) {
        next(err);
      }
    }
  );

  r.delete(
    '/:clientId',
    rateLimit({ name: 'alarms-delete', limit: 30, windowMs: MINUTE, by: 'user' }),
    async (req, res, next) => {
      try {
        const clientId = parseClientId(req.params.clientId);
        await Alarm.updateOne(
          { userId: req.userId, clientId, cancelledAt: null },
          { $set: { cancelledAt: new Date() } }
        );
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return r;
}
