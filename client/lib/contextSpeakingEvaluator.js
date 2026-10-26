import { speechWords } from './speechPractice.js';

export const CONTEXT_KEYWORDS = {
  cafe: [
    'coffee', 'tea', 'order', 'cup', 'drink', 'sandwich', 'food', 'menu',
    'table', 'sugar', 'milk', 'water', 'breakfast', 'recommend', 'bill', 'price',
    'please', 'thank', 'dollars', 'fresh',
  ],
  introductions: [
    'hello', 'hi', 'name', 'meet', 'nice', 'from', 'live', 'learn', 'english',
    'free', 'time', 'hobby', 'music', 'books', 'stories', 'travel', 'work', 'friend',
  ],
  shopping: [
    'shirt', 'size', 'medium', 'large', 'small', 'colour', 'blue', 'fit',
    'cost', 'price', 'dollars', 'discount', 'buy', 'pay', 'card', 'bag', 'store',
  ],
  directions: [
    'where', 'how', 'get', 'library', 'street', 'road', 'walk', 'straight',
    'turn', 'left', 'right', 'blocks', 'traffic', 'near', 'corner', 'opposite',
  ],
  bus: [
    'bus', 'ticket', 'stop', 'station', 'fare', 'arrive', 'next', 'route',
    'seat', 'schedule', 'time', 'minute', 'leave',
  ],
  hotel: [
    'hotel', 'room', 'reservation', 'booked', 'check', 'night', 'key',
    'breakfast', 'floor', 'wifi', 'luggage', 'stay',
  ],
  doctor: [
    'doctor', 'feel', 'sick', 'pain', 'headache', 'fever', 'medicine',
    'cough', 'days', 'prescription', 'rest', 'stomach', 'better', 'health',
  ],
  interview: [
    'job', 'interview', 'experience', 'skills', 'work', 'team', 'company',
    'position', 'strength', 'learn', 'challenge', 'project', 'graduate',
  ],
  grocery: [
    'grocery', 'fruit', 'vegetables', 'apples', 'fresh', 'kilo', 'price',
    'aisle', 'milk', 'eggs', 'bread', 'cart', 'cashier',
  ],
  airport: [
    'flight', 'airport', 'passport', 'ticket', 'gate', 'boarding', 'luggage',
    'bag', 'check-in', 'security', 'terminal', 'seat', 'departure', 'arrive',
  ],
  'work-small-talk': [
    'morning', 'project', 'meeting', 'weekend', 'busy', 'coffee', 'progress',
    'deadline', 'colleague', 'team', 'presentation',
  ],
  'phone-appointment': [
    'call', 'appointment', 'schedule', 'date', 'time', 'monday', 'morning',
    'afternoon', 'confirm', 'doctor', 'available', 'reschedule',
  ],
  'returning-item': [
    'return', 'receipt', 'item', 'exchange', 'refund', 'broken', 'size',
    'defective', 'money', 'bought', 'yesterday',
  ],
  library: [
    'book', 'library', 'borrow', 'card', 'shelf', 'author', 'read',
    'return', 'renew', 'study', 'quiet', 'section',
  ],
  'renting-room': [
    'rent', 'room', 'apartment', 'deposit', 'month', 'kitchen', 'bills',
    'utilities', 'move', 'contract', 'furnished',
  ],
  'community-event': [
    'event', 'community', 'volunteer', 'join', 'park', 'cleanup', 'people',
    'saturday', 'help', 'register', 'activities',
  ],
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'to', 'in', 'on',
  'at', 'by', 'for', 'with', 'about', 'as', 'into', 'like', 'through', 'after',
  'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under',
  'around', 'among', 'that', 'this', 'these', 'those', 'it', 'its', 'i', 'you',
  'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'their', 'our',
]);

export function extractContextKeywords(situation) {
  if (!situation) return [];
  const predefined = CONTEXT_KEYWORDS[situation.id];
  if (predefined?.length) return predefined;

  const rawText = `${situation.title?.en || ''} ${situation.description?.en || ''} ${situation.dialogue || ''}`;
  const words = speechWords(rawText);
  const frequencies = {};

  for (const word of words) {
    if (word.length >= 4 && !STOP_WORDS.has(word)) {
      frequencies[word] = (frequencies[word] || 0) + 1;
    }
  }

  return Object.keys(frequencies)
    .sort((a, b) => frequencies[b] - frequencies[a])
    .slice(0, 18);
}

export function evaluateContextSpeech({
  transcript = '',
  situation,
  durationSeconds = 0,
}) {
  const words = speechWords(transcript);
  const wordCount = words.length;

  if (wordCount === 0 || durationSeconds < 3) {
    return {
      score: 0,
      relevanceScore: 0,
      fluencyScore: 0,
      vocabularyScore: 0,
      matchedKeywords: [],
      wordCount: 0,
      durationSeconds,
      wpm: 0,
      feedback: {
        en: 'Please speak in English for at least a few seconds about the chosen context.',
        bn: 'অনুগ্রহ করে নির্বাচিত পরিস্থিতি নিয়ে অন্তত কয়েক সেকেন্ড ইংরেজিতে কথা বলুন।',
      },
    };
  }

  const keywords = extractContextKeywords(situation);
  const spokenSet = new Set(words);
  const matchedKeywords = keywords.filter((kw) => spokenSet.has(kw));

  // 1. Strict Relevance Score (out of 40)
  // Requires multiple rich context keywords to score high
  let relevanceScore = 0;
  const matchCount = matchedKeywords.length;
  if (matchCount >= 7) relevanceScore = 40;
  else if (matchCount === 6) relevanceScore = 36;
  else if (matchCount === 5) relevanceScore = 31;
  else if (matchCount === 4) relevanceScore = 25;
  else if (matchCount === 3) relevanceScore = 19;
  else if (matchCount === 2) relevanceScore = 13;
  else if (matchCount === 1) relevanceScore = 7;
  else relevanceScore = 2;

  // 2. Strict Fluency & Content Length Score (out of 35)
  // In a 5-minute activity, speaking only 10-20 words is beginner effort.
  // Full marks require sustained speaking of 90+ words.
  const effectiveSeconds = Math.max(8, Math.min(300, durationSeconds));
  const wpm = Math.round((wordCount / effectiveSeconds) * 60);

  let lengthScore = 0;
  if (wordCount >= 100) lengthScore = 22;
  else if (wordCount >= 70) lengthScore = 18;
  else if (wordCount >= 45) lengthScore = 14;
  else if (wordCount >= 25) lengthScore = 9;
  else if (wordCount >= 12) lengthScore = 5;
  else lengthScore = 2;

  let paceScore = 0;
  if (wpm >= 65 && wpm <= 135) paceScore = 13;
  else if (wpm >= 40 && wpm <= 155) paceScore = 9;
  else if (wpm >= 20 && wpm <= 175) paceScore = 5;
  else paceScore = 2;

  const fluencyScore = Math.min(35, lengthScore + paceScore);

  // 3. Strict Vocabulary Richness & Structure (out of 25)
  const uniqueWords = new Set(words);
  const uniqueCount = uniqueWords.size;

  let vocabPoints = 0;
  if (uniqueCount >= 50) vocabPoints = 17;
  else if (uniqueCount >= 35) vocabPoints = 13;
  else if (uniqueCount >= 20) vocabPoints = 9;
  else if (uniqueCount >= 10) vocabPoints = 5;
  else vocabPoints = 2;

  // Modest bonuses for courteous/linking words only when speech is substantial
  if (wordCount >= 25) {
    const politeExpressions = ['please', 'thank', 'could', 'would', 'may', 'excuse', 'sorry'];
    if (politeExpressions.some((p) => spokenSet.has(p))) vocabPoints += 4;

    const connectors = ['because', 'and', 'but', 'so', 'also', 'then', 'if', 'when'];
    if (connectors.some((c) => spokenSet.has(c))) vocabPoints += 4;
  }

  const vocabularyScore = Math.min(25, vocabPoints);

  // Total Score (Strict, realistically scaled out of 100)
  const totalScore = Math.min(100, relevanceScore + fluencyScore + vocabularyScore);

  let feedbackEn = '';
  let feedbackBn = '';

  if (totalScore >= 80) {
    feedbackEn = 'Excellent mastery! You maintained natural fluency, spoke at length, and used rich situational vocabulary.';
    feedbackBn = 'চমৎকার পারদর্শিতা! আপনি দীর্ঘ সময় ধরে স্বাভাবিক গতিতে প্রাসঙ্গিক শব্দ ব্যবহার করে কথা বলেছেন।';
  } else if (totalScore >= 60) {
    feedbackEn = 'Solid practice. Try expanding your sentences with more details and connecting ideas to reach higher scores.';
    feedbackBn = 'ভালো হয়েছে। আরও বেশি পয়েন্ট পেতে বাক্যগুলো আরেকটু বড় করুন ও সংযোগকারী শব্দ যোগ করুন।';
  } else if (totalScore >= 40) {
    feedbackEn = 'Fair effort. Practice speaking for a longer duration and include more words directly related to this context.';
    feedbackBn = 'মোটামুটি হয়েছে। আরও কিছুক্ষণ কথা বলার চেষ্টা করুন এবং এই পরিস্থিতির আরও কিছু শব্দ ব্যবহার করুন।';
  } else {
    feedbackEn = 'Short attempt. Challenge yourself to speak longer and build full sentences around the situation.';
    feedbackBn = 'কথা অনেক কম হয়েছে। আরও বেশি সময় নিয়ে পরিস্থিতি অনুযায়ী পুরো বাক্য বলার চেষ্টা করুন।';
  }

  return {
    score: totalScore,
    relevanceScore,
    fluencyScore,
    vocabularyScore,
    matchedKeywords,
    wordCount,
    durationSeconds,
    wpm,
    feedback: { en: feedbackEn, bn: feedbackBn },
  };
}

export async function evaluateContextSpeechWithServerAI({
  transcript = '',
  situation,
  durationSeconds = 0,
  lang = 'bn',
}) {
  const localFallback = evaluateContextSpeech({
    transcript,
    situation,
    durationSeconds,
  });

  if (!transcript || transcript.trim().length < 5) {
    return localFallback;
  }

  try {
    const res = await fetch('/api/speech/evaluate-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        situation: situation ? {
          id: situation.id,
          title: situation.title,
          description: situation.description,
          expectedKeywords: extractContextKeywords(situation),
        } : undefined,
        durationSeconds,
        lang,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.evaluation && typeof data.evaluation.score === 'number') {
        return {
          ...localFallback,
          ...data.evaluation,
          wordCount: localFallback.wordCount,
          durationSeconds: localFallback.durationSeconds,
          wpm: localFallback.wpm,
          matchedKeywords: localFallback.matchedKeywords,
          aiEvaluated: true,
        };
      }
    }
  } catch {
    // network or server error, fallback to local heuristic
  }

  return localFallback;
}
