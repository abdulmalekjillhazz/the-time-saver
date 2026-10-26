import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AppError, MSG } from '../lib/AppError.js';
import { revokeAllForUser } from './session.js';

function escapeRegex(string) {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export async function listUsers({ search, limit = 50 } = {}) {
  const filter = { deletedAt: null };
  if (typeof search === 'string' && search.trim()) {
    const safeRegex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ email: safeRegex }, { displayName: safeRegex }];
  }
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .select('_id email displayName role isRestricted createdAt avatarUrl avatarId')
    .lean();

  return users.map((u) => ({
    id: String(u._id),
    email: u.email,
    displayName: u.displayName,
    role: u.role || 'user',
    isRestricted: Boolean(u.isRestricted),
    createdAt: u.createdAt,
    avatarUrl: u.avatarUrl,
    avatarId: u.avatarId,
  }));
}

export async function setRole(actor, targetId, role) {
  if (!mongoose.isValidObjectId(targetId)) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
  // Nobody can change their own role. This stops an owner from quietly removing their own oversight.
  if (String(actor._id) === String(targetId)) {
    throw new AppError(403, 'FORBIDDEN', { en: 'You cannot change your own role.', bn: 'নিজের ভূমিকা নিজে বদলাতে পারবেন না।' });
  }
  const target = await User.findOneAndUpdate(
    { _id: targetId, deletedAt: null },
    { $set: { role } },
    { new: true }
  ).lean();
  if (!target) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
  return target;
}

export async function restrictUser(actor, targetId, restricted = true) {
  if (!mongoose.isValidObjectId(targetId)) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
  if (String(actor._id) === String(targetId)) {
    throw new AppError(403, 'FORBIDDEN', {
      en: 'You cannot restrict your own account.',
      bn: 'নিজের অ্যাকাউন্ট সীমাবদ্ধ করতে পারবেন না।',
    });
  }
  const target = await User.findOneAndUpdate(
    { _id: targetId, deletedAt: null },
    { $set: { isRestricted: Boolean(restricted) } },
    { new: true }
  ).lean();
  if (!target) throw new AppError(404, 'NOT_FOUND', MSG.notFound);

  if (restricted) {
    await revokeAllForUser(targetId);
  }

  return target;
}

export async function deleteUser(actor, targetId) {
  if (!mongoose.isValidObjectId(targetId)) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
  if (String(actor._id) === String(targetId)) {
    throw new AppError(403, 'FORBIDDEN', {
      en: 'You cannot delete your own account.',
      bn: 'নিজের অ্যাকাউন্ট মুছতে পারবেন না।',
    });
  }
  const target = await User.findOneAndUpdate(
    { _id: targetId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: true }
  ).lean();
  if (!target) throw new AppError(404, 'NOT_FOUND', MSG.notFound);

  await revokeAllForUser(targetId);
  return target;
}
