# Smart Routine

A daily routine planner and habit coach. Bangla and English. Works in a browser on a PC, laptop, or phone, and can be installed to the home screen.

The project has three separate parts. The server and the client run as separate programs and talk over HTTP. The shared folder holds code both sides can use.

## Folder map

```
smart-routine/
├── server/                 SERVER: Express API, MongoDB, sessions, sync, push, admin
│   ├── src/
│   │   ├── index.js        starts the server (connects to MongoDB, then listens)
│   │   ├── app.js          builds the Express app (middleware, routes)
│   │   ├── config/         env.js: reads and checks environment variables
│   │   ├── routes/         HTTP endpoints, one file per area
│   │   ├── services/       business logic (sync, scheduler, push, lessons, uploads)
│   │   ├── models/         MongoDB schemas (Mongoose)
│   │   ├── middleware/     auth, CSRF, rate limits, roles, error handling
│   │   └── lib/            logger (secrets redacted), crypto, cookies, Sentry
│   ├── scripts/            admin tools: grant-role, purge, preflight, export-training
│   ├── tests/
│   │   ├── unit/           fast tests, no database
│   │   └── integration/    tests against a real MongoDB (CI runs these)
│   ├── .env.example        copy to server/.env and fill in
│   └── package.json
│
├── client/                 CLIENT: Next.js website and app shell
│   ├── app/
│   │   ├── (public)/[lang]/  public pages: home, lessons, about, help, privacy, terms
│   │   ├── (private)/app/    the signed-in app (screens are being built)
│   │   ├── globals.css
│   │   ├── robots.js, sitemap.js
│   ├── components/         Header, Footer, MobileMenu, JsonLd
│   ├── lib/                api.js (reads the server), seo.js, palette.js
│   ├── i18n/               dictionaries.js: all English and Bangla copy
│   ├── public/             icon.svg and other static files
│   ├── scripts/            contrast check, SEO check
│   ├── tests/              unit tests and tests/e2e (Playwright, browser tests)
│   ├── .env.example        copy to client/.env.local and fill in
│   └── package.json
│
├── shared/                 SHARED: code used by server and client
│   ├── src/
│   │   ├── schemas/        validation rules (zod) for requests
│   │   ├── time.js         "Now" and "Next" from the time module
│   │   ├── outbox.js       offline queue (retries, refusals, sync)
│   │   ├── reminders.js    which reminders are due
│   │   ├── flags.js, ml.js, quiz.js, errors.js
│   └── tests/
│
├── ml/                     OFFLINE: Python pipeline for model training (not run by the server)
├── docs/                   phase notes, runbooks, release notes, SEO audit
├── loadtest/               k6 smoke test
├── scripts/backup/         restore test
├── .github/workflows/      CI: lint, unit, integration, ML, security, SEO, budgets
├── eslint.config.js        lint rules for server, client, and shared
├── lighthouserc.json       performance budgets
├── package.json            npm workspaces: server, client, shared
└── package-lock.json       one lockfile for all three
```

## Quick start (Windows, Git Bash)

```bash
cd ~/smart-routine
npm install
npm run test:unit        # server, shared, and client unit tests (no database needed)
npm run lint
npm run build            # builds the client website
```

Run the server and the client in two Git Bash windows:

```bash
npm run dev -w server    # needs server/.env with a MongoDB URI
npm run dev -w client    # needs client/.env.local with API_URL=http://localhost:5000
```

Database tests need MongoDB. Set `MONGODB_URI_TEST` to a database whose name contains `test`, then run `npm run test:integration`.

## Optional sign-in and lesson media

- Google Sign-In: create a Google OAuth Web Client ID and add `http://localhost:3000` (for local development) and the production site origin to its authorized JavaScript origins. Add `http://127.0.0.1:3000` too only if you browse using that host. Set `GOOGLE_CLIENT_ID` in `server/.env` and restart the API. The sign-in page loads that public client ID from the API, so no separate client environment variable or rebuild is needed. The browser sends a Google ID token; the API verifies it before creating a session. No Google client secret is placed in the browser.
- Prayer times: the prayer card shows Netrokona times immediately and the user can optionally refine them with browser geolocation from the prayer card; GPS coordinates are not saved in app state storage or the database. The API forwards those coordinates to Aladhan, which supplies the local timezone and timings using method 1 (Karachi) and Hanafi Asr. The app shows the coordinates/accuracy and returned timezone so the user can verify the location. If location permission or the provider fails, it keeps showing the Netrokona default instead of presenting estimated timings as accurate. Prayer alerts and full azan audio run only while the app/browser is open; browser/OS restrictions can still block autoplay, and a closed browser cannot play the azan.
- Daily Quran and Hadith: the prayer card shows one exact Quran verse or hadith with its citation every day, rotating by calendar date from a curated bilingual list in the app — no AI-generated reflection. (The older server-side reflection endpoint and scheduler remain available but the app no longer requests them.)
- Azan audio: `client/public/azan.mp3` is the Wikimedia Commons recording [“Azan”](https://commons.wikimedia.org/wiki/File:Azan.ogg) by Andrewler, released under CC BY-SA 4.0 (credit shown in the app); `client/public/adhan.ogg` remains as the fallback. The azan plays automatically with the prayer-time notification while the app is running. Browser notification sounds are controlled by the operating system; the app separately attempts the full azan audio while its page is running.
- Voice alarms and briefings: browser alarms speak the alarm name and next routine while the page is open. The Capacitor Android app instead uses the phone's ringtone and a full-screen alarm screen while the app is closed; this requires Android notification, exact-alarm, and full-screen-intent permissions. Browser/OS restrictions still apply to ordinary web/PWA alarms.
- Closed-app alarms (Android): the Capacitor app schedules alarms with Android `AlarmManager`, rings with a native foreground service, and restores pending alarms after reboot. Account-backed alarms are also mirrored to `POST /api/alarms` for Web Push and Telegram; browser push alone cannot play a custom looping ringtone with the browser closed. Guests can set native local alarms without an account. Android alarms are not controlled by the `push.alarms` server flag.
- Daily story and quiz: the generator creates one simple, funny English story and quiz per day for every interface language; Bengali text is not generated for new daily lessons. Gemini's story prompt requests warm stories with concrete details and inference/application questions; English curated fallback stories are available when lesson generation cannot use AI. Existing lessons for a date are cached and are not silently replaced when the prompt changes. Daily lesson quiz submissions require sign-in and include CSRF protection; the two homepage practice quizzes remain public.
- Landing practice quizzes: the homepage always displays two bilingual sample quizzes. Admins with editor/owner access and verified MFA can manage each fixed slot in **Admin → Landing quizzes**; saving publishes that slot immediately. The public API omits answer keys, checks submissions server-side, returns a localized explanation, and rate-limits attempts. Starter questions are built in and can be replaced through the admin panel.
- Cloudinary: set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `server/.env`. Upload signatures and media metadata are handled by the API; image, video, and audio lesson media are served from Cloudinary in production. The user-provided round logo and landing-page background are also delivered from Cloudinary with automatic format/quality optimization.
- Story audio: the player is titled **Learn English by Story** and plays one complete MP3 saved in Cloudinary. The first request for a story and voice configuration makes one ElevenLabs synthesis request and uploads one audio file; subsequent users reuse that Cloudinary asset without generating another voice. Cloudinary media uses a direct audio-element path rather than Web Audio panning, avoiding silence from cross-origin CORS routing.
- Android app: Capacitor project files live in `android/`. Set `CAPACITOR_SERVER_URL` to the deployed site when building a wrapper for a non-production deployment, then run `npx cap sync android` and open the `android/` project in Android Studio. Install the resulting app and grant its notification, exact-alarm, and full-screen-alarm permissions. A Git push deploys the web app only; it does not build or publish an Android APK.
- Telegram: set `TELEGRAM_BOT_TOKEN` in `server/.env` and enable notifications in the app settings. The scheduler sends local-time morning and evening briefs plus routine reminders.
- ElevenLabs narration: add the following values to `server/.env` to enable AI voice narration for the daily family story. Store everything server-side only:

```bash
ELEVENLABS_API_KEY=
ELEVENLABS_MODEL=eleven_v3
ELEVENLABS_FATHER_VOICE_ID=
ELEVENLABS_MOTHER_VOICE_ID=
ELEVENLABS_SON_VOICE_ID=
ELEVENLABS_STORYTELLER_VOICE_ID=
ELEVENLABS_STABILITY=0.5
ELEVENLABS_SIMILARITY_BOOST=0.75
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

The story player uses the configured Storyteller voice and sends the complete English script in one request. Voice access and quality depend on the account, chosen voice, and current ElevenLabs plan; the read-only voice catalog confirms availability but does not test generated sound. Free accounts can use API-accessible premade voices, but community Voice Library voices may require a paid plan (`402 paid_plan_required`). Only select voice IDs returned for your account. Voice IDs are account-specific; never put your API key in the client.

The Storyteller voice ID is the voice used for the complete story. Catalog descriptions and premade previews do not guarantee the quality of generated audio. Story playback has no Google or browser-speech fallback; if ElevenLabs or Cloudinary is unavailable, the player reports the error. Audio is played from the Cloudinary-saved MP3, and matching cached assets avoid repeat synthesis.

### How natural voice generation works

Voice quality comes primarily from the actual voice ID and the model; CSS, character icons, or transcript highlighting do not change the generated voice. The speech request sends the complete story, the configured Storyteller voice ID, `ELEVENLABS_MODEL`, and these current voice controls from `buildElevenLabsRequest()`:

| Control | Current default | What it controls |
| --- | ---: | --- |
| `ELEVENLABS_STABILITY` | `0.5` | How consistent versus expressive delivery sounds. |
| `ELEVENLABS_SIMILARITY_BOOST` | `0.75` | How closely output follows the selected voice identity. |
| `style` | `0.0` | Additional style exaggeration (currently left at neutral). |
| `use_speaker_boost` | `true` | Requests the model's speaker-identity boost. |
| `ELEVENLABS_OUTPUT_FORMAT` | `mp3_44100_128` | MP3 encoding and output quality. |

These settings are sent once per generated story. They are configuration choices, not a promise that a voice will sound natural in every language. Do not tune voices/settings by repeated live requests on a low-credit plan; inspect the read-only catalog first, then generate one short sample only when its credit cost is approved. A `GET /v1/voices` catalog request and the catalog's pre-recorded `preview_url` samples do not synthesize requested story text or spend TTS credits.

#### Daily lesson in the signed-in app

The private app's Lessons & quizzes tab loads two distinct APIs: `GET /api/lessons` contains individually published lessons, while `GET /api/lessons/today?locale=en` supplies the English daily story and quiz for every interface language. Daily content appears in the lesson tab even when the published collection is empty; published lessons remain available alongside it when present. `PrivateApp.loadLessons()` handles failures from each request independently, so an unavailable daily story does not hide the published collection (and vice versa).

#### One playback, from script to cached audio

1. `AudioDramaPlayer` passes the complete tagged English story to `playDrama()`.
2. `playDrama()` posts the script to `POST /api/speech/audio-drama`; the route is shared by users and does not require a signed-in session.
3. `generateAndUploadAudioDrama()` hashes the story and voice configuration, then checks Cloudinary for the deterministic MP3 before calling ElevenLabs.
4. On a cache miss, the complete story is synthesized in one ElevenLabs request and uploaded as one Cloudinary MP3. Concurrent requests on the same server instance share one in-flight synthesis.
5. Later requests return the existing Cloudinary URL, so other users play the same saved audio without another ElevenLabs request. Cloudinary lookups, storage, and delivery still count against account limits.
6. If ElevenLabs synthesis or Cloudinary saving fails, playback reports the error and stops; it does not use Google TTS, browser speech, or unsaved audio.

**Credit accounting:** English narration uses ElevenLabs only on a Cloudinary cache miss and may consume credits. A failed Cloudinary upload after successful ElevenLabs generation can still leave that request billable. Cloudinary lookups and ElevenLabs' voice catalog request do not synthesize speech. Do not repeatedly click Play after an error; address the reported cause first.

#### Profile and routine streaks

Users can save a display name and choose from six built-in avatars in **Trust & account**. A routine streak counts dates with at least one routine marked **Done** (or an enabled streak freeze); simply opening the app does not count as a completed day. The dashboard refreshes after sync and when the page becomes visible again. It reports rejected or still-pending completion syncs instead of presenting them as saved.

#### Free voice briefing and the AI routine coach

The daily voice briefing is English-only and spoken by the browser's built-in speech service. It prefers an installed local English voice and uses no ElevenLabs, Gemini, or Groq credits. Story narration is separate: it uses ElevenLabs and Cloudinary caching. The signed-in AI routine coach is API-first: it sends the question and up to 30 routine summaries to the server, which tries Gemini and then Groq if configured; local keyword matching runs only if the provider request fails.

An owner can replace a published daily story and quiz with a Gemini-generated version or explicitly generate its full narration in **Admin → Daily stories**. Every dialogue turn is synthesized and combined into one audio file; the completed story is saved to Cloudinary and played from the saved URL on the public lesson page. Repeated narration requests reuse the lesson's saved audio or an existing matching Cloudinary asset rather than calling ElevenLabs again. Editing or replacing the story clears and removes its superseded narration. Narration requires both complete Cloudinary and ElevenLabs configuration; missing configuration is reported to the admin instead of silently falling back.

#### Audio-drama implementation map

#### Files and functions changed

| File | Functions/config changed | Purpose |
| --- | --- | --- |
| `server/.env` | `ELEVENLABS_MOTHER_VOICE_ID` set to Bella; `ELEVENLABS_SON_VOICE_ID` set to Will; `ELEVENLABS_STORYTELLER_VOICE_ID` set to Chris | Runtime-only voice selection for Mother, Rafi, and Storyteller. This file contains secrets; do not commit or copy its values into docs/chat. |
| `server/src/services/elevenLabs.js` | `ElevenLabsApiError`, `buildElevenLabsRequest()`, `generateElevenLabsAudio()`, `generateNarrationAudio()`, `getNarrationVoiceConfigVersion()`, `createAudioDramaAsset()`, `generateAndUploadAudioDrama()` | Single-storyteller synthesis, sanitized provider errors, content/config hash, one-file Cloudinary cache lookup/upload, and in-flight request deduplication. |
| `server/src/services/cloudinary.js` | `CloudinaryApiError`, `buildClient().resourceInfo()`, `buildClient().uploadBuffer()`, `uploadBufferToCloudinary()`, `signParams()` | Admin API asset lookup and signed MP3 upload. The signature covers every signed form field (`folder`, bare `public_id`, `timestamp`); `file`, `api_key`, and `resource_type` are excluded as Cloudinary requires. `folder` is supplied separately, so `public_id` must not repeat that path. |
| `server/src/routes/speech.js` | `elevenLabsError()`, `audioDramaError()`, `POST /audio-drama` | Shared ElevenLabs narration and Cloudinary-save route; validation, rate limits, safe provider logging, and bilingual errors. |
| `server/src/config/env.js` | `ELEVENLABS_MODEL` default and voice/config schema | Validates server-only AI voice settings; model default is `eleven_v3`. |
| `server/.env.example` | ElevenLabs model default | Documents the default model without real credentials. |
| `server/tests/unit/env-empty.test.js` | Default model configuration test | Verifies the empty/default environment selects `eleven_v3`. |
| `client/lib/audioDrama.js` | `characterSettings()`, `parseStoryScript()`, `createSavedAudioDrama()`, `playDrama()` | Story parsing, single-track Cloudinary playback, live progress, and client-side saved-URL reuse. |
| `client/components/ProfileAvatar.jsx` | `ProfileAvatar()`, `ProfileAvatarPicker()` | Six lightweight, built-in avatars for the user's saved profile. |
| `client/components/RoutineDashboard.jsx` | `RoutineDashboard()` | Loads the completion summary/streak and refreshes after sync, focus, and page visibility changes. |
| `client/components/AudioDramaPlayer.jsx` | `characterIcon()`, `spokenTextParts()`, `AudioDramaPlayer()` | Character icons, scrollable dialogue bubbles, progress-based word highlighting, and bilingual notices. |
| `client/components/PrivateApp.jsx` | `loadLessons()`, alarm handlers, Lessons & quizzes tab | Fetches the English daily story/quiz, navigates to a selected story or quiz, and syncs local alarms with the Capacitor Android plugin. |
| `client/components/DailyLessonCard.jsx` | `DailyLessonCard()` | Renders the daily story, quiz, feedback, and audio player in a paper/sapphire/gold palette consistent with the rest of the app. |
| `client/components/LandingQuizGrid.jsx` | `LandingQuizGrid()` | Renders two interactive, bilingual public practice quizzes and submits answers for server-side checking. |
| `client/app/(public)/[lang]/page.jsx` | `HomePage()` | Loads and shows the two public landing-page practice quizzes. |
| `client/components/AdminPanel.jsx` | `loadLandingQuizzes()`, `saveLandingQuiz()`, Landing quizzes tab | Lets verified editors/owners edit and publish either fixed quiz slot in Bangla and English. |
| `client/lib/api.js` | `getLandingQuizzes()` | Loads the public quiz prompts/options for the homepage without answer keys. |
| `client/lib/apiClient.js` | `apiRequest()` | Adds locale-aware API error messages for quiz submissions. |
| `server/src/models/LandingQuiz.js` | `LandingQuiz` | Stores two unique quiz slots, bilingual options/explanations, and private answer keys. |
| `server/src/services/landingQuizzes.js` | `listPublicLandingQuizzes()`, `listAdminLandingQuizzes()`, `saveLandingQuiz()`, `submitLandingQuizAnswer()` | Supplies default quiz content, separates public/admin data, publishes updates, and checks answers on the server. |
| `server/src/routes/lessons.js` | `GET /landing-quizzes`, `POST /landing-quizzes/:slot/attempts` | Serves quiz prompts without answer keys and rate-limits public answer submissions. |
| `server/src/routes/admin.js` | `GET /landing-quizzes`, `PUT /landing-quizzes/:slot` | MFA-protected editor/owner quiz management with schema validation and audit logging. |
| `server/tests/unit/landing-quizzes.test.js` | Public/admin quiz service tests | Verifies two defaults, secret answer-key handling, direct publishing, and localized scoring. |
| `client/components/PrayerTimesCard.jsx` | `requestLocation()`, prayer loading and notification effects | Shows Netrokona times by default with optional device-location refinement, displays coordinate accuracy/timezone, loads location-specific timings, shows a cited daily Quran/Hadith reference, and plays the azan with the prayer notification while the app is running. |
| `client/lib/islamicReferences.js` | `ISLAMIC_REFERENCES`, `getDailyIslamicReference()` | Curated bilingual Quran verses and hadith with exact citations, rotating one per Bangladesh calendar date. |
| `client/lib/voiceBriefing.js` | `pickSpeechVoice()`, `speakWithVoice()`, `buildAlarmAnnouncement()`, `buildMissedAnnouncement()` | Prefers the Google voice in the requested language for spoken briefings, alarm announcements, and missed-alarm catch-up, in Bengali and English. |
| `server/src/models/Alarm.js`, `server/src/routes/alarms.js` | Server alarm mirror + CRUD | Logged-in users sync one-shot alarms; open app reports its own rings so the tick never double-sends. |
| `client/lib/nativeAlarm.js`, `android/app/src/main/java/com/madeyourdreambigger/smartroutine/` | Capacitor bridge and Android alarm service | Schedules exact alarms, loops the system ringtone in a foreground service, presents stop/snooze controls, and restores alarms after reboot. |
| `server/src/services/scheduler.js` | `runAlarmTick()` | Claims due alarms atomically and sends Web Push (alarm name + next routine) plus Telegram ⏰ alerts for closed apps. |
| `client/lib/alarmsSync.js`, `client/lib/pushClient.js` | Alarm mirror + push subscribe helpers | Offline-first server sync; one-tap closed-app alert subscription preserving other push prefs. |
| `client/public/sw.js` | Push display | Alarm notifications vibrate, stay until dismissed, and offer Open / Snooze actions (deep-link). |
| `server/src/models/IslamicReflection.js`, `server/src/services/islamicReflections.js` | Daily reflection persistence and Gemini generation | Validates/caches English and Bengali reflections by Bangladesh date; malformed or uncertain citations are not published. |
| `server/src/routes/islamicReflections.js` | `GET /api/islamic-reflections/today` | Serves the cached localized reflection; the client renders it only when prayer alerts are enabled. |
| `server/src/services/scheduler.js` | Daily Islamic reflection tick | Generates missing locales once per Bangladesh date under a database lease, using Gemini only. |
| `client/lib/prayerTimes.js` | `getPrayerDateKey()`, `getPrayerOccurrences()`, `nextPrayerInfo()` | Converts each prayer's wall-clock time using the timezone returned for the current device coordinates. |
| `client/lib/appStore.js` | persisted prayer preferences | Stops storing the old fixed Netrokona city setting; user GPS coordinates remain only in component memory. |
| `server/src/routes/calendar.js` | `GET /prayers` | Validates coordinate ranges and returns location-specific timing plus provider timezone/calculation metadata. |
| `server/src/services/prayerTimes.js` | `buildAladhanTimingsUrl()`, `fetchPrayerTimings()` | Requests Aladhan timings for supplied coordinates, validates the provider timezone and normalizes returned prayer clocks. |
| `client/public/azan.mp3` | Wikimedia Commons CC BY-SA 4.0 recording (Andrewler) | Prayer notification azan with in-app credit; `adhan.ogg` remains as fallback. |
| `client/tests/prayer-times.test.js`, `server/tests/unit/prayer-times.test.js` | timezone/date conversion and coordinate API tests | Covers location-based calculations and provider validation without live API calls. |
| `server/tests/unit/elevenLabs.test.js` | Provider/Cloudinary error, English narration, and Bengali free-audio cache tests | Uses mocked provider/storage responses; no live API/credit use. |
| `server/tests/unit/cloudinary-sign.test.js` | `signParams()` and upload-form signature test | Verifies the exact signed fields match the multipart upload request, including the folder. |
| `server/tests/unit/env-empty.test.js` | Default model configuration test | Verifies the empty/default environment selects `eleven_v3`. |
| `client/tests/audio-drama.test.js` | Transcript, role mapping, Cloudinary playback, and fallback tests | Verifies sequential direct Cloudinary playback without live TTS. |
| `server/tests/unit/islamicReflections.test.js` | Islamic reflection service tests | Covers bilingual caching, Gemini-only generation, and citation validation without provider calls. |
| `README.md` | This implementation/learning guide | Records the actual code path, settings, cost boundaries, edited files, and verification steps. |

Also in the earlier Google-login configuration change, `client/next.config.mjs` was updated to allow the Google Identity Services stylesheet in CSP. That is separate from narration; Google OAuth still requires the active site origin in Google Cloud Console.

#### Error visibility and safe logging

Show a user-visible error only when it helps resolve the user's current action (for example: credits exhausted, sign-in required, retry later, or Cloudinary credentials rejected). Send unrelated implementation diagnostics to the server console/logger instead of the story UI. Log only safe metadata such as error class, HTTP status, sanitized provider code, and operation name; never log API keys, Authorization headers, cookies, raw provider response bodies, or story text. When changing error handling, keep actionable bilingual UI messages and add tests for both the displayed error and safe log fields.

- Required server-only configuration: `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL`, the four `ELEVENLABS_*_VOICE_ID` values, and all three `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` values. `cloudinaryAudioReady` means the three Cloudinary variables are present; only Cloudinary's Admin API can verify that the values are valid together. A rejected lookup/upload is reported as `CLOUDINARY_UNAVAILABLE` with the failing HTTP status logged, without logging provider response bodies. Restart the API after changing `server/.env`; do not put provider keys in client code or chat.
- Focused regression tests: run `npm.cmd test -- tests/unit/elevenLabs.test.js` from `server/`, and `npm.cmd test -- tests/audio-drama.test.js` from `client/`. Both mock ElevenLabs and Cloudinary and consume no live credits.

ElevenLabs usage is billable and each dialogue turn makes a provider request. Confirm current pricing and API access on your account before generating narration; do not assume the free tier is unrestricted or permanent.
- Local ML demo: with MongoDB running at `localhost`, run `npm run ml:local-demo -w server`. It installs explicitly synthetic demo weights only in a local development database; displayed percentages are illustrative and are never validated personal-risk estimates.

## Where things are documented

- `docs/RELEASE-v2.md`: what this release contains, what was verified, and what is still open.
- `docs/runbooks/`: what to do when something breaks in production.
- `docs/PHASE*.md`: the notes for each build phase.
# time-manaze-routine
