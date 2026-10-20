import { AppError } from '../lib/AppError.js';
import { askAI, failed } from './aiProvider.js';

function routinesContext(routines) {
  if (!Array.isArray(routines) || !routines.length) return 'No routines yet.';
  return routines.slice(0, 30).map((r) => {
    const status = r.completionStatus ?? 'pending';
    const risk = typeof r.probability === 'number' ? `, miss-risk ${Math.round(r.probability * 100)}%` : '';
    const frog = r.isFrog ? ', FROG (most important task)' : '';
    const anchor = r.anchorHabit ? `, anchor: ${r.anchorHabit}` : '';
    return `- ${r.title} (${r.startTime}-${r.endTime}, ${status}${risk}${frog}${anchor})`;
  }).join('\n');
}

export async function generatePersonalBriefing({ userName, lang = 'bn', routines = [], config }) {
  const isBn = lang === 'bn';
  const safeName = String(userName || '').trim() || (isBn ? 'বন্ধু' : 'friend');
  const system = isBn
    ? `তুমি Smart Routine অ্যাপের ব্যক্তিগত AI ভয়েস কোচ। ইউজারের নাম "${safeName}"। ইউজারের আজকের রুটিন তালিকা দেখে তাকে নাম ধরে সম্বোধন করে ৪ থেকে ৬ বাক্যের একটি অত্যন্ত আন্তরিক, উৎসাহব্যঞ্জক এবং ব্যক্তিগত ভয়েস ব্রিফিং তৈরি করো।
নিয়মাবলী:
১) শুরুতেই "${safeName}"-কে নাম ধরে ডাকবে।
২) ইউজারের তালিকায় থাকা প্রতিটি রুটিনের নাম ও শুরুর সময় স্পষ্টভাবে এক এক করে উল্লেখ করে ডাকবে (যেমন: "সকাল ৭টায় আপনার সকালের হাঁটা, এরপর সকাল ৯টায় গণিত অনুশীলন...")।
৩) কোনো রুটিন ইতিমধ্যে সম্পন্ন (done) হয়ে থাকলে সেটির প্রশংসা করবে এবং সবচেয়ে গুরুত্বপূর্ণ কাজটিতে (FROG) বিশেষ মনোযোগ দিতে বলবে।
৪) কোনো মার্কডাউন (*, #) বা বুলেট পয়েন্ট ব্যবহার করবে না—এমনভাবে প্রাকৃতিক কথ্য বাংলায় লিখবে যেন সরাসরি ভয়েসে পড়ে শোনানো যায়।`
    : `You are the personal AI Voice Coach for Smart Routine. The user's name is "${safeName}". Write a warm, motivating 4-to-6 sentence spoken voice briefing tailored specifically to ${safeName}.
Rules:
1) Greet "${safeName}" warmly by name at the very beginning.
2) Explicitly call out each of the user's routines by its exact name and start time one by one (e.g., "At 7:00 AM you have Morning Walk, followed by Math Study at 9:00 AM...").
3) Praise any routine already marked as done, and highlight their most important FROG task if present.
4) Do NOT use markdown (*, #) or bullet points—write natural spoken sentences ready for text-to-speech.`;

  const userPrompt = isBn
    ? `ইউজারের নাম: ${safeName}\nআজকের রুটিন তালিকা:\n${routinesContext(routines)}\n\nএখন প্রতিটি রুটিনের নাম ধরে ডেকে একটি সুন্দর বাংলা ভয়েস ব্রিফিং দাও।`
    : `User name: ${safeName}\nToday's routines:\n${routinesContext(routines)}\n\nGenerate the spoken voice briefing calling out each routine by name.`;

  const { text } = await askAI({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
    config,
    maxTokens: 600,
    temperature: 0.65,
  });

  return String(text || '').replace(/[*#_`~>-]/g, ' ').replace(/\s+/g, ' ').trim();
}

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
    .filter((d) => (
      d
      && typeof d.title === 'string'
      && d.title.trim()
      && timePattern.test(d.startTime)
      && timePattern.test(d.endTime)
      && d.endTime > d.startTime
    ))
    .slice(0, 8)
    .map((d) => ({
      title: d.title.trim().slice(0, 120),
      startTime: d.startTime,
      endTime: d.endTime,
      priority: ['high', 'medium', 'low'].includes(d.priority) ? d.priority : 'medium',
      isFrog: Boolean(d.isFrog),
      category: typeof d.category === 'string' && d.category.trim()
        ? d.category.trim().slice(0, 40)
        : 'general',
    }));

  if (!clean.length) throw failed();
  clean.sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let index = 1; index < clean.length; index += 1) {
    if (clean[index - 1].endTime > clean[index].startTime) throw failed();
  }

  let frogSeen = false;
  for (const item of clean) {
    if (item.isFrog && frogSeen) item.isFrog = false;
    if (item.isFrog) frogSeen = true;
  }
  if (!frogSeen) clean[0].isFrog = true;
  return clean;
}

export { AppError };
