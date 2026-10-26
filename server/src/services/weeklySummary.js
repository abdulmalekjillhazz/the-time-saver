import { addDays, todayInZone } from '@smart-routine/shared';
import { AppError } from '../lib/AppError.js';
import { askAI } from './aiProvider.js';
import { Routine } from '../models/Routine.js';
import { Completion } from '../models/Completion.js';
import { WeeklySummary } from '../models/WeeklySummary.js';
import { logger } from '../lib/logger.js';

const MSG = {
  en: {
    summaryError: 'The AI summary could not be generated. Please try again later.',
  },
  bn: {
    summaryError: 'AI সারসংক্ষেপ তৈরি করা যায়নি। পরে আবার চেষ্টা করুন।',
  },
};

// Returns the Sunday of the given date's week (Sunday is end of week).
export function getWeekEndDate(date) {
  const d = new Date(`${date}T00:00:00.000Z`);
  const day = d.getUTCDay();
  // If day is Sunday (0), this is already the week end. Otherwise subtract days until Sunday.
  const daysUntilSunday = day === 0 ? 0 : (7 - day);
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  return d.toISOString().slice(0, 10);
}

// Collects completion data for the 7 days ending on weekEndDate (inclusive).
async function getWeekCompletions(userId, weekEndDate) {
  const startDate = addDays(weekEndDate, -6);
  const completions = await Completion.find({
    userId,
    date: { $gte: startDate, $lte: weekEndDate },
  })
    .populate('routineId', 'title category startTime')
    .lean();

  const byDay = {};
  for (const c of completions) {
    if (!byDay[c.date]) byDay[c.date] = { done: 0, missed: 0, skipped: 0 };
    byDay[c.date][c.status] += 1;
  }

  return { completions, byDay, startDate, weekEndDate };
}

// Builds context about the week's habits for the AI prompt.
function buildWeekContext(weekData, routines) {
  const { completions, byDay } = weekData;
  let context = '';

  // Summary of completions per day
  const dates = Object.keys(byDay).sort();
  if (dates.length === 0) {
    context += 'No routines were tracked this week.\n\n';
  } else {
    context += 'Daily completion summary:\n';
    for (const date of dates) {
      const counts = byDay[date];
      const total = counts.done + counts.missed + counts.skipped;
      const rate = total > 0 ? Math.round((counts.done / total) * 100) : 0;
      context += `- ${date}: ${counts.done} done, ${counts.missed} missed, ${counts.skipped} skipped (${rate}%)\n`;
    }
    context += '\n';
  }

  // Routine list with completion rates for the week
  if (routines.length > 0) {
    context += 'Routine completion rates (this week):\n';
    const routineIds = new Set(completions.map((c) => String(c.routineId)));
    const routineStats = new Map();
    for (const c of completions) {
      const id = String(c.routineId);
      if (!routineStats.has(id)) routineStats.set(id, { done: 0, total: 0 });
      routineStats.get(id).total += 1;
      if (c.status === 'done') routineStats.get(id).done += 1;
    }
    for (const routine of routines) {
      const id = String(routine._id);
      if (routineIds.has(id)) {
        const stats = routineStats.get(id);
        const rate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
        context += `- ${routine.title} (${routine.startTime}): ${rate}% completed (${stats.done}/${stats.total})\n`;
      }
    }
  }

  return context;
}

// Generate a weekly summary using the AI provider.
export async function generateSummary({ userId, locale, timezone, config }) {
  const today = todayInZone(timezone);
  const weekEndDate = getWeekEndDate(today);

  // Check if summary already exists for this week
  const existing = await WeeklySummary.findOne({ userId, weekEndDate, locale }).lean();
  if (existing) {
    return existing;
  }

  const routines = await Routine.find({ userId }).select('title category startTime').lean();
  const weekData = await getWeekCompletions(userId, weekEndDate);
  const context = buildWeekContext(weekData, routines);

  const systemPrompt = locale === 'bn'
    ? `তুমি একজন রুটিন এবং অভ্যাস কোচ। ইউজারের গত সপ্তাহের রুটিন ডেটার ভিত্তিতে একটি সংক্ষিপ্ত সারসংক্ষেপ লেখো:
1. কোন অভ্যাসগুলো শক্তিশালী (৭০% এর বেশি সম্পন্ন) - এগুলোর প্রশংসা করো।
2. কোন অভ্যাসগুলো দুর্বল (৫০% এর নিচে সম্পন্ন) - কেন এমন হতে পারে তা অনুমান করো।
3. পরবর্তী সপ্তাহের জন্য একটি বাস্তবসম্মত পরামর্শ দাও (যেমন একটি রুটিনে ফোকাস করা, সময় সামঞ্জস্য করা)।
মোট ২০০-৩০০ শব্দ, বন্ধুত্বপূর্ণ টোনে বাংলায় লেখো।`
    : `You are a routine and habit coach. Write a brief summary based on the user's routine data from the past week:
1. Which habits are strong (over 70% completed) – celebrate these.
2. Which habits are weak (below 50% completed) – explore why.
3. One actionable suggestion for next week (focus on one routine, adjust timing, etc.).
Keep it 200-300 words, friendly tone, in English.`;

  const userPrompt = `Here is my routine data from ${weekData.startDate} to ${weekData.weekEndDate}:\n\n${context}`;

  try {
    const { text } = await askAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      config,
    });

    const summary = new WeeklySummary({
      userId,
      weekEndDate,
      locale,
      content: text,
    });

    await summary.save();
    return summary;
  } catch (err) {
    logger.error({ err, userId }, 'Failed to generate weekly summary');
    throw new AppError(502, 'SUMMARY_GENERATION_FAILED', MSG[locale] || MSG.en);
  }
}

// Check if a summary should be generated for this week (runs once per week per user).
export async function shouldGenerateWeeklySummary(userId, timezone) {
  const today = todayInZone(timezone);
  const weekEndDate = getWeekEndDate(today);

  // Only generate if today is Sunday or later (so we generate the summary after the week ends).
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const isSunday = todayDate.getUTCDay() === 0;

  if (!isSunday) return false;

  // Check if we already generated a summary for this week.
  const exists = await WeeklySummary.exists({ userId, weekEndDate });
  return !exists;
}
