# Feature 2: Daily AI Lesson & Quiz Generator — Implementation Guide

## Overview
This feature implements the complete automated Daily AI Lesson & Quiz system for Smart Routine. Every day at 09:00 UTC (15:00 Asia/Dhaka local time), the system automatically generates an engaging, high-retention micro-lesson (400–600 words) accompanied by a 3–4 question multiple-choice quiz in both Bengali (বাংলা) and English.

The content follows a 5-week rotating thematic curriculum (Sleep, Focus, Health, Social Habits, and Growth) tailored to South Asian learners and calibrated to local seasonal contexts in Bangladesh.

---

## What's New

### 1. Models
- **DailyLesson** (`server/src/models/DailyLesson.js`)
  - Stores daily generated lessons with `date` (YYYY-MM-DD), `slug`, `title`, `description`, `content` (markdown), `category`, `locale` (`en` | `bn`), `storyType`, `keyTakeaway`, `vocabulary`, and `quizId`.
  - Compound unique index: `{ date: 1, locale: 1 }` guarantees exactly one lesson per date per locale under concurrency.
  - Unique index: `{ slug: 1 }`.
  - Recency index: `{ date: -1 }`.

- **Quiz** (`server/src/models/Quiz.js`)
  - Stores multiple-choice questions linked to each daily lesson (`dailyLessonId`, `lessonSlug`).
  - Questions contain 4 options, clear distractors, marked correct answers, and 1–2 sentence explanatory rationales.
  - Linked to `DailyLesson` via `quizId`.

- **DailyQuizScore** (`server/src/models/DailyQuizScore.js`)
  - Records user quiz attempts, submitted answers, calculated scores, and completion timestamps.
  - Indexed by `{ userId: 1, quizId: 1, attemptedAt: -1 }`.

---

### 2. Services
- **dailyLesson** (`server/src/services/dailyLesson.js`)
  - **Master Prompt Integration**: Incorporates the full production prompt with strict constraints (400–600 words, no equipment/money required, no medical diagnosis, Oxford spelling in English, respectful formal Bengali).
  - `getSeasonBangladesh(date)`: Calculates local Bangladeshi seasons (Winter, Spring, Summer, Monsoon/Post-monsoon).
  - `getThemeForDate(date)`: Calculates the 5-week thematic rotation (Sleep & Recovery, Focus & Deep Work, Health & Energy, Relationships & Social Habits, Learning & Growth).
  - `getStoryTypeForDate(date)`: Rotates story formats across days (Mon–Tue: Personal story, Wed–Thu: Science explainer, Fri: Myth-buster, Sat–Sun: Actionable tool/technique).
  - `generateDailyLesson()`: Formulates structured prompts, calls `askAI` (Gemini primary, Groq fallback) with `maxTokens: 2048`, parses JSON, validates schema, checks options, ensures slug uniqueness, and saves to MongoDB.
  - `getTodayDailyLesson()`: Retrieves the current day's lesson (or most recent fallback) and provides a sanitized learner view of the quiz (stripping answer keys).
  - `submitDailyQuizAttempt()`: Evaluates user answer indices against the question key, saves a `DailyQuizScore` record, and returns detailed question-by-question results and explanations.
  - `formatQuizForLearner()`: Defensive utility that strips internal answer indices and boolean flags from public API payloads.

- **aiProvider Enhancement** (`server/src/services/aiProvider.js`)
  - Added configurable `maxTokens` (default: 700) and `temperature` (default: 0.4) so long lesson payloads up to 2048 tokens do not get truncated mid-generation.

---

### 3. Scheduler Integration
- **Enhanced Scheduler** (`server/src/services/scheduler.js`)
  - Executes every minute tick; evaluates `isDailyLessonScheduledTime(now)` at 09:00 UTC (15:00 Asia/Dhaka).
  - Protected by a 23-hour distributed lease (`daily-ai-lesson-generation`) preventing duplicate generation across multi-instance clusters.
  - Sequentially generates daily lessons for both `bn` and `en` locales.
  - Logs batch status with count of successful and failed generations.

---

### 4. API Endpoints
- **GET `/api/lessons/today`**
  - Publicly accessible (with optional authenticated session detection).
  - Query params: `locale` (`en` | `bn`), optional `date` (`YYYY-MM-DD`).
  - Feature-flag gated (`lessons.daily`).
  - Returns today's lesson object and learner-safe quiz without answer keys.

- **POST `/api/lessons/today/attempts`**
  - Requires authentication and CSRF token.
  - Rate-limited (20 requests/min per user).
  - Body: `{ answers: [0, 2, 1, 3], date?: 'YYYY-MM-DD' }`.
  - Scores answers, saves `DailyQuizScore`, and returns score, total, and explanations.

- **POST `/api/lessons/daily/generate`**
  - Admin/Owner/Editor endpoint to manually trigger generation on-demand.
  - Body: `{ date?: 'YYYY-MM-DD', locale?: 'en' | 'bn', force?: boolean }`.
  - Supports `force: true` to regenerate and overwrite existing lessons.

- **GET `/api/quizzes/latest`**
  - Returns the latest quiz for the requested locale.

- **POST `/api/quizzes/:id/attempts`**
  - Submits quiz answers by quiz ID.

---

### 5. Client Integration
- **API Client** (`client/lib/api.js`)
  - Added `getTodayLesson(locale)` and `getLatestQuiz(locale)`.
- **DailyLessonCard Component** (`client/components/DailyLessonCard.jsx`)
  - Responsive, bilingual UI card rendering today's lesson hook, content paragraphs, key takeaway banner, and vocabulary definitions.
  - Interactive quiz with option selection, submission handling, instant score display, and detailed answer explanations.
- **Lessons Page** (`client/app/(public)/[lang]/lessons/page.jsx`)
  - Prominently showcases `DailyLessonCard` at the top of the lessons directory.

---

### 6. Shared Schemas & Flags
- **Flags** (`shared/src/flags.js`)
  - Added `lessons.daily` flag default (`enabled: false, rolloutPercent: 0`).
- **Schemas** (`shared/src/schemas/lessons.js`)
  - Added `dailyLessonItemSchema`, `dailyQuizOptionSchema`, `dailyQuizQuestionSchema`, `dailyQuizItemSchema`, `dailyLessonPayloadSchema`, and `dailyQuizAttemptSchema`.

---

## Testing

### Unit Tests (`server/tests/unit/dailyLesson.test.js`)
- Validates Bangladeshi seasonal calculation across all calendar months.
- Validates 5-week thematic rotation and daily story type rotation.
- Validates markdown code fence stripping and JSON parsing.
- Validates quiz option validation and answer key stripping.

### Integration Tests (`server/tests/integration/dailyLessons.test.js`)
- Validates feature flag gating (403 `FEATURE_DISABLED` when off).
- Tests end-to-end generation and DB persistence.
- Tests `GET /api/lessons/today` sanitization.
- Tests `POST /api/lessons/today/attempts` scoring and score history recording.
- Tests idempotency when generation is called multiple times.

---

## How to Use

### 1. Enable the Feature Flag (Admin)
```bash
POST /api/admin/flags/lessons.daily
{
  "enabled": true,
  "rolloutPercent": 100
}
```

### 2. Manual Generation (Admin)
```bash
POST /api/lessons/daily/generate
{
  "date": "2026-10-12",
  "locale": "bn",
  "force": false
}
```

### 3. Fetch Today's Lesson
```bash
GET /api/lessons/today?locale=bn
```

### 4. Submit Quiz Attempt
```bash
POST /api/lessons/today/attempts
{
  "answers": [0, 2, 1, 3]
}
```

---

## File Manifest

```
shared/src/
  ├── flags.js ......................... Added lessons.daily flag
  └── schemas/lessons.js ............... Added Zod schemas for daily lessons & quizzes

server/src/
  ├── app.js ........................... Mounted quizzesRouter and passed config to lessonsRouter
  ├── models/
  │   ├── DailyLesson.js ............... NEW: MongoDB model for daily lessons
  │   ├── Quiz.js ...................... NEW: MongoDB model for quizzes
  │   └── DailyQuizScore.js ............ NEW: MongoDB model for quiz attempts
  ├── services/
  │   ├── dailyLesson.js ............... NEW: Core AI generation, parsing, scoring service
  │   ├── aiProvider.js ................ Updated: configurable maxTokens (2048) & temperature
  │   └── scheduler.js ................. Updated: 09:00 UTC daily generation job
  └── routes/
      ├── lessons.js ................... Updated: added /today, /today/attempts, /daily/generate
      └── quizzes.js ................... NEW: added /latest, /:id/attempts

client/
  ├── lib/api.js ....................... Updated: added getTodayLesson & getLatestQuiz
  ├── components/DailyLessonCard.jsx ... NEW: Interactive bilingual daily lesson & quiz card
  └── app/(public)/[lang]/lessons/
      └── page.jsx ..................... Updated: integrated DailyLessonCard

server/tests/
  ├── unit/dailyLesson.test.js ......... NEW: Pure logic unit tests
  └── integration/dailyLessons.test.js . NEW: End-to-end integration tests
```

---

**Feature Status**: ✅ Complete, Tested & Production-Ready  
**Version**: 4.1  

---

## Quality Mitigations & Success Metrics (Phase 2 Additions)

### 1. Hallucination Mitigation & User Feedback Loop
- **Model**: `DailyLessonFeedback` (`server/src/models/DailyLessonFeedback.js`)
- **Interactive UI**: "Was this helpful?" and "Was this accurate?" buttons on `DailyLessonCard.jsx`.
- **API**: `POST /api/lessons/today/feedback`.
- **Automated Gatekeeper**: If 3 or more users flag a lesson as inaccurate (`accurate: false`), the lesson is automatically marked with `flaggedForReview: true` and `flagReason: 'Flagged by X users as inaccurate'`, notifying editorial reviewers and suppressing unverified content.

### 2. Topic Repetition Mitigation
- **Slugs Avoidance**: `generateDailyLesson` queries existing lesson slugs from the last 90 days and includes the last 30 slugs in the Gemini prompt under `Recent lesson slugs to avoid: [slugs]`.

### 3. Quiz Question & Distractor Reporting
- **Model**: `QuizReport` (`server/src/models/QuizReport.js`)
- **Interactive UI**: 🚩 report button next to each quiz question in `DailyLessonCard.jsx`.
- **API**: `POST /api/quizzes/:id/report`.
- **Automated Gatekeeper**: When user reports on a quiz question reach threshold (e.g. 10+ reports), the quiz is automatically marked `flaggedForReview: true` for editorial review.

### 4. Share Rate Tracking
- **API**: `POST /api/lessons/today/share` increments `shareCount` on `DailyLesson`.
- **UI**: Copy-link share button with feedback confirmation.

### 5. Success Metrics Engine
- **Endpoint**: `GET /api/lessons/metrics` computes the 5 key product indicators:
  1. **Completion rate**: Total quiz attempts and active learner completions.
  2. **Quiz accuracy**: % of attempts scoring 75%+ (`(score / total) >= 0.75`).
  3. **Return rate**: Recurrent learner engagement across successive days.
  4. **Share rate**: Total shares logged across all lessons.
  5. **Feedback score**: Average helpfulness rating (target: 4.0+/5) and % helpful feedback.
