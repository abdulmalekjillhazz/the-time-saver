import {
  addDays,
  badgeSchema,
  computeStreak,
  gamificationSummarySchema,
  todayInZone,
  userBadgeSchema,
} from '@smart-routine/shared';
import { Badge } from '../models/Badge.js';
import { Completion } from '../models/Completion.js';
import { DailyLesson } from '../models/DailyLesson.js';
import { DailyLessonRead } from '../models/DailyLessonRead.js';
import { DailyQuizScore } from '../models/DailyQuizScore.js';
import { LearningActivity } from '../models/LearningActivity.js';
import { Routine } from '../models/Routine.js';
import { StreakFreeze } from '../models/StreakFreeze.js';
import { User } from '../models/User.js';
import { UserBadge } from '../models/UserBadge.js';
import { AppError, MSG } from '../lib/AppError.js';
import { isEnabledFor } from './flags.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const STORY_POINTS = 50;
const QUIZ_POINTS = 30;

export function getQuizLearningPoints(score, total) {
  return total > 0 ? Math.round((QUIZ_POINTS * score) / total) : 0;
}

export function learningLevelForActiveDays(activeDays) {
  return Math.floor(Math.max(0, activeDays) / 3) + 1;
}

export function learningStreakForDates(activeDates, today) {
  return computeStreak([...new Set(activeDates)], today);
}

const BADGE_CATALOG = [
  {
    key: 'early-bird',
    name: { en: 'Early Bird', bn: 'প্রভাতী' },
    description: {
      en: 'Complete a morning routine before 7:00 AM on five consecutive days.',
      bn: 'টানা পাঁচ দিন সকাল ৭টার আগে সকালের রুটিন সম্পন্ন করুন।',
    },
  },
  {
    key: 'century-focus',
    name: { en: 'Century Focus', bn: 'শতকের সাধনা' },
    description: {
      en: 'Complete 100 routines.',
      bn: '১০০টি রুটিন সম্পন্ন করুন।',
    },
  },
  {
    key: 'quiz-master',
    name: { en: 'Quiz Master', bn: 'জ্ঞানসন্ধানী' },
    description: {
      en: 'Score 100% on seven different daily quizzes.',
      bn: 'সাতটি ভিন্ন দৈনিক কুইজে ১০০% নম্বর পান।',
    },
  },
  {
    key: 'consistent-learner',
    name: { en: 'Consistent Learner', bn: 'নিয়মিত পাঠক' },
    description: {
      en: 'Earn learning points on seven consecutive days.',
      bn: 'টানা সাত দিন শেখার পয়েন্ট অর্জন করুন।',
    },
  },
  {
    key: 'first-learning-day',
    name: { en: 'First Learning Day', bn: 'শেখার প্রথম দিন' },
    description: {
      en: 'Earn your first learning point from a story or quiz.',
      bn: 'গল্প পড়ে বা কুইজে প্রথম শেখার পয়েন্ট অর্জন করুন।',
    },
  },
].map((badge) => badgeSchema.parse(badge));

export async function ensureBadgeCatalog() {
  await Promise.all(BADGE_CATALOG.map(async (badge) => {
    try {
      await Badge.updateOne({ key: badge.key }, { $set: badge }, { upsert: true });
    } catch (err) {
      if (err.code !== 11000 || !(await Badge.exists({ key: badge.key }))) throw err;
    }
  }));
}

function consecutiveRun(dates) {
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const date of [...new Set(dates)].sort()) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  return longest;
}

function localClockParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

async function readUserProgress(userId, timezone) {
  const [completed, freezeDates, routines, perfectQuizzes, learningDates] = await Promise.all([
    Completion.find({ userId, status: 'done' }).select('date routineId createdAt updatedAt').lean(),
    StreakFreeze.distinct('date', { userId }),
    Routine.find({ userId }).select('_id startTime').lean(),
    DailyQuizScore.find({ userId, $expr: { $eq: ['$score', '$total'] } })
      .distinct('dailyLessonId'),
    LearningActivity.distinct('activeDate', { userId, points: { $gt: 0 } }),
  ]);

  const routineById = new Map(routines.map((routine) => [String(routine._id), routine]));
  const earlyBirdDates = completed.flatMap((completion) => {
    const routine = routineById.get(String(completion.routineId));
    if (!routine || routine.startTime >= '07:00') return [];
    const completedAt = completion.updatedAt || completion.createdAt;
    if (!completedAt) return [];
    const local = localClockParts(completedAt, timezone);
    return `${local.year}-${local.month}-${local.day}` === completion.date && Number(local.hour) < 7
      ? [completion.date]
      : [];
  });

  const doneDates = [...new Set(completed.map(({ date }) => date))];
  return {
    completedCount: completed.length,
    doneDates,
    freezeDates,
    earlyBirdDates,
    perfectQuizCount: new Set(perfectQuizzes.map(String)).size,
    learningDates,
  };
}

function evaluateBadges(progress) {
  const learningDays = new Set(progress.learningDates).size;
  const longestLearningStreak = consecutiveRun(progress.learningDates);
  return [
    consecutiveRun(progress.earlyBirdDates) >= 5 ? 'early-bird' : null,
    progress.completedCount >= 100 ? 'century-focus' : null,
    progress.perfectQuizCount >= 7 ? 'quiz-master' : null,
    longestLearningStreak >= 7 ? 'consistent-learner' : null,
    learningDays >= 1 ? 'first-learning-day' : null,
  ].filter(Boolean);
}

export async function evaluateAndAwardBadges(userId, timezone) {
  if (!(await isEnabledFor('gamification.badges', userId))) return [];
  await ensureBadgeCatalog();
  const progress = await readUserProgress(userId, timezone);
  const eligibleKeys = evaluateBadges(progress);
  if (!eligibleKeys.length) return [];

  const badgeDocs = await Badge.find({ key: { $in: eligibleKeys } }).lean();
  const newlyAwarded = [];
  for (const badge of badgeDocs) {
    try {
      const award = await UserBadge.create({ userId, badgeId: badge._id });
      newlyAwarded.push(userBadgeSchema.parse({
        id: String(award._id),
        badge: { key: badge.key, name: badge.name, description: badge.description },
        awardedAt: award.awardedAt.toISOString(),
      }));
    } catch (err) {
      if (err.code !== 11000 || !(await UserBadge.exists({ userId, badgeId: badge._id }))) throw err;
    }
  }
  return newlyAwarded;
}

export async function getGamificationSummary(userId, timezone) {
  await ensureBadgeCatalog();
  const [progress, newlyAwarded] = await Promise.all([
    readUserProgress(userId, timezone),
    evaluateAndAwardBadges(userId, timezone),
  ]);
  const [catalog, earned] = await Promise.all([
    Badge.find({}).sort({ key: 1 }).lean(),
    UserBadge.find({ userId }).lean(),
  ]);
  const earnedByBadge = new Map(earned.map((item) => [String(item.badgeId), item]));
  const today = todayInZone(timezone);
  const streakDates = [...new Set([...progress.doneDates, ...progress.freezeDates])];
  const weeklyFreeze = weekKey(today);
  const freezeUsedThisWeek = await StreakFreeze.exists({ userId, week: weeklyFreeze });
  const learningStreak = learningStreakForDates(progress.learningDates, today);

  return gamificationSummarySchema.parse({
    badges: catalog.map((badge) => {
      const award = earnedByBadge.get(String(badge._id));
      return {
        key: badge.key,
        name: badge.name,
        description: badge.description,
        earned: Boolean(award),
        awardedAt: award?.awardedAt?.toISOString() ?? null,
      };
    }),
    newlyAwarded,
    stats: {
      streak: computeStreak(streakDates, today),
      learningStreak,
      totalLearningDays: progress.learningDates.length,
      totalDaysLogged: progress.doneDates.length,
      totalRoutinesCompleted: progress.completedCount,
      streakFreezeAvailable: !freezeUsedThisWeek,
      streakFreezeDates: progress.freezeDates,
    },
  });
}

function weekKey(date) {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value - yearStart) / DAY_MS) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function applyStreakFreeze({ userId, date, timezone }) {
  const today = todayInZone(timezone);
  if (date !== today && date !== addDays(today, -1)) {
    throw new AppError(400, 'VALIDATION_FAILED', {
      en: 'A streak freeze can only protect today or yesterday.',
      bn: 'স্ট্রিক ফ্রিজ শুধু আজ বা গতকালের জন্য ব্যবহার করা যাবে।',
    });
  }
  if (await Completion.exists({ userId, date, status: 'done' })) {
    throw new AppError(409, 'CONFLICT', {
      en: 'This day already has a completed routine and does not need a freeze.',
      bn: 'এই দিনে রুটিন সম্পন্ন হয়েছে, তাই ফ্রিজের প্রয়োজন নেই।',
    });
  }

  try {
    const freeze = await StreakFreeze.create({ userId, date, week: weekKey(today) });
    return { date: freeze.date, week: freeze.week };
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError(409, 'CONFLICT', {
        en: 'You have already used this week’s streak freeze.',
        bn: 'এই সপ্তাহের স্ট্রিক ফ্রিজ আপনি ইতিমধ্যে ব্যবহার করেছেন।',
      });
    }
    throw err;
  }
}

export async function recordDailyLessonRead({ userId, dailyLessonId, timezone }) {
  if (!(await DailyLesson.exists({ _id: dailyLessonId }))) {
    throw new AppError(404, 'NOT_FOUND', MSG.notFound);
  }

  try {
    await DailyLessonRead.create({ userId, dailyLessonId });
  } catch (err) {
    if (err.code !== 11000 || !(await DailyLessonRead.exists({ userId, dailyLessonId }))) throw err;
  }

  const lesson = await DailyLesson.findById(dailyLessonId).select('date').lean();
  const activity = await recordLearningActivity({
    userId,
    activityType: 'story',
    contentId: `daily:${dailyLessonId}`,
    points: STORY_POINTS,
    timezone,
  });
  return { read: true, date: lesson.date, earnedPoints: activity.earnedPoints, awardedBadges: activity.awardedBadges };
}

export async function recordLearningActivity({ userId, activityType, contentId, points, timezone }) {
  if (points <= 0) return { earnedPoints: 0, recorded: false, awardedBadges: [] };
  const normalizedContentId = String(contentId);
  const activeDate = todayInZone(timezone || 'Asia/Dhaka');
  let recorded = true;
  try {
    await LearningActivity.create({
      userId,
      activityType,
      contentId: normalizedContentId,
      points,
      activeDate,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const existing = await LearningActivity.findOne({
      userId,
      activityType,
      contentId: normalizedContentId,
    }).select('_id points').lean();
    if (!existing) throw err;
    if (existing.points <= 0) {
      const upgraded = await LearningActivity.findOneAndUpdate(
        { _id: existing._id, points: { $lte: 0 } },
        { $set: { points, activeDate } },
        { new: true },
      );
      recorded = Boolean(upgraded);
    } else {
      recorded = false;
    }
  }
  const awardedBadges = await evaluateAndAwardBadges(userId, timezone);
  return { earnedPoints: recorded ? points : 0, recorded, awardedBadges };
}

export async function recordQuizPoints({ userId, quizId, score, total, timezone }) {
  const points = getQuizLearningPoints(score, total);
  return recordLearningActivity({
    userId,
    activityType: 'quiz',
    contentId: String(quizId),
    points,
    timezone,
  });
}

export async function getLearningLeaderboard() {
  const rows = await LearningActivity.aggregate([
    { $match: { points: { $gt: 0 } } },
    {
      $group: {
        _id: '$userId',
        points: { $sum: '$points' },
        activeDates: { $addToSet: '$activeDate' },
      },
    },
    { $match: { points: { $gt: 0 } } },
    {
      $lookup: {
        from: User.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'profile',
      },
    },
    { $unwind: '$profile' },
    { $match: { 'profile.deletedAt': null } },
    {
      $project: {
        _id: 0,
        userId: { $toString: '$_id' },
        name: '$profile.displayName',
        avatarId: '$profile.avatarId',
        points: 1,
        activeDays: { $size: '$activeDates' },
      },
    },
    { $sort: { points: -1, activeDays: -1, name: 1 } },
    { $limit: 100 },
  ]);
  const highestPoints = rows[0]?.points ?? 0;
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    level: learningLevelForActiveDays(row.activeDays),
    daysToNextLevel: 3 - (row.activeDays % 3),
    isKing: row.points === highestPoints,
  }));
}
