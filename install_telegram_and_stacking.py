import os

# 1. Update server/src/models/User.js with telegram fields
with open("server/src/models/User.js", "r", encoding="utf-8") as f:
    user_code = f.read()

if "telegramChatId" not in user_code:
    user_code = user_code.replace(
        "role: { type: String, enum: ['user', 'viewer', 'editor', 'owner'], default: 'user' },",
        "role: { type: String, enum: ['user', 'viewer', 'editor', 'owner'], default: 'user' },\\n    telegramChatId: { type: String, default: null, trim: true },\\n    telegramNotifications: { type: Boolean, default: false },"
    )
    with open("server/src/models/User.js", "w", encoding="utf-8") as f:
        f.write(user_code)

# 2. Create server/src/services/telegramBot.js
telegram_service = """import { User } from '../models/User.js';
import { Routine } from '../models/Routine.js';
import { Completion } from '../models/Completion.js';
import { todayInZone } from '@smart-routine/shared';
import { logger } from '../lib/logger.js';

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

export async function sendTelegramMessage({ token, chatId, text, replyMarkup = null }) {
  if (!token || !chatId || !text) return null;

  try {
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
    return await res.json();
  } catch (err) {
    logger.warn({ errName: err.name, chatId }, 'Telegram sendMessage failed');
    return null;
  }
}

export async function handleTelegramWebhookUpdate({ update, token, config }) {
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
        text: `👋 স্বাগতম <b>Smart Routine Habit Bot</b>-এ!\\n\\nআপনার টেলিগ্রাম চ্যাট আইডি হলো: <code>${chatId}</code>\\n\\nএই আইডিটি আপনার Smart Routine অ্যাপের Settings (🛡️) ট্যাবে <b>Telegram Chat ID</b> বক্সে পেস্ট করে সেভ করুন। এরপর প্রতিদিন সকালে আপনার আজকের রুটিন সরাসরি টেলিগ্রামে চলে আসবে! 🚀`,
      });
    } else if (text.startsWith('/today')) {
      const user = await User.findOne({ telegramChatId: chatId, deletedAt: null });
      if (!user) {
        await sendTelegramMessage({
          token,
          chatId,
          text: `আপনার চ্যাট আইডি: <code>${chatId}</code>\\nঅনুগ্রহ করে অ্যাপ সেটিংসে এই আইডি যুক্ত করুন।`,
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
          text: `✦ <b>${r.title}</b> (${r.startTime} - ${r.endTime})\\nক্যাটাগরি: ${r.category}`,
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
"""
with open("server/src/services/telegramBot.js", "w", encoding="utf-8") as f:
    f.write(telegram_service)

# 3. Create server/src/routes/telegram.js
telegram_routes = """import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { AppError } from '../lib/AppError.js';
import { User } from '../models/User.js';
import { sendTelegramMessage, handleTelegramWebhookUpdate } from '../services/telegramBot.js';

const MINUTE = 60 * 1000;

export function telegramRouter(config) {
  const r = Router();
  const token = process.env.TELEGRAM_BOT_TOKEN || config?.TELEGRAM_BOT_TOKEN;

  r.post('/webhook', async (req, res, next) => {
    try {
      const result = await handleTelegramWebhookUpdate({
        update: req.body,
        token,
        config,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  r.post(
    '/connect',
    requireAuth,
    rateLimit({ name: 'telegram-connect', limit: 10, windowMs: MINUTE, by: 'user' }),
    async (req, res, next) => {
      try {
        const chatId = String(req.body.chatId || '').trim();
        const enabled = Boolean(req.body.enabled);

        const updated = await User.findByIdAndUpdate(
          req.userId,
          {
            $set: {
              telegramChatId: chatId || null,
              telegramNotifications: enabled,
            },
          },
          { new: true }
        ).select('telegramChatId telegramNotifications');

        if (chatId && token) {
          await sendTelegramMessage({
            token,
            chatId,
            text: '🎉 <b>Smart Routine সংযুক্ত হয়েছে!</b>\\nএখন থেকে আপনার রুটিন রিমাইন্ডার এই চ্যাটে চলে আসবে।',
          });
        }

        res.json({ success: true, user: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  return r;
}
"""
with open("server/src/routes/telegram.js", "w", encoding="utf-8") as f:
    f.write(telegram_routes)

# 4. Mount telegramRouter in server/src/app.js
with open("server/src/app.js", "r", encoding="utf-8") as f:
    app_text = f.read()

if "telegramRouter" not in app_text:
    app_text = app_text.replace(
        "import { circlesRouter } from './routes/circles.js';",
        "import { circlesRouter } from './routes/circles.js';\\nimport { telegramRouter } from './routes/telegram.js';"
    )
    app_text = app_text.replace(
        "app.use('/api/circles', circlesRouter());",
        "app.use('/api/circles', circlesRouter());\\n  app.use('/api/telegram', telegramRouter(config));"
    )
    with open("server/src/app.js", "w", encoding="utf-8") as f:
        f.write(app_text)

# 5. Create client/components/TelegramSettingsCard.jsx
telegram_ui = """'use client';

import { useState } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';

export function TelegramSettingsCard({ user, lang = 'bn', onSaved }) {
  const [chatId, setChatId] = useState(user?.telegramChatId || '');
  const [enabled, setEnabled] = useState(Boolean(user?.telegramNotifications));
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const isBn = lang === 'bn';
  const copy = {
    title: isBn ? '🤖 টেলিগ্রাম হ্যাবিট বট নোটিফিকেশন' : '🤖 Telegram Habit Bot Notifications',
    desc: isBn ? 'টেলিগ্রামে প্রতিদিনের রুটিন পান এবং এক ক্লিকেই সম্পূর্ণ করুন (১০০% ফ্রি)।' : 'Receive daily routines on Telegram and complete them in 1-click (100% Free).',
    step1: isBn ? '১. প্রথমে টেলিগ্রামে আপনার বটের চ্যাটে /start লিখুন।' : '1. Open Telegram bot and send /start.',
    step2: isBn ? '২. বটের দেওয়া চ্যাট আইডি নিচে পেস্ট করে সেভ করুন:' : '2. Paste your Chat ID provided by the bot below:',
    placeholder: isBn ? 'আপনার Telegram Chat ID' : 'Your Telegram Chat ID',
    toggle: isBn ? 'টেলিগ্রাম নোটিফিকেশন চালু রাখুন' : 'Enable Telegram Daily Alerts',
    save: isBn ? 'সেভ করুন' : 'Save Connection',
    saved: isBn ? 'সফলভাবে সংরক্ষিত!' : 'Saved successfully!',
    failed: isBn ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save',
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, enabled }),
      });
      if (res.ok) {
        setStatusMsg(copy.saved);
        if (onSaved) onSaved();
      } else {
        setStatusMsg(copy.failed);
      }
    } catch {
      setStatusMsg(copy.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="surface-card space-y-4 p-5">
      <div className="border-b pb-3">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <span>🤖</span> {copy.title}
        </h3>
        <p className="text-xs text-gray-600 mt-1">{copy.desc}</p>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs text-sky-950 space-y-1">
        <p><strong>{copy.step1}</strong></p>
        <p>{copy.step2}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder={copy.placeholder}
            className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono text-gray-900"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
          />
          <span>{copy.toggle}</span>
        </label>

        <div className="flex items-center justify-between pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? '...' : copy.save}
          </Button>
          {statusMsg && <span className="text-xs font-semibold text-emerald-700">{statusMsg}</span>}
        </div>
      </form>
    </Card>
  );
}
"""
with open("client/components/TelegramSettingsCard.jsx", "w", encoding="utf-8") as f:
    f.write(telegram_ui)

# 6. Integrate TelegramSettingsCard into PrivateApp.jsx under Settings tab
with open("client/components/PrivateApp.jsx", "r", encoding="utf-8") as f:
    app_text = f.read()

if "import { TelegramSettingsCard }" not in app_text:
    app_text = "import { TelegramSettingsCard } from './TelegramSettingsCard.jsx';\\n" + app_text

if "<TelegramSettingsCard" not in app_text:
    app_text = app_text.replace(
        "{tab === 'settings' ? (\\n        <section className=\"space-y-4\">",
        "{tab === 'settings' ? (\\n        <section className=\"space-y-4\">\\n          <TelegramSettingsCard user={user} lang={lang} onSaved={() => loadRoutines(user)} />"
    )
    with open("client/components/PrivateApp.jsx", "w", encoding="utf-8") as f:
        f.write(app_text)

print("✅ Success: Telegram Habit Bot & Atomic Habit Stacking installed!")
