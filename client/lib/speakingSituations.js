export const SPEAKING_SITUATIONS = [
  {
    id: 'cafe',
    icon: '☕',
    title: { en: 'At a café', bn: 'ক্যাফেতে অর্ডার' },
    category: { en: 'Food & ordering', bn: 'খাবার ও অর্ডার' },
    description: {
      en: 'Order a drink, ask what is available, and check the price politely.',
      bn: 'ভদ্রভাবে পানীয় অর্ডার করুন, কী আছে জিজ্ঞেস করুন এবং দাম জেনে নিন।',
    },
    dialogue: `[Mina - Customer]: Good morning. Could I have a cup of tea, please?
[Sam - Server]: Of course. Would you like milk and sugar?
[Mina - Customer]: A little milk, please, but no sugar.
[Sam - Server]: Certainly. Would you like something to eat with your tea?
[Mina - Customer]: What do you recommend for breakfast?
[Sam - Server]: Our vegetable sandwich is fresh and popular.
[Mina - Customer]: That sounds good. I will have one, please.
[Sam - Server]: Great. Your tea and sandwich will be ready in a few minutes.
[Mina - Customer]: Thank you. Could I sit near the window?
[Sam - Server]: Yes, please choose any free table.
[Mina - Customer]: How much is everything?
[Sam - Server]: It is eight dollars altogether.`,
  },
  {
    id: 'introductions',
    icon: '👋',
    title: { en: 'Meeting someone new', bn: 'নতুন কারও সঙ্গে পরিচয়' },
    category: { en: 'Introductions', bn: 'পরিচয় ও আলাপ' },
    description: {
      en: 'Introduce yourself, ask friendly questions, and keep a conversation going.',
      bn: 'নিজের পরিচয় দিন, বন্ধুত্বপূর্ণ প্রশ্ন করুন এবং কথা চালিয়ে যান।',
    },
    dialogue: `[Asha - Guest]: Hello, I am Asha. Is this your first time at the language club?
[Rafi - Guest]: Hi, Asha. Yes, it is. I am Rafi, and I am learning English.
[Asha - Guest]: Nice to meet you, Rafi. What do you enjoy doing in your free time?
[Rafi - Guest]: I enjoy cooking and listening to music. What about you?
[Asha - Guest]: I like reading stories and going for long walks.
[Rafi - Guest]: That sounds lovely. What kind of stories do you like?
[Asha - Guest]: I enjoy stories about travel because I want to see new places.
[Rafi - Guest]: Me too. I hope to visit the mountains one day.
[Asha - Guest]: That would be wonderful. We can practise travel conversations together.
[Rafi - Guest]: I would like that. When does the next club meeting start?
[Asha - Guest]: It starts at six, so we have time to get some tea.
[Rafi - Guest]: Great. Let us find a seat and keep talking.`,
  },
  {
    id: 'shopping',
    icon: '🛍️',
    title: { en: 'Shopping for clothes', bn: 'কাপড় কেনাকাটা' },
    category: { en: 'Shopping', bn: 'কেনাকাটা' },
    description: {
      en: 'Ask for a size, try something on, compare prices, and pay at the counter.',
      bn: 'সাইজ জানতে চান, পোশাক পরে দেখুন, দাম তুলনা করুন এবং কাউন্টারে মূল্য দিন।',
    },
    dialogue: `[Mina - Customer]: Excuse me. Do you have this shirt in a medium size?
[Alex - Shop assistant]: Let me check for you. What colour would you like?
[Mina - Customer]: I prefer the blue one, if it is available.
[Alex - Shop assistant]: We have a blue medium in the next section.
[Mina - Customer]: Thank you. May I try it on before I decide?
[Alex - Shop assistant]: Certainly. The fitting rooms are behind you.
[Mina - Customer]: It fits well. How much does it cost?
[Alex - Shop assistant]: It is thirty dollars, and today it is ten percent off.
[Mina - Customer]: That is a good price. I will take it.
[Alex - Shop assistant]: Would you like a bag for your purchase?
[Mina - Customer]: Yes, please. Can I pay by card?
[Alex - Shop assistant]: Of course. Please tap your card here.`,
  },
  {
    id: 'directions',
    icon: '🧭',
    title: { en: 'Asking for directions', bn: 'রাস্তা জিজ্ঞেস করা' },
    category: { en: 'Around town', bn: 'শহরে চলাফেরা' },
    description: {
      en: 'Ask where a place is, understand simple directions, and check you are on the right street.',
      bn: 'কোনো জায়গার অবস্থান জিজ্ঞেস করুন, সহজ দিকনির্দেশ বুঝুন এবং রাস্তা ঠিক আছে কি না নিশ্চিত করুন।',
    },
    dialogue: `[Rafi - Visitor]: Excuse me. Could you tell me how to get to the city library?
[Asha - Local]: Certainly. Walk straight along this road for two blocks.
[Rafi - Visitor]: Should I turn left at the traffic lights?
[Asha - Local]: Yes. Turn left there, and you will see a park on your right.
[Rafi - Visitor]: Is the library near the park?
[Asha - Local]: It is just opposite the park, next to the post office.
[Rafi - Visitor]: Thank you. Is it far enough to take a bus?
[Asha - Local]: No, it is only a ten-minute walk from here.
[Rafi - Visitor]: I will walk, then. I do not want to miss the main entrance.
[Asha - Local]: The entrance is on Green Street, facing the park.
[Rafi - Visitor]: Let me repeat that. I turn left at the lights and look for Green Street.
[Asha - Local]: That is right. You will find it easily.`,
  },
  {
    id: 'bus',
    icon: '🚌',
    title: { en: 'Taking a bus', bn: 'বাসে যাতায়াত' },
    category: { en: 'Travel & transport', bn: 'ভ্রমণ ও যাতায়াত' },
    description: {
      en: 'Find the right bus, ask about a ticket, and make sure you get off at your stop.',
      bn: 'সঠিক বাস খুঁজুন, টিকিট সম্পর্কে জানুন এবং নিজের স্টপে নামা নিশ্চিত করুন।',
    },
    dialogue: `[Rafi - Passenger]: Excuse me. Does this bus go to the central station?
[Mina - Driver]: Yes, it does. The station is the fifth stop from here.
[Rafi - Passenger]: How much is one ticket, please?
[Mina - Driver]: It is two dollars. You can pay with cash or a card.
[Rafi - Passenger]: I will use my card. Could you tell me when we reach the station?
[Mina - Driver]: I can, but the display will also show the stop names.
[Rafi - Passenger]: Thank you. Is there a seat available near the front?
[Mina - Driver]: Yes, there is one beside the window.
[Rafi - Passenger]: I will sit there. How long does the journey usually take?
[Mina - Driver]: About twenty minutes, depending on traffic.
[Rafi - Passenger]: I have my ticket. I will watch for the station sign.
[Mina - Driver]: Good plan. I will announce the stop before we arrive.`,
  },
  {
    id: 'hotel',
    icon: '🛎️',
    title: { en: 'Checking in at a hotel', bn: 'হোটেলে চেক-ইন' },
    category: { en: 'Travel & accommodation', bn: 'ভ্রমণ ও থাকার ব্যবস্থা' },
    description: {
      en: 'Confirm a booking, ask about breakfast, and find out when your room is ready.',
      bn: 'বুকিং নিশ্চিত করুন, সকালের নাশতার সময় জানুন এবং রুম কখন প্রস্তুত হবে জেনে নিন।',
    },
    dialogue: `[Mina - Guest]: Hello. I have a reservation under the name Mina Rahman.
[Sam - Receptionist]: Welcome, Ms Rahman. May I see your passport, please?
[Mina - Guest]: Certainly. I booked a room for two nights.
[Sam - Receptionist]: I have your booking. Your room is on the fourth floor.
[Mina - Guest]: What time is breakfast served in the morning?
[Sam - Receptionist]: Breakfast is served from seven until ten in the restaurant.
[Mina - Guest]: Is Wi-Fi included with the room?
[Sam - Receptionist]: Yes. The password is printed on your room key card.
[Mina - Guest]: Could you also tell me where the elevator is?
[Sam - Receptionist]: It is just around the corner, beside the lounge.
[Mina - Guest]: Thank you for your help. Is my room ready now?
[Sam - Receptionist]: Yes, it is ready. Enjoy your stay with us.`,
  },
  {
    id: 'doctor',
    icon: '🩺',
    title: { en: 'At a doctor’s appointment', bn: 'ডাক্তারের কাছে' },
    category: { en: 'Health & appointments', bn: 'স্বাস্থ্য ও অ্যাপয়েন্টমেন্ট' },
    description: {
      en: 'Describe how you feel, answer simple questions, and ask what to do next.',
      bn: 'আপনার কেমন লাগছে বলুন, সহজ প্রশ্নের উত্তর দিন এবং পরের করণীয় জেনে নিন।',
    },
    dialogue: `[Mina - Patient]: Good afternoon, doctor. I have had a sore throat since yesterday.
[Dr Lee - Doctor]: I am sorry to hear that. Do you also have a fever?
[Mina - Patient]: I felt warm last night, but I have not checked my temperature.
[Dr Lee - Doctor]: Have you been able to drink water and rest?
[Mina - Patient]: I can drink water, but swallowing is a little painful.
[Dr Lee - Doctor]: I will examine your throat and ask a few more questions.
[Mina - Patient]: Of course. Should I stay home from work today?
[Dr Lee - Doctor]: Rest today, drink plenty of fluids, and monitor your symptoms.
[Mina - Patient]: When should I contact the clinic again?
[Dr Lee - Doctor]: Please call us if you feel worse or the fever continues.
[Mina - Patient]: Thank you. I will follow those instructions.
[Dr Lee - Doctor]: You are welcome. Take care and get some rest.`,
  },
  {
    id: 'interview',
    icon: '💼',
    title: { en: 'At a job interview', bn: 'চাকরির ইন্টারভিউ' },
    category: { en: 'Work & interviews', bn: 'কাজ ও ইন্টারভিউ' },
    description: {
      en: 'Introduce your experience, explain your strengths, and ask a thoughtful question.',
      bn: 'নিজের অভিজ্ঞতা জানান, দক্ষতার কথা বলুন এবং ভেবে একটি প্রশ্ন করুন।',
    },
    dialogue: `[Alex - Interviewer]: Good morning. Thank you for coming in to meet with us.
[Mina - Applicant]: Good morning. Thank you for inviting me.
[Alex - Interviewer]: Could you tell me a little about your experience?
[Mina - Applicant]: I have worked in customer service for three years.
[Alex - Interviewer]: What do you enjoy most about working with customers?
[Mina - Applicant]: I enjoy listening carefully and helping people find a clear solution.
[Alex - Interviewer]: How do you handle a difficult situation at work?
[Mina - Applicant]: I stay calm, ask questions, and explain the next steps politely.
[Alex - Interviewer]: That is helpful. What would you like to know about this role?
[Mina - Applicant]: What would success look like during the first three months?
[Alex - Interviewer]: We would like the new person to learn the team process and support our customers.
[Mina - Applicant]: That sounds like a good fit for my experience.`,
  },
  {
    id: 'grocery',
    icon: '🛒',
    title: { en: 'At the grocery store', bn: 'মুদি দোকানে কেনাকাটা' },
    category: { en: 'Food & shopping', bn: 'খাবার ও কেনাকাটা' },
    description: {
      en: 'Find an item, ask about fresh produce, and check out politely.',
      bn: 'জিনিস খুঁজুন, টাটকা খাবার সম্পর্কে জিজ্ঞেস করুন এবং ভদ্রভাবে বিল দিন।',
    },
    dialogue: `[Nora - Shopper]: Excuse me. Where can I find the whole-grain bread?
[Leo - Shop assistant]: It is in the bakery section, near the fresh rolls.
[Nora - Shopper]: Thank you. Are these apples sweet or a little sour?
[Leo - Shop assistant]: They are sweet, and they arrived this morning.
[Nora - Shopper]: I will take four apples and one loaf of bread.
[Leo - Shop assistant]: Would you like a paper bag for those?
[Nora - Shopper]: Yes, please. I also need a carton of milk.
[Leo - Shop assistant]: The milk is in the cooler at the end of this aisle.
[Nora - Shopper]: I found it. Is there a checkout with a shorter line?
[Leo - Shop assistant]: The express checkout is open beside the entrance.
[Nora - Shopper]: Great. Can I pay with my phone?
[Leo - Shop assistant]: Yes. Please scan the code when you are ready.`,
  },
  {
    id: 'airport',
    icon: '🛫',
    title: { en: 'At the airport', bn: 'বিমানবন্দরে' },
    category: { en: 'Travel & transport', bn: 'ভ্রমণ ও যাতায়াত' },
    description: {
      en: 'Check in for a flight, ask about your gate, and find your seat.',
      bn: 'ফ্লাইটে চেক-ইন করুন, গেটের খবর নিন এবং নিজের আসন খুঁজুন।',
    },
    dialogue: `[Maya - Passenger]: Good morning. I would like to check in for flight 208.
[Owen - Agent]: Certainly. May I see your passport and booking number?
[Maya - Passenger]: Here they are. I have one suitcase to check.
[Owen - Agent]: Thank you. Would you prefer an aisle or a window seat?
[Maya - Passenger]: A window seat, if one is available.
[Owen - Agent]: I can offer you seat 18A. Here is your boarding pass.
[Maya - Passenger]: Thank you. Which gate should I go to?
[Owen - Agent]: Gate 14. It opens at ten thirty.
[Maya - Passenger]: How long does it take to walk there?
[Owen - Agent]: About eight minutes. Follow the blue signs.
[Maya - Passenger]: Is there time to get some water first?
[Owen - Agent]: Yes, there is a shop just past the security area.`,
  },
  {
    id: 'work-small-talk',
    icon: '💬',
    title: { en: 'Talking with a coworker', bn: 'সহকর্মীর সঙ্গে কথা বলা' },
    category: { en: 'Work & conversation', bn: 'কাজ ও কথোপকথন' },
    description: {
      en: 'Start a friendly conversation, share a project update, and agree on a next step.',
      bn: 'বন্ধুত্বপূর্ণ আলাপ শুরু করুন, কাজের খবর দিন এবং পরের পদক্ষেপ ঠিক করুন।',
    },
    dialogue: `[Ari - Coworker]: Hi, Sam. How was your weekend?
[Sam - Coworker]: It was relaxing. I visited the park with my family.
[Ari - Coworker]: That sounds nice. Did you finish the project notes?
[Sam - Coworker]: I finished the first draft this morning.
[Ari - Coworker]: Great. Could you share it with me after lunch?
[Sam - Coworker]: Of course. I would appreciate your feedback.
[Ari - Coworker]: I can review the introduction and the schedule.
[Sam - Coworker]: That would help. I will check the budget section.
[Ari - Coworker]: Shall we meet for ten minutes tomorrow?
[Sam - Coworker]: Yes, let us meet at nine thirty.
[Ari - Coworker]: I will send a calendar invitation now.
[Sam - Coworker]: Thanks. I will bring the updated notes.`,
  },
  {
    id: 'phone-appointment',
    icon: '📞',
    title: { en: 'Booking an appointment by phone', bn: 'ফোনে সময় নেওয়া' },
    category: { en: 'Phone calls', bn: 'ফোনে কথা বলা' },
    description: {
      en: 'Ask for an available time, confirm your details, and repeat the appointment.',
      bn: 'ফাঁকা সময় জিজ্ঞেস করুন, তথ্য নিশ্চিত করুন এবং সময়টি আবার বলে নিন।',
    },
    dialogue: `[Tara - Caller]: Hello. I would like to book an appointment for Friday.
[Ben - Receptionist]: Certainly. Is morning or afternoon better for you?
[Tara - Caller]: Afternoon would be easier, if possible.
[Ben - Receptionist]: We have an opening at two fifteen.
[Tara - Caller]: That works. May I have the address, please?
[Ben - Receptionist]: We are at 24 Lake Road, beside the post office.
[Tara - Caller]: Thank you. Do I need to bring anything?
[Ben - Receptionist]: Please bring your booking reference and a photo ID.
[Tara - Caller]: Let me confirm: Friday at two fifteen.
[Ben - Receptionist]: That is correct. Your appointment is booked.
[Tara - Caller]: Great. Could you send me a reminder by text?
[Ben - Receptionist]: Of course. I will send one shortly.`,
  },
  {
    id: 'returning-item',
    icon: '📦',
    title: { en: 'Returning an item', bn: 'কেনা জিনিস ফেরত দেওয়া' },
    category: { en: 'Shopping & service', bn: 'কেনাকাটা ও সেবা' },
    description: {
      en: 'Explain a problem calmly, show your receipt, and ask about your options.',
      bn: 'শান্তভাবে সমস্যা জানান, রসিদ দেখান এবং কী করা যায় জিজ্ঞেস করুন।',
    },
    dialogue: `[Nina - Customer]: Hello. I bought this lamp here last week.
[Kai - Assistant]: I can help. What seems to be the problem?
[Nina - Customer]: It turns off after a few minutes.
[Kai - Assistant]: I am sorry about that. Do you have the receipt?
[Nina - Customer]: Yes, it is right here.
[Kai - Assistant]: Thank you. Would you prefer an exchange or a refund?
[Nina - Customer]: Could I exchange it for another one?
[Kai - Assistant]: Certainly. We can test the new lamp before you leave.
[Nina - Customer]: That would be helpful. Is the blue model available?
[Kai - Assistant]: Yes, we have one in stock.
[Nina - Customer]: Great. Could you please write the exchange on my receipt?
[Kai - Assistant]: Of course. Here is your receipt and the new lamp.`,
  },
  {
    id: 'library',
    icon: '📚',
    title: { en: 'At the library', bn: 'লাইব্রেরিতে' },
    category: { en: 'Learning & community', bn: 'শেখা ও কমিউনিটি' },
    description: {
      en: 'Ask for a book, learn how borrowing works, and find a quiet place to study.',
      bn: 'বই খুঁজুন, ধার নেওয়ার নিয়ম জানুন এবং পড়ার শান্ত জায়গা খুঁজুন।',
    },
    dialogue: `[Iris - Visitor]: Hello. I am looking for a beginner English storybook.
[Noah - Librarian]: The language-learning shelf is on your left.
[Iris - Visitor]: Thank you. Can I borrow two books at a time?
[Noah - Librarian]: Yes. Your library card allows up to five books.
[Iris - Visitor]: How long may I keep them?
[Noah - Librarian]: You can keep them for three weeks.
[Iris - Visitor]: Is there a quiet place where I can study?
[Noah - Librarian]: The study room is upstairs beside the windows.
[Iris - Visitor]: Do I need to book a seat?
[Noah - Librarian]: No, but the room closes at six this evening.
[Iris - Visitor]: I will borrow this book and find a seat.
[Noah - Librarian]: Please scan your card at the desk before you go.`,
  },
  {
    id: 'renting-room',
    icon: '🏠',
    title: { en: 'Viewing a room to rent', bn: 'ভাড়ার ঘর দেখা' },
    category: { en: 'Home & neighborhood', bn: 'বাড়ি ও প্রতিবেশ' },
    description: {
      en: 'Ask about rent, included costs, house rules, and the move-in date.',
      bn: 'ভাড়া, খরচ, বাড়ির নিয়ম এবং ওঠার তারিখ সম্পর্কে জিজ্ঞেস করুন।',
    },
    dialogue: `[Eli - Visitor]: Hello. Thank you for showing me the room.
[Mina - Owner]: You are welcome. Please take a look around.
[Eli - Visitor]: Is the desk and wardrobe included?
[Mina - Owner]: Yes, both are included with the room.
[Eli - Visitor]: Are the water and internet bills part of the rent?
[Mina - Owner]: Internet is included. Water is shared between tenants.
[Eli - Visitor]: What time should everyone keep the house quiet?
[Mina - Owner]: We keep noise low after ten in the evening.
[Eli - Visitor]: When would the room be ready?
[Mina - Owner]: It will be ready from the first of next month.
[Eli - Visitor]: Could I send you my questions by email?
[Mina - Owner]: Certainly. I will give you my contact details.`,
  },
  {
    id: 'community-event',
    icon: '🎟️',
    title: { en: 'Joining a local event', bn: 'স্থানীয় অনুষ্ঠানে যোগ দেওয়া' },
    category: { en: 'Community & plans', bn: 'কমিউনিটি ও পরিকল্পনা' },
    description: {
      en: 'Ask about an event, invite a friend, and make a simple plan together.',
      bn: 'অনুষ্ঠানের কথা জিজ্ঞেস করুন, বন্ধুকে আমন্ত্রণ জানান এবং একসঙ্গে পরিকল্পনা করুন।',
    },
    dialogue: `[Ava - Neighbor]: Have you heard about the music evening on Saturday?
[Rafi - Neighbor]: I saw a notice. Where is it taking place?
[Ava - Neighbor]: At the community hall, next to the small park.
[Rafi - Neighbor]: What time does it start?
[Ava - Neighbor]: The doors open at six, and the music starts at seven.
[Rafi - Neighbor]: Do we need to buy tickets in advance?
[Ava - Neighbor]: No, we can get them at the entrance.
[Rafi - Neighbor]: Would you like to go together?
[Ava - Neighbor]: Yes, that would be lovely.
[Rafi - Neighbor]: I can meet you outside the park at half past six.
[Ava - Neighbor]: Perfect. I will bring a light jacket.
[Rafi - Neighbor]: Great. I will see you there on Saturday.`,
  },
];
