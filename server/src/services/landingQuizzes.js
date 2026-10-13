import { LandingQuiz } from '../models/LandingQuiz.js';

export const DEFAULT_LANDING_QUIZZES = [
  {
    slot: 1,
    question: {
      bn: 'নতুন অভ্যাস গড়তে কোন পদ্ধতিটি সবচেয়ে কার্যকর?',
      en: 'Which approach is most effective for building a new habit?',
    },
    options: [
      { bn: 'খুব ছোট একটি কাজ দিয়ে শুরু করা', en: 'Start with one very small action' },
      { bn: 'একদিনেই পুরো রুটিন বদলে ফেলা', en: 'Change the entire routine in one day' },
      { bn: 'ইচ্ছা হলে তবেই কাজটি করা', en: 'Do it only when you feel motivated' },
      { bn: 'প্রথম ভুলের পর চেষ্টা বন্ধ করা', en: 'Stop trying after the first mistake' },
    ],
    correctIndex: 0,
    explanation: {
      bn: 'ছোট ও বাস্তবসম্মত পদক্ষেপ ধারাবাহিকভাবে করা সহজ, তাই অভ্যাস গড়ার জন্য এটি ভালো শুরু।',
      en: 'Small, realistic actions are easier to repeat consistently, making them a strong starting point.',
    },
  },
  {
    slot: 2,
    question: {
      bn: 'পরিকল্পিত কাজটি একদিন বাদ পড়লে সবচেয়ে ভালো পরের পদক্ষেপ কী?',
      en: 'What is the best next step after missing a planned routine once?',
    },
    options: [
      { bn: 'পরের সুযোগে ছোট সংস্করণটি আবার শুরু করা', en: 'Restart with a smaller version at the next opportunity' },
      { bn: 'পুরো সপ্তাহের পরিকল্পনা বাদ দেওয়া', en: 'Give up on the plan for the whole week' },
      { bn: 'পরের দিন দ্বিগুণ কাজ করে পুষিয়ে নেওয়া', en: 'Double the workload the next day' },
      { bn: 'নিজেকে দোষ দিয়ে কাজটি এড়িয়ে যাওয়া', en: 'Blame yourself and avoid the task' },
    ],
    correctIndex: 0,
    explanation: {
      bn: 'একটি বাদ পড়া দিন অভ্যাসের শেষ নয়। পরের সুযোগে ছোট করে শুরু করলে ধারাবাহিকতা বজায় রাখা সহজ হয়।',
      en: 'One missed day does not end a habit. A small restart at the next opportunity makes consistency easier.',
    },
  },
];

function toPublicQuiz(quiz) {
  return {
    slot: quiz.slot,
    question: quiz.question,
    options: quiz.options,
  };
}

export async function listPublicLandingQuizzes() {
  const stored = await LandingQuiz.find({}).lean();
  const storedBySlot = new Map(stored.map((quiz) => [quiz.slot, quiz]));
  return DEFAULT_LANDING_QUIZZES.map((fallback) => toPublicQuiz(storedBySlot.get(fallback.slot) || fallback));
}

export async function listAdminLandingQuizzes() {
  const stored = await LandingQuiz.find({}).lean();
  const storedBySlot = new Map(stored.map((quiz) => [quiz.slot, quiz]));
  return DEFAULT_LANDING_QUIZZES.map((fallback) => ({
    ...(storedBySlot.get(fallback.slot) || fallback),
    isDefault: !storedBySlot.has(fallback.slot),
  }));
}

export async function saveLandingQuiz(slot, quiz, userId) {
  const saved = await LandingQuiz.findOneAndUpdate(
    { slot },
    {
      $set: { ...quiz, updatedBy: userId },
      $setOnInsert: { slot },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  return { ...saved, isDefault: false };
}

export async function submitLandingQuizAnswer(slot, answerIndex, locale = 'bn') {
  const stored = await LandingQuiz.findOne({ slot }).lean();
  const quiz = stored || DEFAULT_LANDING_QUIZZES.find((item) => item.slot === slot);
  if (!quiz) return null;
  return {
    correct: answerIndex === quiz.correctIndex,
    correctOption: quiz.options[quiz.correctIndex][locale],
    explanation: quiz.explanation[locale],
  };
}
