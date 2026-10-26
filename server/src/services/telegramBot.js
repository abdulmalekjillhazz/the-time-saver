import { User } from '../models/User.js';
import { Routine } from '../models/Routine.js';
import { Completion } from '../models/Completion.js';
import { todayInZone } from '@smart-routine/shared';
import { logger } from '../lib/logger.js';
import { TelegramNotificationLog } from '../models/TelegramNotificationLog.js';

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const LOG_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

export async function sendTelegramMessage({ token, chatId, text, replyMarkup = null }) {
  if (!token || !chatId || !text) return null;

  const res = await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
    signal: AbortSignal.timeout(5000),
  });
  const result = await res.json();
  if (!res.ok || result?.ok !== true) {
    const err = new Error(`Telegram API rejected sendMessage (${res.status}).`);
    err.statusCode = res.status;
    throw err;
  }
  return result;
}

async function claimNotification({ userId, date, kind, routineId = null, now }) {
  try {
    await TelegramNotificationLog.create({
      userId,
      date,
      kind,
      routineId,
      sentAt: now,
      expiresAt: new Date(now.getTime() + LOG_RETENTION_MS),
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

function getLocalClock(timezone, now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${fields.year}-${fields.month}-${fields.day}`,
    minuteOfDay: Number(fields.hour) * 60 + Number(fields.minute),
  };
}

async function sendClaimed({ user, token, date, kind, routineId = null, now, text, replyMarkup }) {
  const claimed = await claimNotification({ userId: user._id, date, kind, routineId, now });
  if (!claimed) return false;
  try {
    const result = await sendTelegramMessage({ token, chatId: user.telegramChatId, text, replyMarkup });
    if (!result) throw new Error('Telegram message was not sent because bot credentials are unavailable.');
    return true;
  } catch (err) {
    await TelegramNotificationLog.deleteOne({ userId: user._id, date, kind, routineId });
    throw err;
  }
}

export async function runTelegramNotificationTick({ now = new Date(), token } = {}) {
  if (!token) return { sent: 0, failed: 0, skipped: 'bot-not-configured' };
  const users = await User.find({
    deletedAt: null,
    telegramNotifications: true,
    telegramChatId: { $type: 'string', $ne: '' },
  }).select('_id telegramChatId locale timezone').lean();
  const stats = { sent: 0, failed: 0 };

  for (const user of users) {
    try {
      const { date, minuteOfDay } = getLocalClock(user.timezone || 'Asia/Dhaka', now);
      const locale = user.locale === 'bn' ? 'bn' : 'en';
      const routines = await Routine.find({ userId: user._id }).sort({ startTime: 1 }).lean();

      if (minuteOfDay >= 360 && minuteOfDay < 365) {
        const list = routines.slice(0, 8).map((routine) =>
          `• <b>${escapeHtml(routine.title)}</b> (${routine.startTime})`
        ).join('\n');
        const text = locale === 'bn'
          ? `🌅 <b>সকালের রুটিন</b>\n${list || 'আজ কোনো রুটিন নির্ধারিত নেই।'}`
          : `🌅 <b>Morning routine</b>\n${list || 'No routines are scheduled yet.'}`;
        if (await sendClaimed({ user, token, date, kind: 'morning', now, text })) stats.sent += 1;
      }

      if (minuteOfDay >= 1260 && minuteOfDay < 1265) {
        const completions = await Completion.find({ userId: user._id, date }).select('status').lean();
        const done = completions.filter((completion) => completion.status === 'done').length;
        const text = locale === 'bn'
          ? `🌙 <b>সন্ধ্যার পর্যালোচনা</b>\nআজ ${done}টি রুটিন সম্পন্ন হয়েছে। আগামীকালের জন্য একটি ছোট প্রস্তুতি নিন।`
          : `🌙 <b>Evening check-in</b>\nYou completed ${done} routine(s) today. Choose one small preparation for tomorrow.`;
        if (await sendClaimed({ user, token, date, kind: 'evening', now, text })) stats.sent += 1;
      }

      for (const routine of routines) {
        const [hour, minute] = routine.startTime.split(':').map(Number);
        const dueAt = hour * 60 + minute;
        if (minuteOfDay < dueAt || minuteOfDay >= dueAt + 5) continue;
        const text = locale === 'bn'
          ? `⏰ <b>${escapeHtml(routine.title)}</b> রুটিনের সময় হয়েছে।`
          : `⏰ It is time for <b>${escapeHtml(routine.title)}</b>.`;
        const replyMarkup = {
          inline_keyboard: [[
            { text: locale === 'bn' ? '✅ সম্পন্ন' : '✅ Done', callback_data: `done_${routine._id}` },
            { text: locale === 'bn' ? '⚡ ৫ মিনিট' : '⚡ 5 minutes', callback_data: `micro_${routine._id}` },
          ]],
        };
        if (await sendClaimed({ user, token, date, kind: 'habit', routineId: routine._id, now, text, replyMarkup })) stats.sent += 1;
      }
    } catch (err) {
      stats.failed += 1;
      logger.warn({ userId: String(user._id), errName: err.name, statusCode: err.statusCode }, 'Telegram notification delivery failed');
    }
  }
  logger.info(stats, 'Telegram notification tick finished');
  return stats;
}

export async function handleTelegramWebhookUpdate({ update, token, config: _config }) {
  if (!update) return { ok: true };

  // Handle inline buttons (User clicked: "Done" or "5m")
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || '';
    const chatId = String(cb.message?.chat?.id || '');

    const user = await User.findOne({ telegramChatId: chatId, deletedAt: null });
    if (!user) {
      await sendTelegramMessage({
        token,
        chatId,
        text: '❌ আপনার অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে Smart Routine অ্যাপ সেটিংসে Telegram Chat ID লিঙ্ক করুন।',
      });
      return { ok: true };
    }

    const today = todayInZone(user.timezone || 'Asia/Dhaka');

    if (data.startsWith('done_')) {
      const routineId = data.replace('done_', '');
      const routine = await Routine.findById(routineId);
      if (routine) {
        await Completion.findOneAndUpdate(
          { userId: user._id, routineId, date: today },
          { status: 'done' },
          { upsert: true, new: true }
        );
        await sendTelegramMessage({
          token,
          chatId,
          text: `🎉 অভিনন্দন! <b>${routine.title}</b> রুটিনটি সম্পন্ন হয়েছে। আপনার স্ট্রিক অক্ষত রইল! 🔥`,
        });
      }
    } else if (data.startsWith('micro_')) {
      const routineId = data.replace('micro_', '');
      const routine = await Routine.findById(routineId);
      if (routine) {
        await Completion.findOneAndUpdate(
          { userId: user._id, routineId, date: today },
          { status: 'done', notes: '[5-min fallback via Telegram]' },
          { upsert: true, new: true }
        );
        await sendTelegramMessage({
          token,
          chatId,
          text: `⚡ দারুণ! <b>${routine.title}</b> রুটিনের ৫-মিনিটের বিকল্প সংস্করণ সম্পন্ন হয়েছে। স্ট্রিক বেঁচে গেল! 🛡️`,
        });
      }
    }

    return { ok: true };
  }

  // Handle /start or /today text commands
  const message = update.message;
  if (message && message.text) {
    const chatId = String(message.chat.id);
    const text = message.text.trim();

    if (text.startsWith('/start')) {
      await sendTelegramMessage({
        token,
        chatId,
        text: `👋 স্বাগতম <b>Smart Routine Habit Bot</b>-এ!\n\nআপনার টেলিগ্রাম চ্যাট আইডি হলো: <code>${chatId}</code>\n\nএই আইডিটি আপনার Smart Routine অ্যাপের Settings (🛡️) ট্যাবে <b>Telegram Chat ID</b> বক্সে পেস্ট করে সেভ করুন। এরপর প্রতিদিন সকালে আপনার আজকের রুটিন সরাসরি টেলিগ্রামে চলে আসবে! 🚀`,
      });
    } else if (text.startsWith('/today')) {
      const user = await User.findOne({ telegramChatId: chatId, deletedAt: null });
      if (!user) {
        await sendTelegramMessage({
          token,
          chatId,
          text: `আপনার চ্যাট আইডি: <code>${chatId}</code>\nঅনুগ্রহ করে অ্যাপ সেটিংসে এই আইডি যুক্ত করুন।`,
        });
        return { ok: true };
      }

      const routines = await Routine.find({ userId: user._id }).sort({ startTime: 1 }).lean();
      if (!routines.length) {
        await sendTelegramMessage({ token, chatId, text: 'আজকের কোনো রুটিন নির্ধারিত নেই।' });
        return { ok: true };
      }

      for (const r of routines.slice(0, 5)) {
        await sendTelegramMessage({
          token,
          chatId,
          text: `✦ <b>${r.title}</b> (${r.startTime} - ${r.endTime})\nক্যাটাগরি: ${r.category}`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ সম্পন্ন করলাম', callback_data: `done_${r._id}` },
                { text: '⚡ ৫-মি. সংস্করণ', callback_data: `micro_${r._id}` },
              ],
            ],
          },
        });
      }
    }
  }

  return { ok: true };
}
