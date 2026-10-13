import { AppError } from '../lib/AppError.js';
import { askAI, failed } from './aiProvider.js';

function routinesContext(routines) {
  if (!Array.isArray(routines) || !routines.length) return 'No routines yet.';
  return routines.slice(0, 30).map((r) => {
    const status = r.completionStatus ?? 'pending';
    const risk = typeof r.probability === 'number' ? `, miss-risk ${Math.round(r.probability * 100)}%` : '';
    const frog = r.isFrog ? ', FROG (most important task)' : '';
    return `- ${r.title} (${r.startTime}-${r.endTime}, ${status}${risk}${frog})`;
  }).join('\n');
}

// Free-form Q&A about the app and the user's own routines.
export async function answerQuestion({ question, lang, routines, config }) {
  const system = lang === 'bn'
    ? `তুমি Smart Routine অ্যাপের AM's রুটিন সহকারী — একজন রুটিন ও হ্যাবিট কোচ। শুধু রুটিন তৈরি, সময় ব্যবস্থাপনা, অভ্যাস গঠন, "Eat That Frog" (সবচেয়ে কঠিন/গুরুত্বপূর্ণ কাজ আগে করা) আর 80/20 নিয়ম (যে ২০% কাজ ৮০% ফলাফল দেয় সেটায় ফোকাস করা) নিয়ে ইউজারের নিচে দেওয়া রুটিন ডেটার ভিত্তিতে সংক্ষিপ্ত, বাস্তবসম্মত পরামর্শ দাও। চিকিৎসা, আইনি বা জরুরি পরামর্শ দিও না। সংক্ষেপে বাংলায় উত্তর দাও।\n\nইউজারের আজকের রুটিন:\n${routinesContext(routines)}`
    : `You are AM's Routine Assistant — a routine and habit coach for the Smart Routine app. Help only with routine planning, time management, habit formation, "Eat That Frog" (doing the hardest/most important task first), and the 80/20 rule (focus on the 20% of tasks that drive 80% of results) using the user's routine data below. No medical, legal, or emergency advice. Keep it short.\n\nUser's routines today:\n${routinesContext(routines)}`;

  const { text } = await askAI({ messages: [{ role: 'system', content: system }, { role: 'user', content: String(question).slice(0, 2000) }], config });
  return text;
}

// Turns a free-text goal into a small set of routine items, picking one "frog" task.
export async function generateRoutineDraft({ intent, lang, config }) {
  const instructions = lang === 'bn'
    ? `তুমি একজন প্রোডাক্টিভিটি কোচ। ইউজারের লক্ষ্য পড়ে ৪ থেকে ৮টা দৈনিক রুটিন আইটেম বানাও। নিয়ম:\n1) "Eat That Frog" নীতি মেনে সবচেয়ে কঠিন/গুরুত্বপূর্ণ কাজটা সকালের দিকে রাখো আর "isFrog": true দাও (শুধু একটায়)।\n2) 80/20 নিয়ম মেনে যে কাজগুলো সবচেয়ে বেশি ফলাফল দেয় সেগুলোকে priority "high" দাও, বাকিদের "medium"/"low"।\n3) সময়গুলো একে অপরের সাথে ওভারল্যাপ করবে না, বাস্তবসম্মত সময় দাও (HH:MM, 24-ঘণ্টা ফরম্যাট)।\nশুধু নিচের JSON array ফরম্যাটে উত্তর দাও, অন্য কোনো টেক্সট ছাড়া:\n[{"title": string, "startTime": "HH:MM", "endTime": "HH:MM", "priority": "high"|"medium"|"low", "isFrog": boolean, "category": string}]`
    : `You are a productivity coach. Read the user's goal and build 4 to 8 daily routine items. Rules:\n1) Follow "Eat That Frog": the single hardest/most important task goes early in the day and gets "isFrog": true (only one item).\n2) Follow the 80/20 rule: tasks that drive the most results get priority "high", others "medium"/"low".\n3) Times must not overlap, use realistic HH:MM (24-hour) times.\nReply with ONLY a JSON array in this exact shape, no other text:\n[{"title": string, "startTime": "HH:MM", "endTime": "HH:MM", "priority": "high"|"medium"|"low", "isFrog": boolean, "category": string}]`;

  const { text } = await askAI({
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: String(intent).slice(0, 1000) },
    ],
    config,
  });

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let drafts;
  try {
    drafts = JSON.parse(cleaned);
  } catch {
    throw failed();
  }
  if (!Array.isArray(drafts) || !drafts.length) throw failed();

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const clean = drafts
    .filter((d) => d && typeof d.title === 'string' && timePattern.test(d.startTime) && timePattern.test(d.endTime))
    .slice(0, 8)
    .map((d) => ({
      title: String(d.title).slice(0, 120),
      startTime: d.startTime,
      endTime: d.endTime,
      priority: ['high', 'medium', 'low'].includes(d.priority) ? d.priority : 'medium',
      isFrog: Boolean(d.isFrog),
      category: typeof d.category === 'string' ? d.category.slice(0, 40) : 'general',
    }));

  if (!clean.length) throw failed();
  // Only one frog, even if the model gave more than one.
  let frogSeen = false;
  for (const item of clean) {
    if (item.isFrog && frogSeen) item.isFrog = false;
    if (item.isFrog) frogSeen = true;
  }
  return clean;
}

export { AppError };
