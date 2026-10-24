'use client';

import { useState } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { apiRequest } from '../lib/apiClient.js';

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
    step2: isBn ? '২. বটের দেওয়া চ্যাট আইডি নিচে পেস্ট করে সেভ করুন:' : '2. Paste your Chat ID provided by the bot below:',
    placeholder: isBn ? 'আপনার Telegram Chat ID' : 'Your Telegram Chat ID',
    toggle: isBn ? 'টেলিগ্রাম নোটিফিকেশন চালু রাখুন' : 'Enable Telegram Daily Alerts',
    save: isBn ? 'সেভ করুন' : 'Save Connection',
    saved: isBn ? 'সফলভাবে সংরক্ষিত!' : 'Saved successfully!',
    failed: isBn ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save',
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    try {
      const result = await apiRequest('/api/telegram/connect', {
        method: 'POST',
        body: { chatId, enabled },
      });
      setStatusMsg(copy.saved);
      onSaved?.(result.user);
    } catch (error) {
      console.error('Failed to save Telegram settings.', error);
      setStatusMsg(copy.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="surface-card glass-panel glow-border space-y-4 p-5">
      <div className="border-b border-gold/20 pb-3">
        <h3 className="section-heading text-base flex items-center gap-2">
          <span>🤖</span> {copy.title}
        </h3>
        <p className="mt-1 text-sm text-ink/85">{copy.desc}</p>
      </div>

      <div className="rounded-xl border border-sapphire/30 bg-sapphire/10 p-3 text-xs text-ink space-y-1">
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
            className="w-full rounded-xl border border-gold/25 bg-paper/70 p-2.5 text-sm font-mono text-ink placeholder:text-ink/40 outline-none focus:border-gold/70 focus:ring-2 focus:ring-gold/30"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-ink/90">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gold/40 accent-sapphire"
          />
          <span>{copy.toggle}</span>
        </label>

        <div className="flex items-center justify-between pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? '...' : copy.save}
          </Button>
          {statusMsg && <span className="text-xs font-semibold text-sapphire">{statusMsg}</span>}
        </div>
      </form>
    </Card>
  );
}
