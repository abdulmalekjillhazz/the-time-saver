// 30 ready-made routine items. Purely static data used for one-click "quick add" on the client.
// Each item maps directly to the fields the server's routine schema expects.
export const ROUTINE_TEMPLATES = [
  { id: 'wake-early', title: { en: 'Wake up early', bn: 'সকালে তাড়াতাড়ি ওঠা' }, startTime: '05:30', endTime: '05:45', category: 'morning', priority: 'high', isFrog: false },
  { id: 'drink-water', title: { en: 'Drink a glass of water', bn: 'এক গ্লাস পানি খাওয়া' }, startTime: '05:45', endTime: '05:50', category: 'health', priority: 'low', isFrog: false },
  { id: 'morning-prayer', title: { en: 'Morning prayer / meditation', bn: 'সকালের নামাজ / ধ্যান' }, startTime: '05:50', endTime: '06:10', category: 'mindfulness', priority: 'high', isFrog: false },
  { id: 'exercise', title: { en: 'Exercise / walk', bn: 'ব্যায়াম / হাঁটা' }, startTime: '06:15', endTime: '06:45', category: 'health', priority: 'medium', isFrog: false },
  { id: 'frog-task', title: { en: "Today's hardest task (frog)", bn: 'আজকের সবচেয়ে কঠিন কাজ' }, startTime: '07:00', endTime: '08:30', category: 'work', priority: 'high', isFrog: true },
  { id: 'breakfast', title: { en: 'Breakfast', bn: 'সকালের নাস্তা' }, startTime: '08:30', endTime: '09:00', category: 'health', priority: 'medium', isFrog: false },
  { id: 'deep-work-1', title: { en: 'Deep work block 1', bn: 'গভীর মনোযোগের কাজ ১' }, startTime: '09:15', endTime: '11:00', category: 'work', priority: 'high', isFrog: false },
  { id: 'inbox-check', title: { en: 'Check email / messages', bn: 'ইমেইল / মেসেজ দেখা' }, startTime: '11:00', endTime: '11:20', category: 'work', priority: 'low', isFrog: false },
  { id: 'deep-work-2', title: { en: 'Deep work block 2', bn: 'গভীর মনোযোগের কাজ ২' }, startTime: '11:30', endTime: '13:00', category: 'work', priority: 'high', isFrog: false },
  { id: 'lunch', title: { en: 'Lunch break', bn: 'দুপুরের খাবার' }, startTime: '13:00', endTime: '13:45', category: 'health', priority: 'medium', isFrog: false },
  { id: 'short-rest', title: { en: 'Short rest / power nap', bn: 'ছোট বিশ্রাম / ঘুম' }, startTime: '13:45', endTime: '14:15', category: 'health', priority: 'low', isFrog: false },
  { id: 'study-block', title: { en: 'Study block', bn: 'পড়াশোনার সময়' }, startTime: '14:30', endTime: '16:00', category: 'study', priority: 'high', isFrog: false },
  { id: 'revision', title: { en: 'Revise notes', bn: 'নোট রিভিশন' }, startTime: '16:00', endTime: '16:30', category: 'study', priority: 'medium', isFrog: false },
  { id: 'skill-practice', title: { en: 'Practice a skill (coding / language)', bn: 'নতুন দক্ষতা চর্চা (কোডিং / ভাষা)' }, startTime: '16:45', endTime: '17:45', category: 'study', priority: 'high', isFrog: false },
  { id: 'family-time', title: { en: 'Family / friends time', bn: 'পরিবার / বন্ধুদের সাথে সময়' }, startTime: '18:00', endTime: '19:00', category: 'personal', priority: 'medium', isFrog: false },
  { id: 'evening-walk', title: { en: 'Evening walk', bn: 'সন্ধ্যার হাঁটা' }, startTime: '19:00', endTime: '19:30', category: 'health', priority: 'low', isFrog: false },
  { id: 'dinner', title: { en: 'Dinner', bn: 'রাতের খাবার' }, startTime: '20:00', endTime: '20:30', category: 'health', priority: 'medium', isFrog: false },
  { id: 'daily-review', title: { en: "Review today's progress", bn: 'আজকের অগ্রগতি পর্যালোচনা' }, startTime: '20:45', endTime: '21:00', category: 'planning', priority: 'medium', isFrog: false },
  { id: 'plan-tomorrow', title: { en: "Plan tomorrow's frog task", bn: 'আগামীকালের প্রধান কাজ ঠিক করা' }, startTime: '21:00', endTime: '21:15', category: 'planning', priority: 'high', isFrog: false },
  { id: 'reading', title: { en: 'Reading time', bn: 'বই পড়ার সময়' }, startTime: '21:15', endTime: '21:45', category: 'personal', priority: 'low', isFrog: false },
  { id: 'screen-off', title: { en: 'Screens off / wind down', bn: 'স্ক্রিন বন্ধ / ঘুমের প্রস্তুতি' }, startTime: '21:45', endTime: '22:00', category: 'health', priority: 'medium', isFrog: false },
  { id: 'sleep', title: { en: 'Sleep', bn: 'ঘুম' }, startTime: '22:00', endTime: '22:15', category: 'health', priority: 'high', isFrog: false },
  { id: 'gym', title: { en: 'Gym / strength training', bn: 'জিম / শক্তি প্রশিক্ষণ' }, startTime: '06:30', endTime: '07:30', category: 'health', priority: 'medium', isFrog: false },
  { id: 'journaling', title: { en: 'Journaling', bn: 'ডায়েরি লেখা' }, startTime: '21:20', endTime: '21:35', category: 'mindfulness', priority: 'low', isFrog: false },
  { id: 'side-project', title: { en: 'Side project work', bn: 'সাইড প্রজেক্টের কাজ' }, startTime: '17:00', endTime: '18:00', category: 'work', priority: 'high', isFrog: false },
  { id: 'job-applications', title: { en: 'Job / freelance applications', bn: 'চাকরি / ফ্রিল্যান্স আবেদন' }, startTime: '10:00', endTime: '10:45', category: 'work', priority: 'high', isFrog: false },
  { id: 'quiz-practice', title: { en: 'Quiz / exam practice', bn: 'কুইজ / পরীক্ষার প্রস্তুতি' }, startTime: '15:00', endTime: '15:45', category: 'study', priority: 'medium', isFrog: false },
  { id: 'cleaning', title: { en: 'Tidy up / household chores', bn: 'ঘর গোছানো' }, startTime: '17:45', endTime: '18:15', category: 'personal', priority: 'low', isFrog: false },
  { id: 'social-media-limit', title: { en: 'Limited social media check', bn: 'সীমিত সময় সোশ্যাল মিডিয়া' }, startTime: '12:30', endTime: '12:45', category: 'personal', priority: 'low', isFrog: false },
  { id: 'weekly-review', title: { en: 'Weekly goal review', bn: 'সাপ্তাহিক লক্ষ্য পর্যালোচনা' }, startTime: '21:00', endTime: '21:30', category: 'planning', priority: 'medium', isFrog: false },
];

export function templateTitle(template, lang) {
  return lang === 'bn' ? template.title.bn : template.title.en;
}
