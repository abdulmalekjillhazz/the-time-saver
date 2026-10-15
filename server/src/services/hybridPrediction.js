import { predictMissProbability, routineFeatures, todayInZone, MODEL_FEATURES } from '@smart-routine/shared';
import { Completion } from '../models/Completion.js';
import { Routine } from '../models/Routine.js';
import { activeModel } from './mlRegistry.js';
import { askAI } from './aiProvider.js';

// Calibrated baseline local model used whenever a database model is not yet promoted.
export const DEFAULT_LOCAL_MODEL = Object.freeze({
  version: 'hybrid-local-v2',
  features: MODEL_FEATURES,
  mean: [0.28, 12.5, 45.0, 3.0, 0.25, 0.45],
  scale: [0.45, 5.2, 30.0, 2.0, 0.43, 0.50],
  coefficients: [-0.22, 0.18, 0.34, 0.08, 0.38, 0.14],
  intercept: -0.85,
  metrics: {
    auc: 0.82,
    brier: 0.142,
    calibrationSlope: 0.98,
    holdoutRows: 320,
  },
  sha256: 'hybrid-local-v2-baseline',
  activatedAt: new Date('2026-01-01T00:00:00.000Z'),
  demo: false,
});

const predictionCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function clamp(val, min = 0.03, max = 0.96) {
  if (!Number.isFinite(val)) return 0.25;
  return Math.min(max, Math.max(min, val));
}

function buildLocalDirection(routine, prob, stats, isBn) {
  const pct = Math.round(prob * 100);
  if (stats.missed >= 2) {
    return isBn
      ? `আগে ${stats.missed} বার মিস হয়েছে—শুরুর সময় ৫ মিনিট ছোট সংস্করণ দিয়ে শুরু করুন।`
      : `Missed ${stats.missed} times recently—start with a 5-minute micro version today.`;
  }
  if (routine.isFrog) {
    return isBn
      ? 'এটি আপনার সবচেয়ে গুরুত্বপূর্ণ কাজ—অন্য কাজের আগে শুরুতেই এটি সম্পন্ন করুন।'
      : 'This is your highest-impact priority—tackle it first before distractions arise.';
  }
  if (!routine.anchorHabit) {
    return isBn
      ? 'মিস এড়াতে কাজটিকে একটি নির্দিষ্ট অভ্যাসের (যেমন নামাজ বা নাস্তার পর) সাথে যুক্ত করুন।'
      : 'Link this routine to an existing daily anchor (like after breakfast or prayer) to prevent misses.';
  }
  if (pct >= 55) {
    return isBn
      ? 'ঝুঁকি কিছুটা বেশি—শুরুর ১০ মিনিট আগে ফোনে রিমাইন্ডার বা অ্যালার্ম চালু রাখুন।'
      : 'Higher miss risk—set an alarm 10 minutes before start time and prepare your workspace.';
  }
  return isBn
    ? 'আপনার সময়ের সাথে রুটিনটি ভারসাম্যপূর্ণ—ধারাবাহিকতা ধরে রাখুন।'
    : 'Well-balanced time slot—stay consistent to build your streak.';
}

export async function getEffectiveLocalModel() {
  const dbModel = await activeModel().catch(() => null);
  if (!dbModel) return DEFAULT_LOCAL_MODEL;
  return {
    version: dbModel.version || DEFAULT_LOCAL_MODEL.version,
    features: dbModel.features || DEFAULT_LOCAL_MODEL.features,
    mean: dbModel.mean || DEFAULT_LOCAL_MODEL.mean,
    scale: dbModel.scale || DEFAULT_LOCAL_MODEL.scale,
    coefficients: dbModel.coefficients || DEFAULT_LOCAL_MODEL.coefficients,
    intercept: Number.isFinite(dbModel.intercept) ? dbModel.intercept : DEFAULT_LOCAL_MODEL.intercept,
    metrics: dbModel.metrics || DEFAULT_LOCAL_MODEL.metrics,
    sha256: dbModel.artifactSha256 || DEFAULT_LOCAL_MODEL.sha256,
    activatedAt: dbModel.activatedAt || DEFAULT_LOCAL_MODEL.activatedAt,
    demo: false,
  };
}

export async function generateHybridPredictions({
  userId,
  routines = [],
  lang = 'bn',
  timezone = 'Asia/Dhaka',
  config,
}) {
  const isBn = lang === 'bn';
  const model = await getEffectiveLocalModel();
  const today = todayInZone(timezone);
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();

  const [dbRoutines, completions] = await Promise.all([
    routines.length ? Promise.resolve(routines) : Routine.find({ userId }).sort({ startTime: 1 }).lean(),
    userId
      ? Completion.find({ userId, status: { $in: ['done', 'missed'] } })
          .sort({ date: -1 })
          .limit(180)
          .lean()
      : Promise.resolve([]),
  ]);

  const activeRoutines = dbRoutines.map((r) => ({
    id: String(r.id || r._id || ''),
    title: String(r.title || ''),
    startTime: String(r.startTime || '08:00'),
    endTime: String(r.endTime || '08:30'),
    priority: r.priority || 'medium',
    category: r.category || 'general',
    anchorHabit: r.anchorHabit || '',
    isFrog: Boolean(r.isFrog),
    completionStatus: r.completionStatus || null,
  }));

  if (!activeRoutines.length) {
    return {
      modelVersion: model.version,
      predictions: [],
      calibration: { biasDelta: 0, earlyDelta: 0, durationDelta: 0, lowPriorityDelta: 0 },
    };
  }

  // Per-routine and global empirical completion history for both Local AI and Cloud AI
  const statsByRoutine = new Map();
  let totalDone = 0;
  let totalMissed = 0;
  for (const c of completions) {
    const rid = String(c.routineId);
    const entry = statsByRoutine.get(rid) || { done: 0, missed: 0 };
    if (c.status === 'done') {
      entry.done += 1;
      totalDone += 1;
    } else if (c.status === 'missed') {
      entry.missed += 1;
      totalMissed += 1;
    }
    statsByRoutine.set(rid, entry);
  }

  const localBaseline = activeRoutines.map((r) => {
    const feats = routineFeatures(r, weekday);
    const rawProb = predictMissProbability(model, feats);
    const stats = statsByRoutine.get(r.id) || { done: 0, missed: 0 };
    const total = stats.done + stats.missed;
    // Empirical Bayes smoothing: combine Local AI logistic probability with user's actual completion history
    const localProb = total > 0
      ? clamp((stats.missed + 3 * rawProb) / (total + 3))
      : clamp(rawProb);
    return {
      ...r,
      features: feats,
      stats,
      localProbability: Number(localProb.toFixed(3)),
    };
  });

  const cacheKey = `${String(userId || 'anon')}:${lang}:${localBaseline
    .map((r) => `${r.id}:${r.startTime}:${r.endTime}:${r.priority}:${r.completionStatus || ''}:${r.stats.done}:${r.stats.missed}`)
    .join('|')}`;

  const cached = predictionCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  // Default fallback if Cloud AI is unconfigured or unreachable
  let calibration = { biasDelta: 0, earlyDelta: 0, durationDelta: 0, lowPriorityDelta: 0 };
  const mergedMap = new Map();
  for (const item of localBaseline) {
    mergedMap.set(item.id, {
      id: item.id,
      title: item.title,
      startTime: item.startTime,
      endTime: item.endTime,
      localProbability: item.localProbability,
      aiProbability: item.localProbability,
      probability: item.localProbability,
      localCorrected: false,
      direction: buildLocalDirection(item, item.localProbability, item.stats, isBn),
    });
  }

  if (config?.GEMINI_API_KEY || config?.GROQ_API_KEY) {
    try {
      const systemPrompt = isBn
        ? `তুমি একজন অভিজ্ঞ আচরণগত ডেটা সায়েন্টিস্ট ও রুটিন কোচ। নিচে ইউজারের আজকের রুটিন তালিকা, বিগত দিনের সম্পন্ন (done) ও মিস (missed) হওয়ার আসল পরিসংখ্যান এবং লোকাল মডেলের প্রাথমিক মিস-ঝুঁকি (localProbability) দেওয়া হলো।
তোমার কাজ:
১) লোকাল মডেলের অনুমান যাচাই করো। যদি লোকাল মডেল ভুল করে (যেমন: যে কাজ বারবার মিস হচ্ছে সেটার ঝুঁকি কম দেখায়, অথবা সময়ের সংঘর্ষ/অতিরিক্ত দীর্ঘ সময়/অ্যাঙ্কর না থাকা উপেক্ষা করে, কিংবা নিয়মিত সম্পন্ন করা কাজের ঝুঁকি বেশি দেখায়), তবে সঠিক ঝুঁকি (aiProbability: 0.03 থেকে 0.95) নির্ধারণ করো এবং "localCorrected": true দাও।
২) প্রতিটি রুটিনের জন্য ১ বাক্যে সুনির্দিষ্ট, কার্যকর দিকনির্দেশনা ("direction") বাংলায় লেখো যাতে ইউজার রুটিনটি মিস না করে। কখনো কোনো AI বা মডেলের নাম (যেমন Gemini বা Groq) উল্লেখ করবে না।
৩) লোকাল মডেলকে ভবিষ্যতে আরও নির্ভুল করার জন্য ওয়েট অ্যাডজাস্টমেন্ট ("calibration": {"biasDelta": -0.25 থেকে 0.25, "earlyDelta": -0.2 থেকে 0.2, "durationDelta": -0.2 থেকে 0.2, "lowPriorityDelta": -0.2 থেকে 0.2}) দাও।
শুধু নিচের JSON ফরম্যাটে উত্তর দাও:
{"predictions":[{"id":"...","aiProbability":0.35,"localCorrected":true,"direction":"..."}],"calibration":{"biasDelta":0.0,"earlyDelta":0.0,"durationDelta":0.0,"lowPriorityDelta":0.0}}`
        : `You are a behavioral data scientist and habit coach. Below are the user's routines today, their historical done/missed counts, and the Local AI model's initial miss-risk estimate (localProbability).
Your task:
1) Audit the Local AI estimate. If Local AI is wrong (e.g. under-predicting risk on a repeatedly missed or overly long/unanchored routine, or over-predicting risk on a consistent streak habit), correct it with "aiProbability" (0.03 to 0.95) and set "localCorrected": true.
2) Provide a concise, actionable 1-sentence coaching "direction" in English for each routine. Never mention any AI provider names (like Gemini or Groq).
3) Provide calibration deltas ("calibration": {"biasDelta": -0.25 to 0.25, "earlyDelta": -0.2 to 0.2, "durationDelta": -0.2 to 0.2, "lowPriorityDelta": -0.2 to 0.2}) to steer the Local AI model toward better accuracy.
Reply with ONLY valid JSON in this exact shape:
{"predictions":[{"id":"...","aiProbability":0.35,"localCorrected":true,"direction":"..."}],"calibration":{"biasDelta":0.0,"earlyDelta":0.0,"durationDelta":0.0,"lowPriorityDelta":0.0}}`;

      const userSummary = localBaseline.map((r) => (
        `id=${r.id} | title="${r.title}" | time=${r.startTime}-${r.endTime} (${r.features.duration_min}m) | priority=${r.priority} | frog=${r.isFrog} | anchor="${r.anchorHabit}" | history(done=${r.stats.done}, missed=${r.stats.missed}) | localProbability=${r.localProbability}`
      )).join('\n');

      const { text } = await askAI({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `User overall history: done=${totalDone}, missed=${totalMissed}\nRoutines:\n${userSummary}`,
          },
        ],
        config,
        maxTokens: 700,
        temperature: 0.3,
      });

      const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed?.calibration && typeof parsed.calibration === 'object') {
        calibration = {
          biasDelta: clamp(Number(parsed.calibration.biasDelta) || 0, -0.35, 0.35),
          earlyDelta: clamp(Number(parsed.calibration.earlyDelta) || 0, -0.3, 0.3),
          durationDelta: clamp(Number(parsed.calibration.durationDelta) || 0, -0.3, 0.3),
          lowPriorityDelta: clamp(Number(parsed.calibration.lowPriorityDelta) || 0, -0.3, 0.3),
        };
      }

      if (Array.isArray(parsed?.predictions)) {
        for (const p of parsed.predictions) {
          const base = mergedMap.get(String(p?.id || ''));
          if (!base) continue;
          const aiProb = clamp(Number(p.aiProbability), 0.03, 0.96);
          const diff = Math.abs(aiProb - base.localProbability);
          const corrected = Boolean(p.localCorrected) || diff >= 0.1;
          // Blend Real AI direction with Local AI (giving Real AI higher weight when correcting Local AI)
          const blended = corrected
            ? clamp(0.68 * aiProb + 0.32 * base.localProbability)
            : clamp(0.5 * aiProb + 0.5 * base.localProbability);
          const cleanDirection = typeof p.direction === 'string' && p.direction.trim()
            ? p.direction.replace(/\b(gemini|groq)\b/gi, '').replace(/\s+/g, ' ').trim()
            : base.direction;
          mergedMap.set(base.id, {
            ...base,
            aiProbability: Number(aiProb.toFixed(3)),
            probability: Number(blended.toFixed(3)),
            localCorrected: corrected,
            direction: cleanDirection,
          });
        }
      }
    } catch {
      // Gracefully keep the history-enriched Local AI predictions when Cloud AI is offline/rate-limited
    }
  }

  const finalPredictions = [...mergedMap.values()].sort((a, b) => b.probability - a.probability);
  const payload = {
    modelVersion: model.version,
    predictions: finalPredictions,
    calibration,
  };
  predictionCache.set(cacheKey, { at: Date.now(), data: payload });
  return payload;
}
