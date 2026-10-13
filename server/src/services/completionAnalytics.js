import { addDays, todayInZone } from '@smart-routine/shared';
import { Completion } from '../models/Completion.js';
import { Routine } from '../models/Routine.js';

const INSIGHT_WINDOW_DAYS = 90;
const MAX_INSIGHT_ROUTINES = 20;

function dateRange(today, days) {
  const dates = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) dates.push(addDays(today, -offset));
  return dates;
}

function categoryKey(category) {
  return String(category || 'general').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'general';
}

export async function getCompletionHeatmap({ userId, timezone, days }) {
  const today = todayInZone(timezone);
  const dates = dateRange(today, days);
  const from = dates[0];
  const [completions, routines] = await Promise.all([
    Completion.find({ userId, status: 'done', date: { $gte: from, $lte: today } })
      .select('date routineId')
      .lean(),
    Routine.find({ userId }).select('_id category').lean(),
  ]);

  const categoryByRoutine = new Map(routines.map((routine) => [String(routine._id), categoryKey(routine.category)]));
  const byDate = new Map();
  for (const completion of completions) {
    if (!byDate.has(completion.date)) byDate.set(completion.date, { count: 0, categories: new Map() });
    const item = byDate.get(completion.date);
    const category = categoryByRoutine.get(String(completion.routineId)) || 'general';
    item.count += 1;
    item.categories.set(category, (item.categories.get(category) || 0) + 1);
  }

  return {
    from,
    to: today,
    days: dates.map((date) => {
      const item = byDate.get(date) || { count: 0, categories: new Map() };
      return {
        date,
        count: item.count,
        intensity: item.count === 0 ? 0 : item.count === 1 ? 1 : item.count <= 3 ? 2 : 3,
        categories: [...item.categories].map(([category, count]) => ({ category, count })),
      };
    }),
  };
}

export async function getCompletionInsights({ userId, timezone }) {
  const today = todayInZone(timezone);
  const dates = dateRange(today, INSIGHT_WINDOW_DAYS);
  const from = dates[0];
  const [completions, routines] = await Promise.all([
    Completion.find({ userId, status: 'done', date: { $gte: from, $lte: today } })
      .select('date routineId')
      .lean(),
    Routine.find({ userId }).select('_id title').lean(),
  ]);

  const routineById = new Map(routines.map((routine) => [String(routine._id), routine]));
  const doneByDate = new Map(dates.map((date) => [date, new Set()]));
  const totalsByRoutine = new Map();
  for (const completion of completions) {
    const id = String(completion.routineId);
    if (!routineById.has(id)) continue;
    doneByDate.get(completion.date)?.add(id);
    totalsByRoutine.set(id, (totalsByRoutine.get(id) || 0) + 1);
  }

  const candidates = [...totalsByRoutine.entries()]
    .filter(([, total]) => total >= 5)
    .sort((left, right) => right[1] - left[1])
    .slice(0, MAX_INSIGHT_ROUTINES)
    .map(([id]) => id);
  const insights = [];

  for (const sourceId of candidates) {
    const sourceDays = dates.filter((date) => doneByDate.get(date).has(sourceId));
    const otherDays = dates.length - sourceDays.length;
    if (sourceDays.length < 5 || otherDays < 5) continue;

    for (const targetId of candidates) {
      if (sourceId === targetId || (totalsByRoutine.get(targetId) || 0) < 5) continue;
      let targetDoneWithSource = 0;
      let targetDoneWithoutSource = 0;
      for (const date of dates) {
        const done = doneByDate.get(date).has(targetId);
        if (done && doneByDate.get(date).has(sourceId)) targetDoneWithSource += 1;
        else if (done) targetDoneWithoutSource += 1;
      }

      const withSourceRate = targetDoneWithSource / sourceDays.length;
      const withoutSourceRate = targetDoneWithoutSource / otherDays;
      const difference = Math.round((withSourceRate - withoutSourceRate) * 100);
      if (Math.abs(difference) < 15) continue;

      const sourceTitle = routineById.get(sourceId).title;
      const targetTitle = routineById.get(targetId).title;
      const directionEn = difference > 0 ? 'higher' : 'lower';
      const directionBn = difference > 0 ? 'বেশি' : 'কম';
      insights.push({
        sourceRoutine: sourceTitle,
        targetRoutine: targetTitle,
        differencePercentagePoints: difference,
        daysWithSource: sourceDays.length,
        message: {
          en: `In the last 90 days, you completed “${targetTitle}” at a rate ${Math.abs(difference)} percentage points ${directionEn} on days you completed “${sourceTitle}”. This is an association, not proof of cause.`,
          bn: `গত ৯০ দিনে “${sourceTitle}” সম্পন্ন করার দিনগুলোতে “${targetTitle}” সম্পন্নের হার ${Math.abs(difference)} শতাংশ-পয়েন্ট ${directionBn} ছিল। এটি একটি সম্পর্ক, কারণের প্রমাণ নয়।`,
        },
      });
    }
  }

  insights.sort((left, right) => Math.abs(right.differencePercentagePoints) - Math.abs(left.differencePercentagePoints));
  return { from, to: today, insights: insights.slice(0, 5) };
}
