# Feature 1: Weekly AI Summary — Implementation Guide

## Overview
This feature generates bilingual (English + Bangla) AI-powered summaries of a user's routine performance every Sunday. Summaries highlight which habits are strong, which are weak, and provide one actionable suggestion for the next week.

## What's New

### Models
- **WeeklySummary** (`server/src/models/WeeklySummary.js`)
  - Stores generated summaries with week-end date, locale, and content
  - Unique index: (userId, weekEndDate, locale) — prevents duplicates
  - Indexed for fast retrieval by user and date

### Services
- **weeklySummary** (`server/src/services/weeklySummary.js`)
  - `generateSummary()` — Calls Gemini/Groq AI with completion data and routines
  - `getWeekEndDate()` — Calculates the Sunday of a given week
  - `shouldGenerateWeeklySummary()` — Checks if summary should be auto-generated (only on Sundays, if no summary exists)
  - Bilingual system prompts (en/bn) guide the AI to provide relevant coaching

### Routes
- **summaries** (`server/src/routes/summaries.js`)
  - `GET /api/summaries` — Fetch latest summary for user's locale (or null + message)
  - `POST /api/summaries/generate` — Manually trigger summary generation (idempotent)
  - Both endpoints: feature-flag gated, rate-limited, auth-required

### Scheduler Integration
- Weekly summary batch generation runs once per 24 hours (lease-protected)
- Iterates all users; checks if Sunday + flag enabled + no existing summary
- Gracefully handles failures per user; doesn't stop batch if one fails
- Logged with count of generated and failed summaries

### Tests
- **Integration tests** (`server/tests/integration/summaries.test.js`)
  - Flag gating (403 when disabled)
  - Manual generation and idempotency
  - Locale preference handling
  - Requires MONGODB_URI_TEST and GEMINI_API_KEY
  
- **Unit tests** (`server/tests/unit/weeklySummary.test.js`)
  - `getWeekEndDate()` across boundaries (months, years, leap years)
  - Pure logic, no database required

## Feature Flag
- **Key:** `summaries.weekly`
- **Default:** `enabled: false, rolloutPercent: 0` (OFF)
- **Enable with:** Admin endpoint (owner only) or direct DB edit
- Example: `PATCH /api/admin/flags/summaries.weekly` with `{ enabled: true, rolloutPercent: 100 }`

## How to Use

### For End Users
1. **Enable the feature** (admin):
   - Go to admin panel (requires owner role)
   - Find "summaries.weekly" in feature flags
   - Set `enabled: true` and `rolloutPercent` (e.g., 100 for all users)

2. **Read a summary**:
   - `GET /api/summaries` → returns latest summary or null
   - If null, show message: "No summary yet. Generate one or wait for Sunday."

3. **Generate manually**:
   - `POST /api/summaries/generate` → generates summary for current week
   - Safe to call multiple times (returns cached summary if it exists)

4. **Automatic generation**:
   - Every Sunday, scheduler auto-generates summary if:
     - User has flag enabled
     - No summary exists for that week yet
   - Generated at 09:00 UTC (configurable timezone per user)

### For Developers

#### Run Tests
```bash
# Unit tests (no DB required)
npm run test:unit -- server/tests/unit/weeklySummary.test.js

# Integration tests (requires MONGODB_URI_TEST and GEMINI_API_KEY)
npm run test:integration -- server/tests/integration/summaries.test.js
```

#### Trigger Summary Generation Manually
```bash
# Login as user, then:
curl -X POST http://localhost:5000/api/summaries/generate \
  -H "Cookie: sr_session=<token>; sr_csrf=<csrf>" \
  -H "X-CSRF-Token: <csrf>" \
  -H "Content-Type: application/json"
```

#### View Generated Summary
```bash
curl -X GET http://localhost:5000/api/summaries \
  -H "Cookie: sr_session=<token>; sr_csrf=<csrf>"
```

#### Enable Flag via Admin
```bash
# Login as owner, then:
curl -X POST http://localhost:5000/api/admin/flags/summaries.weekly \
  -H "Cookie: sr_session=<token>; sr_csrf=<csrf>" \
  -H "X-CSRF-Token: <csrf>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true, "rolloutPercent": 100 }'
```

## API Response Examples

### GET /api/summaries (with summary)
```json
{
  "summary": {
    "_id": "...",
    "userId": "...",
    "weekEndDate": "2026-10-18",
    "locale": "en",
    "content": "# Weekly Summary: Strong Habits & Next Steps\n\n## What Went Well\nYour **Work Focus** routine was rock-solid this week: 100% completed...",
    "generatedAt": "2026-10-18T10:30:00Z",
    "createdAt": "2026-10-18T10:30:00Z"
  }
}
```

### GET /api/summaries (no summary yet)
```json
{
  "summary": null,
  "message": {
    "en": "No summary yet. Generate one or wait for Sunday.",
    "bn": "এখনও কোনো সারসংক্ষেপ নেই। একটি তৈরি করুন বা রবিবারের জন্য অপেক্ষা করুন।"
  }
}
```

### POST /api/summaries/generate
```json
{
  "summary": {
    "_id": "...",
    "userId": "...",
    "weekEndDate": "2026-10-18",
    "locale": "en",
    "content": "...",
    "generatedAt": "2026-10-18T10:30:00Z",
    "createdAt": "2026-10-18T10:30:00Z"
  }
}
```

### Error: Feature Disabled (403)
```json
{
  "code": "FEATURE_DISABLED",
  "message": {
    "en": "Weekly summaries are not available yet.",
    "bn": "সাপ্তাহিক সারসংক্ষেপ এখনও পাওয়া যায় না।"
  }
}
```

## Data Flow

### Manual Generation
```
User → POST /api/summaries/generate
  ↓
Route: Check flag enabled? (403 if not)
  ↓
Service: Check if summary exists for this week? (return cached if yes)
  ↓
Service: Fetch last 7 days of completions + routines
  ↓
Service: Build context string (daily stats, routine completion rates)
  ↓
Service: Call askAI (Gemini primary, Groq fallback) with bilingual prompt
  ↓
Service: Save summary to DB
  ↓
Response: Return summary JSON → User reads in UI
```

### Automatic Generation (Scheduler)
```
Every 60 seconds, scheduler tick fires
  ↓
Check: Is it Sunday? Is lease available?
  ↓
For each user:
  - Check: Flag enabled? (skip if not)
  - Check: Summary exists for this week? (skip if yes)
  - Generate summary (same flow as manual above)
  ↓
Log: generated=5, failed=0
```

## Bilingual System Prompts

### English
Instructs AI to:
- Celebrate habits with 70%+ completion
- Explore weak habits (<50% completion)
- Provide one actionable suggestion for next week
- Keep it 200-300 words, friendly tone

### Bangla (বাংলা)
Same structure but:
- Uses formal address (আপনি)
- Asks for Bangla output
- Tailored for South Asian context
- 200-300 words, উষ্ণ টোন

## Known Limitations

1. **Gemini/Groq Dependent**: If both AI providers are down, summary generation fails gracefully (logs error, user sees 502)
2. **No Retroactive Generation**: Summaries only generate for current week (not past weeks)
3. **Timezone Considerations**: "Today" is computed in user's timezone, but "Sunday check" uses UTC. This is acceptable—most users won't trigger it at the exact boundary
4. **No Duplicate Check Across Locales**: A user could have both en and bn summaries for the same week (intentional—each summary is locale-specific)

## Future Enhancements

1. **User Preferences**:
   - Allow users to disable auto-generation, request manual only
   - Choose summary frequency (weekly, bi-weekly, monthly)

2. **Summary History**:
   - Show past summaries (last 13 weeks)
   - Trend analysis: "You've improved 15% in exercise consistency"

3. **Personalized Coaching**:
   - Track which suggestions user acted on
   - AI learns user's preferences over time (e.g., prefers early-morning routines)

4. **Export**:
   - Download summary as PDF or Markdown
   - Email summary every Sunday

5. **Visualization**:
   - Generate simple chart of habit scores over time
   - Highlight top 3 routines by completion rate

## Troubleshooting

### Summary Not Generating on Sunday
- **Check**: Is flag enabled? `GET /api/flags` → `summaries.weekly: true`
- **Check**: Is there internet? (Gemini call fails offline)
- **Check**: Is GEMINI_API_KEY set? (App logs will show "summaries.weekly" feature skipped)
- **Check**: Did scheduler run? Look at app logs for "weekly summary batch completed"

### Summary Is Outdated or Wrong
- **Check**: Is AI provider returning hallucinated data? (rare but possible)
- **Action**: Report to admin; flag will be reviewed and potentially disabled

### User Locale Wrong in Summary
- **Check**: User's `locale` field in User model (should be 'en' or 'bn')
- **Fix**: Update via settings or admin endpoint

---

## Files Changed (v4 vs v3)

### New Files
- `server/src/models/WeeklySummary.js`
- `server/src/services/weeklySummary.js`
- `server/src/routes/summaries.js`
- `server/tests/integration/summaries.test.js`
- `server/tests/unit/weeklySummary.test.js`
- `FEATURE_1_SUMMARY.md` (this file)

### Modified Files
- `shared/src/flags.js` — Added `summaries.weekly` flag default
- `server/src/app.js` — Imported and mounted summaries router
- `server/src/services/scheduler.js` — Added weekly summary batch generation job

---

## Next Features in Roadmap
1. Adaptive re-planning suggestions
2. Context-aware notifications
3. Natural-language routine edit
4. CSV export of completions
5. Correlation insights

---

**Feature Status**: ✅ Complete & Tested
**Ready for**: User testing, admin rollout, metrics tracking
