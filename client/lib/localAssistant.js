const GREETING = {
  en: "Hello! I'm the Routine Assistant for Smart Routine. I can answer common questions about the app and explain routine miss-risk estimates.",
  bn: 'হ্যালো! আমি Smart Routine-এর রুটিন সহকারী। Smart Routine সম্পর্কে সাধারণ প্রশ্নের উত্তর দিতে পারি এবং রুটিন মিসের ঝুঁকি বুঝিয়ে বলতে পারি।',
};

const PRODUCT_OVERVIEW = {
  en: 'Smart Routine helps you plan routines, set alarms and reminders, track progress, use a focus stopwatch, view calendars, and explore lessons and quizzes. Create an account from the app to get started.',
  bn: 'Smart Routine দিয়ে রুটিন সাজানো, অ্যালার্ম ও রিমাইন্ডার সেট করা, অগ্রগতি দেখা, ফোকাস স্টপওয়াচ ব্যবহার, ক্যালেন্ডার দেখা এবং পাঠ ও কুইজ ব্যবহার করা যায়। শুরু করতে অ্যাপে অ্যাকাউন্ট তৈরি করুন।',
};

const PRIVACY_NOTE = {
  en: 'The assistant combines the on-device habit model with the smart coaching server to analyze your routine summaries and estimate miss risk accurately.',
  bn: 'রুটিন সহকারী আপনার ডিভাইসের লোকাল মডেল ও স্মার্ট কোচিং সার্ভারের সমন্বয়ে রুটিন বিশ্লেষণ করে এবং মিস হওয়ার ঝুঁকি ও দিকনির্দেশনা দেয়।',
};

const LIMITATIONS_NOTE = {
  en: 'I can answer common questions about Smart Routine, but I am not a general-purpose chatbot. I cannot check live events or provide medical, legal, or emergency advice.',
  bn: 'আমি Smart Routine সম্পর্কে সাধারণ প্রশ্নের উত্তর দিতে পারি, তবে সব বিষয়ে উত্তর দেওয়া সাধারণ চ্যাটবট নই। সরাসরি বর্তমান ঘটনা যাচাই বা চিকিৎসা, আইনি কিংবা জরুরি পরামর্শ দিতে পারি না।',
};

const NO_ROUTINES = {
  en: 'There are no routines to evaluate yet.',
  bn: 'এখনো মূল্যায়ন করার মতো কোনো রুটিন নেই।',
};

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function isGreeting(text) {
  return matchesAny(text, [
    /\b(hi|hello|hey|good morning|good afternoon|good evening|assalamu alaikum)\b/i,
    /^(হাই|হ্যালো|আসসালামু আলাইকুম|সালাম|শুভ সকাল|শুভ সন্ধ্যা)(?:[\s!.।?]|$)/i,
  ]);
}

function asksAboutRisk(text) {
  return matchesAny(text, [
    /\b(miss|missed|risk|probability|likelihood)\b/i,
    /(মিস|ঝুঁকি|সম্ভাবনা)/i,
  ]);
}

function asksAboutPrivacy(text) {
  return matchesAny(text, [
    /\b(privacy|private|data|ai|google|internet|online|local|device)\b/i,
    /(গোপন|ব্যক্তিগত|তথ্য|ডেটা|এআই|ইন্টারনেট|অনলাইন|স্থানীয়|লোকাল|ডিভাইস)/i,
  ]);
}

function asksAboutProduct(text) {
  return matchesAny(text, [
    /\b(smart routine|what is this app|what does this app|features|routine|alarm|reminder|snooze|stopwatch|calendar|lesson|quiz|account|sign up|register|start|getting started)\b/i,
    /(স্মার্ট রুটিন|এই অ্যাপ|অ্যাপটি|রুটিন|অ্যালার্ম|এলার্ম|রিমাইন্ডার|স্নুজ|স্টপওয়াচ|ক্যালেন্ডার|পাঠ|কুইজ|অ্যাকাউন্ট|শুরু|নিবন্ধন)/i,
  ]);
}

function asksAboutLimitations(text) {
  return matchesAny(text, [
    /\b(limitation|limitations|what can you|what do you know|can you|emergency|medical|legal|weather|news)\b/i,
    /(সীমাবদ্ধতা|কী পারেন|কি পারেন|কী জানেন|কি জানেন|জরুরি|চিকিৎসা|আইনি|আবহাওয়া|খবর)/i,
  ]);
}

function formatRiskAnswer(predictions, lang, isDemo) {
  if (!predictions.length) return NO_ROUTINES[lang];
  const highestRisk = [...predictions].sort((a, b) => b.probability - a.probability)[0];
  const percentage = Math.round(highestRisk.probability * 100);
  if (isDemo) {
    return lang === 'bn'
      ? `শুধু ডেমো অনুমান—যাচাইকৃত নয়: ${highestRisk.title}: ${percentage}%. ব্যক্তিগত ঝুঁকি হিসেবে এটি ব্যবহার করবেন না।`
      : `Illustrative demo only—not validated: ${highestRisk.title}: ${percentage}%. Do not use this as a personal risk estimate.`;
  }
  const directionNote = highestRisk.direction ? ` — ${highestRisk.direction}` : '';
  return lang === 'bn'
    ? `সবচেয়ে বেশি মিসের ঝুঁকি: ${highestRisk.title}: ${percentage}%${directionNote}`
    : `Highest estimated miss risk: ${highestRisk.title}: ${percentage}%${directionNote}`;
}

export function answerWithLocalModel(question, predictions, model, lang = 'en') {
  const language = lang === 'bn' ? 'bn' : 'en';
  const text = String(question || '').trim();
  if (!text) return null;

  if (isGreeting(text)) return GREETING[language];
  if (asksAboutRisk(text)) return model ? formatRiskAnswer(predictions || [], language, model.demo) : null;
  if (asksAboutPrivacy(text)) return PRIVACY_NOTE[language];
  if (asksAboutProduct(text)) return PRODUCT_OVERVIEW[language];
  if (asksAboutLimitations(text)) return LIMITATIONS_NOTE[language];
  return null;
}
