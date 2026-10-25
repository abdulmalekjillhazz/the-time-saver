export const DEFAULT_PUBLISHED_LESSONS = [
  {
    id: 'morning-routine-story',
    slug: 'morning-routine-story',
    title: {
      en: 'A Fresh Morning in the City',
      bn: 'শহরের একটি নতুন সকাল',
    },
    body: `[Narrator]: The sun rose gently over the busy town.
[Rahim - Student]: Good morning! Today is going to be a productive day.
[Mina - Sister]: Good morning, Rahim. Have you finished your morning tea?
[Rahim - Student]: Yes, I have. Now I am getting ready for my English class.
[Mina - Sister]: Remember to take your notebook and library book.
[Rahim - Student]: I already packed them. Wish me good luck!
[Mina - Sister]: You will do wonderful today!`,
    media: { type: 'audio', url: '' },
    vocabulary: [
      { term: 'productive', meaning: 'ফলপ্রসূ / কাজের' },
      { term: 'gently', meaning: 'ধীরে ধীরে' },
      { term: 'packed', meaning: 'ব্যাগে গুছিয়ে নিয়েছে' },
      { term: 'wonderful', meaning: 'চমৎকার' },
    ],
    quiz: [
      {
        question: { en: 'What is Rahim preparing for?', bn: 'রহিম কিসের জন্য প্রস্তুত হচ্ছে?' },
        options: ['English class', 'A cricket match', 'Going to bed', 'Cooking lunch'],
        answer: 0,
      },
      {
        question: { en: 'What did Mina remind Rahim to take?', bn: 'মিনা রহিমকে কী সাথে নিতে মনে করিয়ে দিল?' },
        options: ['Notebook and library book', 'An umbrella', 'A bicycle', 'His sunglasses'],
        answer: 0,
      },
      {
        question: { en: 'How does Mina encourage Rahim?', bn: 'মিনা কীভাবে রহিমকে উৎসাহিত করল?' },
        options: ['By saying he will do wonderful', 'By telling him to stay home', 'By asking for money', 'By laughing'],
        answer: 0,
      },
    ],
  },
  {
    id: 'cafe-conversation-lesson',
    slug: 'cafe-conversation-lesson',
    title: {
      en: 'Ordering Warm Tea at a Café',
      bn: 'ক্যাফেতে গরম চা অর্ডার করা',
    },
    body: `[Server - Staff]: Welcome! What can I get for you today?
[Customer - Guest]: Hello! Could I have a cup of warm ginger tea, please?
[Server - Staff]: Certainly! Would you like any milk or sugar with that?
[Customer - Guest]: Just a little honey, please, but no milk.
[Server - Staff]: Would you also like something fresh to eat?
[Customer - Guest]: What do you recommend for breakfast?
[Server - Staff]: Our vegetable club sandwich is very popular and warm.
[Customer - Guest]: That sounds delicious. I will take one, please.
[Server - Staff]: Perfect. It will be ready at your table in five minutes.`,
    media: { type: 'audio', url: '' },
    vocabulary: [
      { term: 'ginger', meaning: 'আদা' },
      { term: 'recommend', meaning: 'পরামর্শ দেওয়া' },
      { term: 'delicious', meaning: 'সুস্বাদু' },
      { term: 'certainly', meaning: 'অবশ্যই' },
    ],
    quiz: [
      {
        question: { en: 'What kind of drink did the customer order?', bn: 'ক্রেতা কোন ধরনের পানীয় অর্ডার করেছিলেন?' },
        options: ['Ginger tea', 'Cold coffee', 'Apple juice', 'Hot chocolate'],
        answer: 0,
      },
      {
        question: { en: 'What sweetener did the customer ask for?', bn: 'ক্রেতা মিষ্টিকারক হিসেবে কী চাইলেন?' },
        options: ['A little honey', 'Brown sugar', 'White sugar', 'No sweetener'],
        answer: 0,
      },
      {
        question: { en: 'Which food item did the server recommend?', bn: 'সার্ভার কোন খাবারটির পরামর্শ দিয়েছিলেন?' },
        options: ['Vegetable club sandwich', 'Chocolate donut', 'Spicy noodles', 'Fruit bowl'],
        answer: 0,
      },
    ],
  },
  {
    id: 'asking-directions-lesson',
    slug: 'asking-directions-lesson',
    title: {
      en: 'Finding the Public Library',
      bn: 'পাবলিক লাইব্রেরির পথ খুঁজে পাওয়া',
    },
    body: `[Visitor - Traveler]: Excuse me, sir. Could you help me find the public library?
[Local - Resident]: Of course! It is not far from here.
[Visitor - Traveler]: How many minutes does it take to walk there?
[Local - Resident]: Just about five minutes. Walk straight down this road for two blocks.
[Visitor - Traveler]: Should I turn at the traffic signal?
[Local - Resident]: Yes, turn left at the green pharmacy, and the library will be right ahead.
[Visitor - Traveler]: Thank you very much for your kindness!
[Local - Resident]: You are very welcome. Enjoy your reading!`,
    media: { type: 'audio', url: '' },
    vocabulary: [
      { term: 'straight', meaning: 'সোজা' },
      { term: 'blocks', meaning: 'রাস্তার মধ্যবর্তী ব্লক' },
      { term: 'pharmacy', meaning: 'ওষুধের দোকান' },
      { term: 'resident', meaning: 'স্থানীয় বাসিন্দা' },
    ],
    quiz: [
      {
        question: { en: 'How long does the walk take?', bn: 'হেঁটে যেতে কত সময় লাগে?' },
        options: ['About five minutes', 'Two hours', 'Thirty minutes', 'One hour'],
        answer: 0,
      },
      {
        question: { en: 'Where should the traveler turn left?', bn: 'ভ্রমণকারী কোথায় বামে মোড় নেবেন?' },
        options: ['At the green pharmacy', 'Near the river', 'At the train station', 'Behind the school'],
        answer: 0,
      },
      {
        question: { en: 'What destination was the traveler looking for?', bn: 'ভ্রমণকারী কোন স্থানটি খুঁজছিলেন?' },
        options: ['Public library', 'Bus station', 'Post office', 'Shopping mall'],
        answer: 0,
      },
    ],
  },
  {
    id: 'doctor-visit-lesson',
    slug: 'doctor-visit-lesson',
    title: {
      en: 'Visiting the Doctor',
      bn: 'ডাক্তারের সাথে স্বাস্থ্য বিষয়ে আলাপ',
    },
    body: `[Doctor - Physician]: Good afternoon. What brings you in today?
[Patient - Visitor]: Good afternoon, Doctor. I have had a headache and a mild fever since yesterday.
[Doctor - Physician]: I see. Have you been drinking plenty of water and resting?
[Patient - Visitor]: I tried to drink water, but I have had very little sleep because of work.
[Doctor - Physician]: Let me check your temperature and heart rate.
[Patient - Visitor]: Thank you, Doctor. Is it anything serious?
[Doctor - Physician]: No, it looks like seasonal fatigue and mild flu. I will prescribe some medicine.
[Doctor - Physician]: Take this after meals, drink warm soup, and sleep for at least eight hours.
[Patient - Visitor]: I will follow your instructions carefully. Thank you!`,
    media: { type: 'audio', url: '' },
    vocabulary: [
      { term: 'fatigue', meaning: 'ক্লান্তি' },
      { term: 'fever', meaning: 'জ্বর' },
      { term: 'prescribe', meaning: 'প্রেসক্রিপশন লিখে দেওয়া' },
      { term: 'instructions', meaning: 'নির্দেশনাবলী' },
    ],
    quiz: [
      {
        question: { en: 'What symptoms did the patient describe?', bn: 'রোগী কী কী উপসর্গের কথা বলেছিলেন?' },
        options: ['Headache and mild fever', 'Broken arm', 'Toothache', 'Stomach cramp'],
        answer: 0,
      },
      {
        question: { en: 'What did the doctor diagnose?', bn: 'ডাক্তার কী কারণ চিহ্নিত করেছিলেন?' },
        options: ['Seasonal fatigue and mild flu', 'Broken bone', 'Severe infection', 'Allergy'],
        answer: 0,
      },
      {
        question: { en: 'How many hours of sleep did the doctor recommend?', bn: 'ডাক্তার কত ঘণ্টা ঘুমানোর পরামর্শ দিলেন?' },
        options: ['At least eight hours', 'Four hours', 'Twelve hours', 'Two hours'],
        answer: 0,
      },
    ],
  },
];

