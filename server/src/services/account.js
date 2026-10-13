import { User } from '../models/User.js';
import { Routine } from '../models/Routine.js';
import { Completion } from '../models/Completion.js';
import { AppError, MSG } from '../lib/AppError.js';
import { hashPassword, verifyPassword, burnPasswordTime } from '../lib/password.js';
import { sha256 } from '../lib/crypto.js';
import { hitCounter, currentCount } from './rateLimit.js';
import { revokeAllForUser } from './session.js';
import { toPublicUser, toRoutineDto } from './dto.js';

const FIFTEEN_MIN = 15 * 60 * 1000;
const ACCOUNT_LOGIN_LIMIT = 5;

export async function registerUser({ email, password, displayName, locale, timezone }) {
  if (await User.exists({ email })) {
    throw new AppError(409, 'CONFLICT', MSG.emailTaken);
  }
  const passwordHash = await hashPassword(password);
  try {
    return await User.create({ email, passwordHash, displayName, locale, timezone });
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'CONFLICT', MSG.emailTaken);
    throw err;
  }
}

export async function loginUser({ email, password }) {
  // Per-account limit. The key holds a hash of the email, never the email itself.
  const key = `login-account:${sha256(email)}`;
  if ((await currentCount(key, FIFTEEN_MIN)) >= ACCOUNT_LOGIN_LIMIT) {
    throw new AppError(429, 'RATE_LIMITED', MSG.rateLimited);
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  let ok = false;
  if (user?.passwordHash) {
    ok = await verifyPassword(user.passwordHash, password);
  } else {
    await burnPasswordTime(password);
  }

  if (!user || !ok || user.deletedAt) {
    await hitCounter(key, FIFTEEN_MIN);
    throw new AppError(401, 'UNAUTHENTICATED', MSG.loginFailed);
  }
  return user;
}

export async function loginGoogleUser({ email, googleId, displayName, avatarUrl }) {
  const findLinkedAccount = () => User.findOne({ $or: [{ googleId }, { email }] }).select('+googleId');
  let safeAvatarUrl = null;
  if (typeof avatarUrl === 'string') {
    try {
      const parsed = new URL(avatarUrl);
      if (parsed.protocol === 'https:' && (parsed.hostname === 'googleusercontent.com' || parsed.hostname.endsWith('.googleusercontent.com'))) {
        safeAvatarUrl = parsed.href.slice(0, 2048);
      }
    } catch {
      safeAvatarUrl = null;
    }
  }
  let user = await findLinkedAccount();
  if (user) {
    if (user.deletedAt || (user.googleId && user.googleId !== googleId)) {
      throw new AppError(401, 'UNAUTHENTICATED', MSG.loginFailed);
    }
    if (!user.googleId) {
      user.googleId = googleId;
    }
    if (safeAvatarUrl) user.avatarUrl = safeAvatarUrl;
    if (user.isModified()) await user.save();
    return user;
  }

  try {
    return await User.create({
      email,
      googleId,
      displayName,
      avatarUrl: safeAvatarUrl,
      locale: 'bn',
      timezone: 'Asia/Dhaka',
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    user = await findLinkedAccount();
    if (!user || user.deletedAt || (user.googleId && user.googleId !== googleId)) {
      throw new AppError(401, 'UNAUTHENTICATED', MSG.loginFailed);
    }
    if (!user.googleId) {
      user.googleId = googleId;
    }
    if (safeAvatarUrl) user.avatarUrl = safeAvatarUrl;
    if (user.isModified()) await user.save();
    return user;
  }
}

export async function requirePassword(userId, password) {
  const user = await User.findById(userId).select('+passwordHash');
  const ok = user && (await verifyPassword(user.passwordHash, password));
  if (!ok) throw new AppError(403, 'FORBIDDEN', MSG.wrongPassword);
}

export async function exportAccount(user) {
  const [routines, completions] = await Promise.all([
    Routine.find({ userId: user._id }).sort({ startTime: 1 }).lean(),
    Completion.find({ userId: user._id }).sort({ date: 1 }).lean(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: toPublicUser(user),
    routines: routines.map(toRoutineDto),
    completions: completions.map((c) => ({
      routineId: String(c.routineId),
      date: c.date,
      status: c.status,
      fallbackUsed: Boolean(c.fallbackUsed),
    })),
  };
}

// Phase 1 marks the account deleted and revokes every session.
// Permanent purge of data after 30 days is a Phase 7 job (see docs/PHASE1.md).
export async function deleteAccount(userId) {
  await User.updateOne({ _id: userId }, { $set: { deletedAt: new Date() } });
  await revokeAllForUser(userId);
}
