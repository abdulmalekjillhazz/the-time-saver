import { Router } from 'express';
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
            text: '🎉 <b>Smart Routine সংযুক্ত হয়েছে!</b>\nএখন থেকে আপনার রুটিন রিমাইন্ডার এই চ্যাটে চলে আসবে।',
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
