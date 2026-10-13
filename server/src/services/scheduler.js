import { generateDailyLesson } from './dailyLesson.js';
import { findDueReminders, todayInZone } from '@smart-routine/shared';
import { PushSubscription } from '../models/PushSubscription.js';
import { ReminderLog } from '../models/ReminderLog.js';
import { HolidayNotificationLog } from '../models/HolidayNotificationLog.js';
import { Routine } from '../models/Routine.js';
import { Completion } from '../models/Completion.js';
import { User } from '../models/User.js';
import { DailyLesson } from '../models/DailyLesson.js';
import { Quiz } from '../models/Quiz.js';
import { acquireLease } from './lease.js';
import { isEnabledFor } from './flags.js';
import { sendToUser, defaultSender } from './push.js';
import { sendTelegramMessage } from './telegramBot.js';
import { Alarm } from '../models/Alarm.js';
import { randomToken } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { runAutomaticTraining } from './autoTraining.js';
import { formatHolidayReminderReason, getBangladeshDayOff, getHolidayNotificationSlot } from './holidays.js';
import { shouldGenerateWeeklySummary, generateSummary } from './weeklySummary.js';
import { runTelegramNotificationTick } from './telegramBot.js';
import { IslamicReflection } from '../models/IslamicReflection.js';
import { generateDailyIslamicReflection } from './islamicReflections.js';

const LEASE_NAME = 'reminders';
const LEASE_MS = 55 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_LOG_DAYS = 7;
const TRAINING_LEASE_MS = 24 * 60 * 60 * 1000;
const HOLIDAY_NOTIFICATION_LOG_DAYS = 400;
const DAILY_LESSON_LEASE_MS = 5 * 60 * 1000;
const ISLAMIC_REFLECTION_LEASE_MS = 5 * 60 * 1000;

// Routine names are private; explain the trigger without disclosing routine content.
export function routineReminderPayload(locale) {
  return locale === 'bn'
    ? {
      title: 'রুটিন শুরু হচ্ছে',
      body: 'কারণ: আপনি রুটিন রিমাইন্ডার চালু করেছেন এবং একটি রুটিনের নির্ধারিত শুরুর সময় হয়েছে।',
      url: '/app',
    }
    : {
      title: 'Routine starting soon',
      body: 'Reason: you enabled routine reminders, and a routine has reached its scheduled start time.',
      url: '/app',
    };
}

// One tick: check every user with a push subscription and send any reminders that are due.
export async function runReminderTick({ now = new Date(), owner, sender = defaultSender } = {}) {
  const leased = await acquireLease(LEASE_NAME, owner, LEASE_MS, now);
  if (!leased) return { skipped: 'lease-held', sent: 0, suppressed: 0, failed: 0 };

  const stats = { sent: 0, suppressed: 0, failed: 0 };
  const userIds = await PushSubscription.distinct('userId');

  for (const userId of userIds) {
    const user = await User.findById(userId).lean();
    if (!user || user.deletedAt) continue;

    if (!(await isEnabledFor('push.reminders', userId))) continue;
    await sendDueHolidayNotification({ user, userId, now, sender, stats });
    const routines = await Routine.find({ userId }).lean();
    if (routines.length === 0) continue;

    const dates = [todayInZone(user.timezone, now), todayInZone(user.timezone, new Date(now.getTime() - DAY_MS))];
    const completions = await Completion.find({ userId, date: { $in: dates } }).lean();
    const completedByDate = new Map();
    for (const c of completions) {
      if (!completedByDate.has(c.date)) completedByDate.set(c.date, new Set());
      completedByDate.get(c.date).add(String(c.routineId));
    }

    const due = findDueReminders({
      routines: routines.map((r) => ({ id: String(r._id), startTime: r.startTime })),
      completedByDate,
      now,
      timezone: user.timezone,
    });

    for (const reminder of due) {
      // Claim first. If another tick already claimed it, skip. This prevents duplicate sends.
      const claimed = await claimReminder(userId, reminder);
      if (!claimed) {
        stats.suppressed += 1;
        continue;
      }
      const { delivered } = await sendToUser(
        userId,
        routineReminderPayload(user.locale === 'bn' ? 'bn' : 'en'),
        sender,
        'routineReminders',
      );
      if (delivered > 0) stats.sent += 1;
      else stats.failed += 1;
    }
  }

  logger.info({ ...stats }, 'reminder tick finished');
  return stats;
}

async function sendDueHolidayNotification({ user, userId, now, sender, stats }) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: user.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const local = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const slot = getHolidayNotificationSlot(
    `${local.year}-${local.month}-${local.day}`,
    Number(local.hour),
    Number(local.minute),
  );
  if (!slot) return;

  const { date, kind } = slot;
  const locale = user.locale === 'bn' ? 'bn' : 'en';
  const summary = getBangladeshDayOff(date, locale);
  if (!summary) return;

  try {
    await HolidayNotificationLog.create({
      userId,
      date,
      kind,
      sentAt: now,
      expiresAt: new Date(now.getTime() + HOLIDAY_NOTIFICATION_LOG_DAYS * DAY_MS),
    });
  } catch (err) {
    if (err.code === 11000) {
      stats.suppressed += 1;
      return;
    }
    throw err;
  }

  const payload = {
    title: locale === 'bn'
      ? (kind === 'eve' ? 'আগামীকাল ছুটির দিন' : 'আজ ছুটির দিন')
      : (kind === 'eve' ? 'Tomorrow is a day off' : 'Today is a day off'),
    body: formatHolidayReminderReason(summary, locale),
    url: '/app',
    tag: `smart-routine-holiday-${date}-${kind}`,
  };
  const { delivered } = await sendToUser(userId, payload, sender, 'holidayReminders');
  if (delivered > 0) stats.sent += 1;
  else stats.failed += 1;
}
// Closed-app alarms: due one-shot alarms fire here (push + Telegram) even
// when the browser is closed. The open app reports its own voice alarms via
// POST /api/alarms/:id/fired, so this tick skips them (firedAt already set).
export function alarmPushPayload({ name, nextRoutineTitle, locale, clientId }) {
  const bn = locale === 'bn';
  const saidName = String(name || '').trim();
  const next = String(nextRoutineTitle || '').trim();
  const body = bn
    ? `${saidName ? `${saidName} — ` : ''}এখন সময় হয়েছে।${next ? ` পরের রুটিন: ${next}।` : ''}`
    : `${saidName ? `${saidName} — ` : ''}time is up.${next ? ` Next routine: ${next}.` : ''}`;
  return {
    title: bn ? '🔔 আপনার অ্যালার্ম বাজছে' : '🔔 Your alarm is ringing',
    body,
    url: '/app',
    tag: `smart-routine-alarm-${clientId}`,
    requireInteraction: true,
    snoozeUrl: `/app?snooze=${encodeURIComponent(clientId)}`,
    actions: [
      { action: 'open', title: bn ? 'অ্যাপ খুলুন' : 'Open app' },
      { action: 'snooze', title: bn ? '⏰ ৫ মিনিট পরে' : '⏰ Snooze 5 min' },
    ],
  };
}

function userMinuteOfDay(timezone, now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return Number(fields.hour) * 60 + Number(fields.minute);
}

export async function runAlarmTick({ now = new Date(), owner, sender = defaultSender, telegramToken } = {}) {
  const leased = await acquireLease('alarms', owner, LEASE_MS, now);
  if (!leased) return { skipped: 'lease-held', sent: 0, suppressed: 0, failed: 0 };

  const stats = { sent: 0, suppressed: 0, failed: 0 };
  const dueIds = await Alarm.distinct('_id', { firedAt: null, cancelledAt: null, at: { $lte: now } });

  for (const alarmId of dueIds) {
    // Atomic claim: only the winner (firedAt was still null) sends.
    const alarm = await Alarm.findOneAndUpdate(
      { _id: alarmId, firedAt: null, cancelledAt: null },
      { $set: { firedAt: now } },
      { new: true }
    ).lean();
    if (!alarm) {
      stats.suppressed += 1;
      continue;
    }
    try {
      const user = await User.findById(alarm.userId).lean();
      if (!user || user.deletedAt) {
        stats.suppressed += 1;
        continue;
      }
      if (!(await isEnabledFor('push.alarms', String(user._id)))) {
        stats.suppressed += 1;
        continue;
      }
      const locale = user.locale === 'bn' ? 'bn' : 'en';
      const minuteOfDay = userMinuteOfDay(user.timezone, now);
      const routines = await Routine.find({ userId: user._id }).sort({ startTime: 1 }).lean();
      const upcoming = routines.find((routine) => {
        const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(routine.startTime || '');
        return match && Number(match[1]) * 60 + Number(match[2]) >= minuteOfDay;
      });
      const payload = alarmPushPayload({
        name: alarm.name,
        nextRoutineTitle: upcoming?.title,
        locale,
        clientId: alarm.clientId,
      });
      const { delivered } = await sendToUser(String(user._id), payload, sender, 'alarmReminders');
      if (user.telegramNotifications && user.telegramChatId && telegramToken) {
        try {
          await sendTelegramMessage({
            token: telegramToken,
            chatId: user.telegramChatId,
            text: locale === 'bn'
              ? `🔔 <b>আপনার অ্যালার্ম বাজছে</b>\n${payload.body}`
              : `🔔 <b>Your alarm is ringing</b>\n${payload.body}`,
          });
        } catch (err) {
          logger.warn({ userId: String(user._id), errName: err.name }, 'alarm Telegram delivery failed');
        }
      }
      if (delivered > 0) stats.sent += 1;
      else stats.failed += 1;
    } catch (err) {
      stats.failed += 1;
      logger.warn({ alarmId: String(alarmId), errName: err.name }, 'alarm tick delivery failed');
    }
  }

  logger.info({ ...stats }, 'alarm tick finished');
  return stats;
}

// Trade-off: a reminder is claimed before sending, so a failed send is not retried.
// For reminders, a missed one is better than a duplicate.
async function claimReminder(userId, { routineId, date, kind }) {
  try {
    await ReminderLog.create({
      userId,
      routineId,
      date,
      kind,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + REMINDER_LOG_DAYS * DAY_MS),
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

// Starts a tick every minute. Returns a function that stops it.
export function startScheduler({ intervalMs = 60 * 1000, enableReminders = true, trainingSecret, config } = {}) {
  const owner = `${process.pid}-${randomToken(8)}`;
  const timer = setInterval(() => {
    if (enableReminders) {
      runReminderTick({ owner }).catch((err) => logger.error({ errName: err.name }, 'reminder tick failed'));
      runAlarmTick({ owner, telegramToken: config?.TELEGRAM_BOT_TOKEN }).catch((err) => logger.error({ errName: err.name }, 'alarm tick failed'));
    }
    if (trainingSecret) {
      const trainingOwner = `${owner}-train-${randomToken(8)}`;
      acquireLease('model-training', trainingOwner, TRAINING_LEASE_MS)
        .then((leased) => leased ? runAutomaticTraining(trainingSecret) : null)
        .then((result) => {
          if (result) logger.info(result, 'automatic model training finished');
        })
        .catch((err) => {
          const fields = { errName: err.name, code: err.code };
          if (err.code === 'TRAINING_REFUSED') fields.reason = err.message;
          logger.warn(fields, 'automatic model training did not produce a model');
        });
    }
    if (config) {
      runDailyLessonGeneration({ config, owner }).catch((err) => {
        logger.warn({ errName: err.name, code: err.code }, 'daily AI lesson generation failed');
      });
    }
    if (config?.GEMINI_API_KEY) {
      runWeeklySummaryGeneration({ config, owner }).catch((err) => {
        logger.warn({ errName: err.name, code: err.code }, 'weekly summary generation failed');
      });
      runDailyIslamicReflectionGeneration({ config, owner }).catch((err) => {
        logger.warn({ errName: err.name, code: err.code }, 'daily Islamic reflection generation failed');
      });
    }
    if (config?.TELEGRAM_BOT_TOKEN) {
      runTelegramNotificationTick({ now: new Date(), token: config.TELEGRAM_BOT_TOKEN }).catch((err) => {
        logger.warn({ errName: err.name, code: err.code }, 'Telegram notification tick failed');
      });
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

async function runDailyIslamicReflectionGeneration({ config, owner }) {
  const now = new Date();
  const date = todayInZone('Asia/Dhaka', now);
  const existingLocales = await IslamicReflection.distinct('locale', { date });
  if (existingLocales.includes('bn') && existingLocales.includes('en')) return;

  const generationOwner = `${owner}-islamic-reflection-${randomToken(8)}`;
  const leased = await acquireLease('daily-islamic-reflection-generation-v1', generationOwner, ISLAMIC_REFLECTION_LEASE_MS, now);
  if (!leased) return;

  let generated = 0;
  let failed = 0;
  for (const locale of ['bn', 'en']) {
    if (existingLocales.includes(locale)) continue;
    try {
      await generateDailyIslamicReflection({ date, locale, config });
      generated += 1;
    } catch (err) {
      failed += 1;
      logger.warn({ locale, errName: err.name, code: err.code }, 'daily Islamic reflection generation failed for locale');
    }
  }

  logger.info({ date, generated, failed }, 'daily Islamic reflection generation batch completed');
}

async function runDailyLessonGeneration({ config, owner }) {
  const now = new Date();
  const date = todayInZone('Asia/Dhaka', now);
  const generationOwner = `${owner}-daily-lesson-${randomToken(8)}`;
  if (await hasDailyLessonsAndQuizzes(date)) return;

  const leased = await acquireLease('daily-ai-lesson-generation-v3', generationOwner, DAILY_LESSON_LEASE_MS, now);
  if (!leased) return;
  if (await hasDailyLessonsAndQuizzes(date)) return;
  let generated = 0;
  let failed = 0;

  for (const locale of ['bn', 'en']) {
    try {
      await generateDailyLesson({ date, locale, config });
      generated += 1;
    } catch (err) {
      failed += 1;
      logger.warn({ locale, errName: err.name, code: err.code }, 'daily AI lesson generation failed for locale');
    }
  }

  logger.info({ date, generated, failed }, 'daily AI lesson generation batch completed');
}

async function hasDailyLessonsAndQuizzes(date) {
  const lessons = await DailyLesson.find({ date, locale: { $in: ['bn', 'en'] } }).select('_id locale').lean();
  if (lessons.length !== 2) return false;
  const quizLessonIds = await Quiz.distinct('dailyLessonId', { dailyLessonId: { $in: lessons.map((lesson) => lesson._id) } });
  return quizLessonIds.length === 2;
}

async function runWeeklySummaryGeneration({ config, owner }) {
  const WEEKLY_SUMMARY_LEASE_MS = 24 * 60 * 60 * 1000;
  const leased = await acquireLease('weekly-summary', owner, WEEKLY_SUMMARY_LEASE_MS);
  if (!leased) return;

  const users = await User.find({ deletedAt: null }).select('_id locale timezone').lean();
  let generated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const shouldGenerate = await shouldGenerateWeeklySummary(user._id, user.timezone);
      if (!shouldGenerate) continue;

      // Check if summary generation is enabled for this user
      const enabled = await isEnabledFor('summaries.weekly', user._id);
      if (!enabled) continue;

      await generateSummary({
        userId: user._id,
        locale: user.locale || 'bn',
        timezone: user.timezone,
        config,
      });
      generated += 1;
    } catch (err) {
      failed += 1;
      logger.warn({ userId: user._id, errName: err.name }, 'weekly summary generation failed for user');
    }
  }

  logger.info({ generated, failed }, 'weekly summary batch completed');
}
