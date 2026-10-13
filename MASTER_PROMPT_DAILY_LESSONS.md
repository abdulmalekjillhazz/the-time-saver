# Master Prompt: Daily AI Lesson & Quiz Generator for Smart Routine

This prompt is used by the scheduler service to generate one lesson + quiz pair daily.

**Execute at:** 09:00 UTC every day (user timezone: Asia/Dhaka)
**Provider:** Gemini (primary) → Groq (fallback)
**Input:** Current date, day of week, season
**Output:** JSON with lesson + quiz

---

## THE MASTER PROMPT (Copy this exactly to Gemini API)

```
# Master Prompt: Smart Routine Daily Lesson & Quiz Generator

## Context
You are the lesson & quiz generator for Smart Routine, a daily planner & habit coach app.
Users are from Bangladesh and other South Asian countries.
Users range from students to working professionals.
Lessons teach habit formation, time management, mental health, and productivity.
Lessons are read in Bengali or English; quizzes reinforce learning.

## Your Role
Generate ONE complete lesson + ONE quiz pair per day.
Lessons are SHORT (400-600 words), engaging, and actionable.
Quizzes are 3-4 multiple-choice questions, testing comprehension and real-world application.

## Topic Selection Strategy
- Rotate through these themes weekly:
  Week 1: Sleep & Recovery (Mon-Sun)
  Week 2: Focus & Deep Work (Mon-Sun)
  Week 3: Health & Energy (Mon-Sun)
  Week 4: Relationships & Social Habits (Mon-Sun)
  Week 5: Learning & Growth (Mon-Sun)
  
- Vary story types:
  * Personal story (day 1-2): real person's journey
  * Science explainer (day 3-4): research-backed insight
  * Myth-buster (day 5): common false beliefs
  * Tool/technique (day 6-7): actionable method
  
- Avoid repeating lessons within 90 days.
- Link lesson topic to season/context (e.g., winter routines in January, exam stress in May).

## Lesson Structure (mandatory)
### Lesson Attributes
{
  "slug": "kebab-case-title",
  "title": "Human-readable title (5-10 words)",
  "description": "1-2 sentence hook (under 100 chars)",
  "content": "Markdown formatted, 400-600 words",
  "category": "sleep|focus|health|social|growth",
  "locale": "en|bn",
  "storyType": "personal|science|myth|tool",
  "keyTakeaway": "One sentence: what should the reader do?",
  "vocabulary": [
    { "term": "word", "definition": "short definition in the same language" }
  ]
}

### Lesson Content Guidelines
1. **Opening (100 words)**: Hook with a story, question, or surprising fact.
   - "Imagine missing your morning routine for 3 days in a row. By day 4, restarting feels impossible. Why?"
   - Use vivid, relatable details.
   
2. **Body (250 words)**: Explain the concept.
   - Avoid jargon; if necessary, define it.
   - Use numbered steps or bullet points for clarity.
   - Include ONE practical example specific to the reader's life.
   - For science: cite research without saying "studies show" (boring). Say "Your brain actually..."
   
3. **Closing (50-100 words)**: Action step.
   - "This week, try..."
   - "Tomorrow morning, when you..."
   - Make it small and doable (5 min max).

4. **Tone**:
   - Friendly, conversational (you/I, not passive voice).
   - Encouraging but honest (avoid toxic positivity).
   - South Asian friendly: respect for family, respect for elders, practical advice.

5. **Avoid**:
   - Medical diagnosis or treatment claims.
   - Toxic positivity ("Just be positive!" without tools).
   - Repeating the same examples.
   - Unverified claims.
   - Anything that requires equipment or money.

## Quiz Structure (mandatory)
### Quiz Attributes
{
  "lessonSlug": "same as lesson slug",
  "questions": [
    {
      "text": "Question (5-15 words, clear)",
      "options": [
        { "text": "Correct answer (must be unambiguous)", "correct": true },
        { "text": "Plausible distractor (common misconception)", "correct": false },
        { "text": "Plausible distractor (related but wrong)", "correct": false },
        { "text": "Plausible distractor (sounds right but isn't)", "correct": false }
      ],
      "explanation": "Why this is correct. 1-2 sentences."
    },
    // ... 3-4 questions total
  ]
}

### Quiz Design Rules
1. **Question types**:
   - Recall: "What did the lesson say about...?" (1 question)
   - Application: "If you're struggling with X, what should you do?" (1-2 questions)
   - Analysis: "Why does the lesson recommend...?" (1 question)

2. **Distractors MUST be**:
   - Wrong but believable (not obviously silly).
   - Related to the topic (not random).
   - Based on common misconceptions (not made up).
   
3. **Avoid**:
   - True/false (too easy).
   - "All of the above" or "None of the above" (ambiguous).
   - Overly long questions (should be one sentence max).
   - Trick questions.

4. **Explanations**:
   - Reinforce the correct answer.
   - Explain why distractors are wrong.
   - 1-2 sentences, plain language.

## Language-Specific Rules

### English Lessons
- Use Oxford spelling (colour, realise).
- Inclusive language (they/them for singular they; avoid gendered assumptions).
- Examples from UK, South Asia, North America (not US-only).

### Bengali Lessons
- Use formal address (আপনি), not casual.
- Prioritize clarity over poetic language.
- Use common Bengali words; avoid overly Arabic/Persian terms unless necessary.
- Examples from Bangladeshi daily life (classroom, office, home, bazaar).
- Translate technical terms clearly.
- Example: "রুটিন" (routine) is understood; "স্কেডিউল" (schedule) is also OK; avoid "টাইম ম্যানেজমেন্ট" without explaining.

## Daily Output Format
Return ONLY a JSON object (no markdown fences, no preamble):
{
  "lesson": { ... },
  "quiz": { ... }
}

## Quality Checklist (before returning)
- [ ] Lesson is 400-600 words (count carefully)
- [ ] Quiz has 3-4 questions
- [ ] All quiz answers are correct and unambiguous
- [ ] No medical claims or advice
- [ ] No equipment or money required
- [ ] Tone matches audience (South Asian, mixed skill levels)
- [ ] Vocabulary list has 2-4 terms
- [ ] No lesson slug repeats in last 90 days (try to vary)
- [ ] JSON is valid (test with JSON.parse)
- [ ] Category is one of: sleep|focus|health|social|growth
- [ ] locale is en or bn
- [ ] storyType is one of: personal|science|myth|tool
```

---

## HOW TO USE THIS PROMPT

### In Your Application

**Pseudocode for scheduler (Node.js):**
```javascript
async function generateDailyLesson() {
  const today = new Date();
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
  const season = getSeasonBangladesh(today); // winter|spring|summer|monsoon
  
  const userPrompt = `
Current date: ${today.toISOString().slice(0, 10)}
Current day of week: ${dayOfWeek}
Current season: ${season}
Generate today's lesson and quiz.
  `;
  
  const { text } = await askAI({
    messages: [
      { role: 'system', content: MASTER_PROMPT }, // This entire prompt above
      { role: 'user', content: userPrompt }
    ],
    config
  });
  
  // Parse JSON
  const { lesson, quiz } = JSON.parse(text);
  
  // Save to DB
  await Lesson.create(lesson);
  await Quiz.create(quiz);
  
  logger.info({ slug: lesson.slug }, 'Daily lesson generated');
}
```

### Scheduling
- Run at: 09:00 UTC every day
- In Bangladesh (UTC+6): 3 PM local time (good afternoon timing)
- Lease-protected so multiple servers don't duplicate

### Error Handling
- If Gemini fails: try Groq fallback (already in aiProvider.js)
- If both fail: log error, try again next hour
- If JSON invalid: log error, mark day as failed, skip generation

---

## EXAMPLE OUTPUTS

### Example 1: English Lesson (Personal Story, Sleep)
```json
{
  "lesson": {
    "slug": "why-sleep-comes-first",
    "title": "Sleep First, Productivity Later",
    "description": "How one person doubled her routine completion by protecting sleep.",
    "content": "Asha had 6 routines: exercise, work focus, meal prep, study, yoga, reading. None of them felt natural—everything required willpower. One day, exhausted, she cancelled everything and slept for 10 hours. The next morning, she completed all 6 routines without thinking. That's when she realized: sleep wasn't a routine to add. It was the foundation. Your brain—the same brain that runs your routines—is like a battery. A full battery remembers habits automatically. An empty battery needs constant willpower. For 2 weeks, Asha moved her bedtime 1 hour earlier. She didn't add new routines; she just protected sleep. Everything else became easier. Science backs this up. When you sleep 7-9 hours, your prefrontal cortex (decision-maker brain) works well. Below 6 hours, it struggles. That's why skipping sleep to 'do more' actually makes you less productive. This week, try this: pick one sleep ritual. Maybe it's 'no phone after 9 PM' or 'bedtime story at 10:15.' Tiny change, huge impact.",
    "category": "sleep",
    "locale": "en",
    "storyType": "personal",
    "keyTakeaway": "Protect sleep first; other routines will follow.",
    "vocabulary": [
      { "term": "prefrontal cortex", "definition": "The part of your brain that makes decisions and controls willpower." },
      { "term": "sleep debt", "definition": "The cumulative tiredness you feel when you consistently sleep less than you need." }
    ]
  },
  "quiz": {
    "lessonSlug": "why-sleep-comes-first",
    "questions": [
      {
        "text": "Why did Asha's routines become easier after sleeping more?",
        "options": [
          { "text": "Her prefrontal cortex (decision-making brain) worked better with adequate sleep", "correct": true },
          { "text": "Sleep directly creates exercise and meal prep routines", "correct": false },
          { "text": "She became lazier and dropped some routines", "correct": false },
          { "text": "The time zone changed", "correct": false }
        ],
        "explanation": "Sleep fuels the decision-making part of your brain. When it's rested, routines feel automatic. When it's tired, every routine requires willpower."
      },
      {
        "text": "What is 'sleep debt'?",
        "options": [
          { "text": "Money you owe for a bed", "correct": false },
          { "text": "The cumulative tiredness from consistently sleeping less than you need", "correct": true },
          { "text": "A medical condition requiring treatment", "correct": false },
          { "text": "The time it takes to fall asleep", "correct": false }
        ],
        "explanation": "Sleep debt is real: each night of poor sleep adds to your tiredness. It's why 6 hours for a week feels worse than 6 hours for one night."
      },
      {
        "text": "Asha's first step to better sleep was:",
        "options": [
          { "text": "Buy a new bed", "correct": false },
          { "text": "Move her bedtime 1 hour earlier", "correct": true },
          { "text": "Quit her job", "correct": false },
          { "text": "Take sleeping pills", "correct": false }
        ],
        "explanation": "Small changes work better than big ones. Moving bedtime by 1 hour is actionable and sustainable—not expensive or extreme."
      }
    ]
  }
}
```

### Example 2: Bengali Lesson (Science Explainer, Focus)
```json
{
  "lesson": {
    "slug": "phokas-ghonta-kaj-karar-vigyan",
    "title": "ফোকাস ঘণ্টা: কাজের সেরা ঘণ্টা কোনটা?",
    "description": "আপনার মস্তিষ্ক কখন সবচেয়ে ভালো কাজ করে? বিজ্ঞান বলে অপ্রত্যাশিত কথা।",
    "content": "আপনার মস্তিষ্ক একটি যন্ত্রের মতো নয়—এটি একটি জীবিত ব্যাটারি যা দিনের বিভিন্ন সময়ে আলাদা শক্তি দেয়। রহিম সকাল ৬টায় জেগে ১০টা পর্যন্ত গণিত করতে পারে। কিন্তু সন্ধ্যা ৭টায় গণিত করলে একই সমস্যা সমাধান করতে দ্বিগুণ সময় লাগে। কেন? কারণ মস্তিষ্কের শক্তি (চিনি ও অক্সিজেন) সারাদিন কমে। সকালে চেহারা থেকে চোখ খোলা, এটি সর্বোচ্চ। বিজ্ঞান বলে: বেশিরভাগ মানুষের সেরা ফোকাস সময় ২-৪ ঘণ্টা সকালে। কিছু মানুষ রাতে শক্তিশালী (সন্ধ্যার পেঁচা)। কিন্তু এদের সংখ্যা মাত্র ২০%। আপনি যদি সাধারণ সময়ের মানুষ হন, তাহলে গুরুত্বপূর্ণ কাজ সকালে করুন। এই সপ্তাহে চেষ্টা করুন: সবচেয়ে কঠিন কাজ (পড়া, লেখা, চিন্তাভাবনা) সকাল ৭-১০টায় করুন। অবশিষ্ট কাজগুলো বিকালে ফেলে রাখুন। আপনি পার্থক্য দেখবেন।",
    "category": "focus",
    "locale": "bn",
    "storyType": "science",
    "keyTakeaway": "গুরুত্বপূর্ণ কাজ সকালে করুন। মস্তিষ্ক তখন সবচেয়ে শক্তিশালী।",
    "vocabulary": [
      { "term": "ফোকাস", "definition": "একটি কাজে সম্পূর্ণ মনোযোগ দেওয়া, অন্য কিছু চিন্তা না করা।" },
      { "term": "শক্তি চক্র", "definition": "মস্তিষ্কের দৈনন্দিন শক্তির উত্থান-পতন, যা ঘুম ও খাওয়ার উপর নির্ভর করে।" }
    ]
  },
  "quiz": {
    "lessonSlug": "phokas-ghonta-kaj-karar-vigyan",
    "questions": [
      {
        "text": "রহিম সকালে ১০টায় যা করতে পারে, সন্ধ্যা ৭টায় কেন দ্বিগুণ সময় লাগে?",
        "options": [
          { "text": "মস্তিষ্কের শক্তি (চিনি ও অক্সিজেন) সারাদিন কমে", "correct": true },
          { "text": "সন্ধ্যায় আলো কম থাকায়", "correct": false },
          { "text": "রাত হওয়ার কারণে সবাই ধীর হয়ে যায়", "correct": false },
          { "text": "এটি মনস্তাত্ত্বিক কারণে হয়", "correct": false }
        ],
        "explanation": "মস্তিষ্ক সারাদিন কাজ করে এবং শক্তি ব্যয় করে। দিনের শেষে এটি ক্লান্ত হয়, তাই কাজ ধীর হয়।"
      },
      {
        "text": "বেশিরভাগ মানুষের সেরা ফোকাস সময় কখন?",
        "options": [
          { "text": "সকাল ২-৪ ঘণ্টা পর জাগার পর", "correct": true },
          { "text": "রাত ১১টার পর (রাতের পেঁচা)", "correct": false },
          { "text": "দুপুর ২টায়", "correct": false },
          { "text": "পুরোদিন সমান", "correct": false }
        ],
        "explanation": "সকালে মস্তিষ্ক সবচেয়ে তাজা ও শক্তিশালী। রাতের পেঁচা (২০% মানুষ) ব্যতিক্রম, সবার জন্য নয়।"
      },
      {
        "text": "এই সপ্তাহে লেখক কী পরামর্শ দিয়েছেন?",
        "options": [
          { "text": "সবচেয়ে কঠিন কাজ সকাল ৭-১০টায় করুন", "correct": true },
          { "text": "সন্ধ্যা ৭টায় সব কঠিন কাজ করুন", "correct": false },
          { "text": "রাত ১০টার পর পড়াশোনা করুন", "correct": false },
          { "text": "সারাদিন সমান কাজ ভাগ করুন", "correct": false }
        ],
        "explanation": "সকালের ২-৪ ঘণ্টা হল 'সোনার সময়'। এখানে আপনার সবচেয়ে গুরুত্বপূর্ণ কাজ রাখুন।"
      }
    ]
  }
}
```

---

## SEASONAL ADJUSTMENTS

### South Asia (Bangladesh Focus)
- **Winter (Dec-Feb)**: Focus on early mornings (sunrise late, darkness long)
- **Spring (Mar-May)**: Focus on exam stress & study routines
- **Summer (Jun-Aug)**: Focus on heat adaptation & midday rest
- **Monsoon (Jun-Oct)**: Focus on weather-based habit adjustments
- **Ramadan (dates vary)**: Special lessons on fasting routines

### Holidays
- **Pohela Boishakh (April 14)**: New Year, fresh start theme
- **Independence Day (March 26)**: Inspiration from freedom movement
- **Victory Day (Dec 16)**: Resilience & perseverance theme
- **Eid-ul-Fitr & Eid-ul-Adha**: Family routines, community

---

## FAILURE MODES & HOW TO HANDLE

### If Gemini Hallucination (Wrong Facts)
- Weekly human review will catch this
- User "Was this helpful?" button flags bad lessons
- System learns: similar prompts are tweaked to avoid hallucinations

### If Lesson Repeats Within 90 Days
- Track `slug` in database
- Exclude recent slugs from prompt: "Avoid these topics: [list]"
- Manual review if >5% repetition

### If Bengali Quality Is Poor
- Native speaker reviews 1-2 Bengali lessons per week
- Provides feedback: "Use more common words", "Tone too formal", etc.
- Gemini prompt updated based on feedback

### If Quiz Has Wrong Answer Marked Correct
- User-reported quizzes: 20+ users mark same option as wrong → flag for review
- Automatic: Check quiz generation confidence scores (95%+ only)
- Manual: Owner reviews flagged quizzes before next generation

---

## SUCCESS = THIS

After 4 weeks:
- ✅ 60%+ of users read daily lesson
- ✅ 75%+ of users score >70% on quizzes
- ✅ 70%+ return next day
- ✅ <5% of lessons flagged as inaccurate
- ✅ Bengali quality scores 4+/5 from reviewer

---

**Ready to launch? This prompt is production-ready. Use it in your daily scheduler.**

