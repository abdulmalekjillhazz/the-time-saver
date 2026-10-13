import { Routine } from '../models/Routine.js';
import { Completion } from '../models/Completion.js';
import { AppError } from '../lib/AppError.js';
import { askAI } from './aiProvider.js';
import { todayInZone } from '@smart-routine/shared';

export async function generateAdaptiveReplan({ routineId, userId, lang = 'bn', timezone = 'Asia/Dhaka', config }) {
  const routine = await Routine.findOne({ _id: routineId, userId }).lean();
  if (!routine) {
    throw new AppError(404, 'NOT_FOUND', { en: 'Routine not found.', bn: 'রুটিন পাওয়া যায়নি।' });
  }

  const today = todayInZone(timezone);
  const recentCompletions = await Completion.find({
    userId,
    routineId,
  }).sort({ date: -1 }).limit(7).lean();

  const missedCount = recentCompletions.filter((c) => c.status === 'missed').length;
  const doneCount = recentCompletions.filter((c) => c.status === 'done').length;

  const promptSystem = lang === 'bn'
    ? `তুমি Smart Routine অ্যাপের একজন সহমর্মী হ্যাবিট কোচ। ব্যবহারকারী তার "${routine.title}" (${routine.startTime}-${routine.endTime}) রুটিনটি সম্পূর্ণ করার সময় পাচ্ছে না বা ক্লান্ত।
তাকে অপরাধবোধে না ফেলে অভ্যাস বাঁচিয়ে রাখার জন্য ৩টি জিনিস দাও:
1. "microAction": সর্বোচ্চ ৫ মিনিটের একটি ক্ষুদ্র ও সহজ সংস্করণ যা সে এখনই করতে পারে (যেমন: ৩০ মিনিট জিমের বদলে ৫ মিনিট স্ট্রেচিং বা পুশআপ)।
2. "rescheduleTime": রুটিনটি আজ বা আগামীকাল অন্য কোন সময়ে শিফট করা যেতে পারে (HH:MM ফরম্যাট) এবং তার ১ বাক্যের কারণ।
3. "coachTip": ১-২ বাক্যের উষ্ণ উৎসাহমূলক কথা।

শুধুমাত্র নিচের JSON ফরম্যাটে উত্তর দাও (কোনো অতিরিক্ত টেক্সট ছাড়া):
{"microAction": "৫ মিনিটের সুনির্দিষ্ট কাজের বিবরণ", "rescheduleTime": "HH:MM", "rescheduleReason": "কারণ", "coachTip": "উৎসাহমূলক টিপ"}`
    : `You are an empathetic habit coach for the Smart Routine app. The user is too busy or tired to complete their "${routine.title}" (${routine.startTime}-${routine.endTime}) routine.
Prevent habit collapse by providing:
1. "microAction": A tiny 5-minute fallback version they can do immediately (e.g. 5 min stretching instead of 30 min gym).
2. "rescheduleTime": A realistic alternative time (HH:MM format) and 1 sentence reason.
3. "coachTip": A 1-2 sentence warm encouraging tip.

Return ONLY a JSON object:
{"microAction": "5-minute fallback action", "rescheduleTime": "HH:MM", "rescheduleReason": "reason", "coachTip": "encouraging tip"}`;

  const userContext = `Routine: ${routine.title}, Category: ${routine.category}, Original: ${routine.startTime}-${routine.endTime}, Recent 7 days: ${doneCount} done, ${missedCount} missed.`;

  const { text } = await askAI({
    messages: [
      { role: 'system', content: promptSystem },
      { role: 'user', content: userContext },
    ],
    config,
    maxTokens: 500,
    temperature: 0.5,
  });

  const cleaned = text?.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      microAction: lang === 'bn' ? 'মাত্র ৫ মিনিট সময় নিয়ে সবচেয়ে সহজ ধাপটি সম্পন্ন করুন।' : 'Take just 5 minutes to complete the easiest step.',
      rescheduleTime: routine.startTime,
      rescheduleReason: lang === 'bn' ? 'সময় পরিবর্তন করে অভ্যাস চালু রাখুন।' : 'Reschedule to keep your streak alive.',
      coachTip: lang === 'bn' ? 'পুরোপুরি না পারলেও ৫ মিনিট করা শূন্যের চেয়ে অনেক ভালো!' : 'Doing 5 minutes is 100% better than doing nothing!',
    };
  }

  return {
    routineId: routine._id,
    routineTitle: routine.title,
    ...parsed,
  };
}

export async function completeMicroRoutine({ routineId, userId, date, microNotes = '', timezone = 'Asia/Dhaka' }) {
  const routine = await Routine.findOne({ _id: routineId, userId });
  if (!routine) {
    throw new AppError(404, 'NOT_FOUND', { en: 'Routine not found.', bn: 'রুটিন পাওয়া যায়নি।' });
  }

  const targetDate = date || todayInZone(timezone);

  const completion = await Completion.findOneAndUpdate(
    { routineId: routine._id, date: targetDate, userId },
    {
      status: 'done',
      notes: microNotes ? `[5-min fallback] ${microNotes}` : '[5-min fallback version completed]',
    },
    { upsert: true, new: true }
  );

  return {
    success: true,
    routineTitle: routine.title,
    date: targetDate,
    status: completion.status,
  };
}
