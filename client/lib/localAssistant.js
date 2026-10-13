const GREETING = {
  en: "Hello! I'm AM's Routine Assistant for Smart Routine. I can answer common questions about the app and help explain routine miss-risk estimates when a validated local model is available.",
  bn: "হ্যালো! আমি Smart Routine-এর AM's রুটিন সহকারী। Smart Routine সম্পর্কে সাধারণ প্রশ্নের উত্তর দিতে পারি। যাচাইকৃত স্থানীয় মডেল চালু থাকলে রুটিন মিসের ঝুঁকিও বুঝিয়ে বলতে পারি।",
};

const ABOUT = {
  en: 'Smart Routine helps you plan routines, set alarms and reminders, track progress, use a focus stopwatch, view calendars, and explore lessons and quizzes. Create an account from the app to get started.',
  bn: 'Smart Routine দিয়ে রুটিন সাজানো, অ্যালার্ম ও রিমাইন্ডার সেট করা, অগ্রগতি দেখা, ফোকাস স্টপওয়াচ ব্যবহার, ক্যালেন্ডার দেখা এবং পাঠ ও কুইজ ব্যবহার করা যায়। শুরু করতে অ্যাপে অ্যাকাউন্ট তৈরি করুন।',
};

const PRIVACY = {
  en: 'The assistant normally sends your question and routine summaries to the server, which tries Gemini and then Groq if configured. Local keyword matching is only a fallback when the AI service is unavailable. Risk estimates still require a validated local model, which is not currently active.',
  bn: 'সহকারী সাধারণত আপনার প্রশ্ন ও রুটিনের সারাংশ server-এ পাঠায়; server Gemini চেষ্টা করে, এরপর কনফিগার থাকলে Groq ব্যবহার করে। AI পরিষেবা না থাকলেই শুধু স্থানীয় keyword matching চলে। ঝুঁকির হিসাবের জন্য যাচাইকৃত স্থানীয় মডেল দরকার, যা এখন চালু নেই।',
};

const LIMITS = {
  en: 'I can answer common questions about Smart Routine, but I am not a general-purpose chatbot. I cannot check live events or provide medical, legal, or emergency advice. Risk estimates are unavailable until a validated local model is active.',
  bn: 'আমি Smart Routine সম্পর্কে সাধারণ প্রশ্নের উত্তর দিতে পারি, তবে সব বিষয়ে উত্তর দেওয়া সাধারণ চ্যাটবট নই। সরাসরি বর্তমান ঘটনা যাচাই বা চিকিৎসা, আইনি কিংবা জরুরি পরামর্শ দিতে পারি না। যাচাইকৃত স্থানীয় মডেল চালু না হওয়া পর্যন্ত ঝুঁকির হিসাবও পাওয়া যাবে না।',
};

const NO_ROUTINES = {
  en: 'There are no routines to evaluate yet.',
  bn: 'এখনো মূল্যায়ন করার মতো কোনো রুটিন নেই।',
};

function normalizeLanguage(lang) {
  return lang === 'bn' ? 'bn' : 'en';
}

function matches(text, expressions) {
  return expressions.some((expression) => expression.test(text));
}

function isGreeting(text) {
  return matches(text, [
    /\b(hi|hello|hey|good morning|good afternoon|good evening|assalamu alaikum)\b/i,
    /^(হাই|হ্যালো|আসসালামু আলাইকুম|সালাম|শুভ সকাল|শুভ সন্ধ্যা)(?:[\s!.।?]|$)/i,
  ]);
}

function asksAboutPrivacy(text) {
  return matches(text, [
    /\b(privacy|private|data|gemini|google|internet|online|local|device)\b/i,
    /(গোপন|ব্যক্তিগত|তথ্য|ডেটা|জেমিনি|জেমিনাই|ইন্টারনেট|অনলাইন|স্থানীয়|লোকাল|ডিভাইস)/i,
  ]);
}

function asksAboutLimits(text) {
  return matches(text, [
    /\b(limitation|limitations|what can you|what do you know|can you|emergency|medical|legal|weather|news)\b/i,
    /(সীমাবদ্ধতা|কী পারেন|কি পারেন|কী জানেন|কি জানেন|জরুরি|চিকিৎসা|আইনি|আবহাওয়া|খবর)/i,
  ]);
}

function asksAboutApp(text) {
  return matches(text, [
    /\b(smart routine|what is this app|what does this app|features|routine|alarm|reminder|snooze|stopwatch|calendar|lesson|quiz|account|sign up|register|start|getting started)\b/i,
    /(স্মার্ট রুটিন|এই অ্যাপ|অ্যাপটি|রুটিন|অ্যালার্ম|এলার্ম|রিমাইন্ডার|স্নুজ|স্টপওয়াচ|ক্যালেন্ডার|পাঠ|কুইজ|অ্যাকাউন্ট|শুরু|নিবন্ধন)/i,
  ]);
}

function asksAboutRisk(text) {
  return matches(text, [
    /\b(miss|missed|risk|probability|likelihood)\b/i,
    /(মিস|ঝুঁকি|সম্ভাবনা)/i,
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
  return lang === 'bn'
    ? `সবচেয়ে বেশি মিসের ঝুঁকি: ${highestRisk.title}: ${percentage}%`
    : `Highest estimated miss risk: ${highestRisk.title}: ${percentage}%`;
}

export function answerWithLocalModel(question, predictions, model, lang = 'en') {
  const language = normalizeLanguage(lang);
  const text = String(question || '').trim();
  if (!text) return null;

  if (isGreeting(text)) return GREETING[language];
  if (asksAboutRisk(text)) return model ? formatRiskAnswer(predictions || [], language, model.demo) : null;
  if (asksAboutPrivacy(text)) return PRIVACY[language];
  if (asksAboutApp(text)) return ABOUT[language];
  if (asksAboutLimits(text)) return LIMITS[language];

  return null;
}
