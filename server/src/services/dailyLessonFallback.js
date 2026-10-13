const FALLBACKS = {
  en: {
    title: 'The Notebook That Played Hide-and-Seek',
    description: 'A missing notebook, a messy desk, and one smarter evening plan.',
    content: [
      '[Storyteller]: At breakfast, sunlight crossed Rafi’s desk, which looked like a tiny stationery bazaar. The school bus would arrive soon.',
      '[Rahim - Father]: The notebook is missing again. Should I ask the bus to wait while we interview the pencils?',
      '[Rafi - Child]: It has probably run away with my maths book. They were sitting together yesterday.',
      '[Asha - Mother]: Before we blame the stationery gang, let us pause and remember where homework ended.',
      '[Storyteller]: Rafi took a breath. A faint pencil sketch on a workbook gave him a clue.',
      '[Rafi - Child]: Found it under this book! My notebook was hiding in plain sight.',
      '[Rahim - Father]: Good detective work. Rushing around had made the desk look even more mysterious.',
      '[Asha - Mother]: Tonight, let us put tomorrow’s books and water bottle beside the door.',
      '[Rafi - Child]: I will make a short checklist. Even a runaway ruler will have to sign out.',
      '[Storyteller]: They laughed, then chose a five-minute bag check after dinner. Rafi added the notebook to his list.',
    ].join('\n'),
    keyTakeaway: 'Prepare tomorrow’s essentials in one place after dinner.',
    vocabulary: [{ term: 'essential', definition: 'Something important that you need.' }],
    questions: [
      {
        text: 'Which two clues best explain why their plan targets the evening?',
        options: [
          { text: 'The morning search felt rushed, and the books could be checked before bed.', correct: true },
          { text: 'The bus had changed its route, and the family needed a new timetable.', correct: false },
          { text: 'Asha had no time to prepare lunch, and Rafi wanted a different breakfast.', correct: false },
          { text: 'The notebook was never found, so they needed to buy another one.', correct: false },
        ],
        explanation: 'The family found the notebook, but the rushed search showed why preparing the bag the night before could help.',
      },
      {
        text: 'If Rafi cannot find his art folder tonight, what best follows their plan?',
        options: [
          { text: 'Pause, check where homework ended, then add the folder to the ready-by-the-door list.', correct: true },
          { text: 'Search every room as quickly as possible and skip the checklist.', correct: false },
          { text: 'Leave the folder missing and wake up much earlier each day.', correct: false },
          { text: 'Pack only the books already on the desk and hope the folder appears.', correct: false },
        ],
        explanation: 'Their approach combines a calm search with preparing and checking essentials ahead of the rushed morning.',
      },
      {
        text: 'Why did they choose a short evening check instead of simply waking earlier?',
        options: [
          { text: 'It uses a few calm minutes to prevent a stressful search when the bus is near.', correct: true },
          { text: 'The story says the bus will always wait if the family is late.', correct: false },
          { text: 'A checklist guarantees that nobody will ever lose anything again.', correct: false },
          { text: 'They decided that sleep matters less than packing perfectly.', correct: false },
        ],
        explanation: 'The problem was the last-minute search, so they chose to prepare earlier rather than change the whole morning.',
      },
    ],
  },
  bn: {
    title: 'খাতার লুকোচুরি আর পাঁচ মিনিটের বুদ্ধি',
    description: 'হারানো খাতা, এলোমেলো টেবিল আর রাতের ছোট্ট পরিকল্পনা।',
    content: [
      '[Storyteller]: সকালের রোদ রাফির টেবিলে পড়েছে। টেবিলটা যেন ছোটখাটো স্টেশনারির বাজার, আর স্কুলবাস আসবে কিছুক্ষণের মধ্যে।',
      '[Rahim - Father]: খাতাটা আবার নেই। পেন্সিলদের জিজ্ঞাসাবাদ করতে করতে কি বাসকে অপেক্ষা করতে বলব?',
      '[Rafi - Child]: খাতাটা নিশ্চয়ই অঙ্কের বইয়ের সঙ্গে পালিয়েছে। গতকাল ওরা পাশাপাশি ছিল।',
      '[Asha - Mother]: স্টেশনারির দলকে দোষ দেওয়ার আগে একটু থামি। বাড়ির কাজ শেষ করে কোথায় বসেছিলে মনে করো।',
      '[Storyteller]: রাফি একটু শ্বাস নিল। বইয়ের ওপর পেন্সিলে আঁকা ছোট্ট ছবিটা তাকে একটা সূত্র দিল।',
      '[Rafi - Child]: পেয়েছি! বইটার নিচে ছিল। খাতাটা চোখের সামনেই লুকিয়েছিল!',
      '[Rahim - Father]: ভালো গোয়েন্দাগিরি। তাড়াহুড়োয় টেবিলটাকেই আরও রহস্যময় লাগছিল।',
      '[Asha - Mother]: আজ রাতে পরের দিনের বই আর পানির বোতল দরজার পাশে রাখি।',
      '[Rafi - Child]: আমি ছোট্ট তালিকা বানাব। পালিয়ে যাওয়া স্কেলকেও তালিকায় নাম লিখতে হবে!',
      '[Storyteller]: সবাই হেসে রাতের খাবারের পর পাঁচ মিনিট ব্যাগ দেখার সিদ্ধান্ত নিল। রাফি তালিকায় খাতার নাম লিখল।',
    ].join('\n'),
    keyTakeaway: 'রাতের খাবারের পরে পরদিনের দরকারি জিনিস এক জায়গায় গুছিয়ে রাখুন।',
    vocabulary: [{ term: 'তাড়াহুড়ো', definition: 'সময় কম ভেবে দ্রুত কাজ করার চাপ।' }],
    questions: [
      {
        text: 'কোন দুটি সূত্রে বোঝা যায়, রাতের পরিকল্পনাই সমস্যার ভালো সমাধান?',
        options: [
          { text: 'সকালের খোঁজাখুঁজিতে তাড়া লাগছিল, আর রাতে বইগুলো আগে থেকে দেখা সম্ভব।', correct: true },
          { text: 'বাসের রাস্তা বদলে গিয়েছিল, তাই নতুন সময়সূচি দরকার ছিল।', correct: false },
          { text: 'আশার টিফিন বানানোর সময় ছিল না, আর রাফি অন্য নাশতা চাইছিল।', correct: false },
          { text: 'খাতাটি পাওয়া যায়নি, তাই নতুন খাতা কিনতে হতো।', correct: false },
        ],
        explanation: 'খাতাটি পাওয়া গেলেও সকালের তাড়াহুড়ো দেখিয়েছে যে আগের রাতে ব্যাগ গুছিয়ে রাখলে চাপ কমতে পারে।',
      },
      {
        text: 'আজ রাতে রাফি আঁকার ফাইল না পেলে পরিকল্পনাটি কীভাবে কাজে লাগাবে?',
        options: [
          { text: 'একটু থেমে বাড়ির কাজ কোথায় শেষ করেছে মনে করে খুঁজবে, তারপর ফাইলটি তালিকায় রাখবে।', correct: true },
          { text: 'তালিকা বাদ দিয়ে যত দ্রুত সম্ভব সব ঘর খুঁজবে।', correct: false },
          { text: 'ফাইল না নিয়েই ঘুমাবে এবং প্রতিদিন অনেক আগে উঠবে।', correct: false },
          { text: 'শুধু টেবিলে থাকা বই নেবে, ফাইল নিজে থেকে পাওয়ার আশা করবে।', correct: false },
        ],
        explanation: 'পরিকল্পনাটিতে শান্তভাবে খোঁজা এবং তাড়াহুড়োর আগেই দরকারি জিনিস গুছিয়ে রাখা—দুটিই আছে।',
      },
      {
        text: 'তারা শুধু আগে ঘুম থেকে না উঠে, রাতে অল্প সময় ব্যাগ দেখবে কেন?',
        options: [
          { text: 'কয়েক মিনিটের শান্ত প্রস্তুতি বাস আসার সময়ের চাপের মধ্যে খোঁজাখুঁজি কমায়।', correct: true },
          { text: 'গল্পে বলা হয়েছে, দেরি হলেও বাস সব সময় অপেক্ষা করবে।', correct: false },
          { text: 'তালিকা করলে আর কোনো জিনিস কখনো হারাবে না।', correct: false },
          { text: 'তারা ঠিক করেছে, নিখুঁত ব্যাগের জন্য ঘুম কমানো দরকার।', correct: false },
        ],
        explanation: 'সমস্যাটি ছিল শেষ মুহূর্তের খোঁজাখুঁজি, তাই পুরো সকাল বদলানোর বদলে তারা আগে থেকে প্রস্তুতির পথ বেছে নিয়েছে।',
      },
    ],
  },
};

export function createCuratedDailyLesson(date, locale) {
  const language = locale === 'en' ? 'en' : 'bn';
  const fallback = FALLBACKS[language];
  const slug = `curated-${language}-morning-routine-${date}`;
  return {
    lesson: {
      slug,
      title: fallback.title,
      description: fallback.description,
      content: fallback.content,
      category: 'growth',
      locale: language,
      storyType: 'tool',
      keyTakeaway: fallback.keyTakeaway,
      vocabulary: fallback.vocabulary,
    },
    quiz: { lessonSlug: slug, questions: fallback.questions },
  };
}
