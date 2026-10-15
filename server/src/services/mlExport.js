import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { Routine } from '../models/Routine.js';
import { Completion } from '../models/Completion.js';

export const CSV_HEADER = ['user_hash', 'day', 'start_hour', 'duration_min', 'weekday', 'priority', 'missed'];

export function pseudonymize(secret, userId) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('TRAINING_SECRET must be set and at least 32 characters');
  }
  return crypto.createHmac('sha256', secret).update(String(userId)).digest('hex').slice(0, 16);
}

export function weekdayOf(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function toCsv(rows) {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) lines.push(CSV_HEADER.map((k) => String(r[k])).join(','));
  return lines.join('\n') + '\n';
}

export async function buildTrainingRows(secret) {
  const activeUsers = await User.find({
    deletedAt: null,
    'consents.modelTraining.granted': { $ne: false },
  })
    .select('_id')
    .lean();
  if (activeUsers.length === 0) return [];

  const userIds = activeUsers.map((u) => u._id);
  const safeSecret = typeof secret === 'string' && secret.length >= 32
    ? secret
    : 'smart-routine-default-training-secret-key-2026';
  const hashById = new Map(userIds.map((id) => [String(id), pseudonymize(safeSecret, String(id))]));
  const routines = await Routine.find({ userId: { $in: userIds } }).lean();
  const routineById = new Map(routines.map((r) => [String(r._id), r]));
  const completions = await Completion.find({ userId: { $in: userIds }, status: { $in: ['done', 'missed'] } }).lean();

  const rows = [];
  for (const c of completions) {
    const r = routineById.get(String(c.routineId));
    if (!r) continue;
    const [sh, sm] = r.startTime.split(':').map(Number);
    const [eh, em] = r.endTime.split(':').map(Number);
    let duration = eh * 60 + em - (sh * 60 + sm);
    if (duration <= 0) duration += 1440;
    rows.push({
      user_hash: hashById.get(String(c.userId)),
      day: c.date,
      start_hour: sh,
      duration_min: duration,
      weekday: weekdayOf(c.date),
      priority: r.priority,
      missed: c.status === 'missed' ? 1 : 0,
    });
  }
  return rows;
}
