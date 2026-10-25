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

- Google Sign-In: create a Google OAuth Web Client ID and add `http://localhost:3000` (for local development) and the production site origin to its authorized JavaScript origins. Add `http://127.0.0.1:3000` too only if you browse using that host. Set `GOOGLE_CLIENT_ID` in `server/.env` and restart the API. The sign-in page loads that public client ID from the API, so no separate client environment variable or rebuild is needed. The browser sends a Google ID token; the API verifies it before creating a session. No Google client secret is placed in the browser. The Capacitor Android app uses native Google Credential Manager instead of opening Google's browser-only sign-in inside its WebView. In the same Google Cloud project, also create an Android OAuth client for package `com.madeyourdreambigger.smartroutine` and register the SHA-1 fingerprints for every signing key used (debug, release, and Play App Signing). Keep the Web Client ID in `GOOGLE_CLIENT_ID`; the native plugin uses it to request an ID token the API can verify. After changing the native plugin, run `npx cap sync android` and rebuild/reinstall the Android app.
- Prayer times: the prayer card shows Netrokona times immediately and the user can optionally refine them with browser geolocation from the prayer card; GPS coordinates are not saved in app state storage or the database. The API forwards those coordinates to Aladhan, which supplies the local timezone and timings using method 1 (Karachi) and Hanafi Asr. The app shows the coordinates/accuracy and returned timezone so the user can verify the location. If location permission or the provider fails, it keeps showing the Netrokona default instead of presenting estimated timings as accurate. Prayer alerts and full azan audio run only while the app/browser is open; browser/OS restrictions can still block autoplay, and a closed browser cannot play the azan.
- Daily Quran and Hadith: the prayer card shows one exact Quran verse or hadith with its citation every day, rotating by calendar date from a curated bilingual list in the app — no AI-generated reflection. (The older server-side reflection endpoint and scheduler remain available but the app no longer requests them.)
- Azan audio: `client/public/azan.mp3` is the Wikimedia Commons recording [“Azan”](https://commons.wikimedia.org/wiki/File:Azan.ogg) by Andrewler, released under CC BY-SA 4.0 (credit shown in the app); `client/public/adhan.ogg` remains as the fallback. The azan plays automatically with the prayer-time notification while the app is running. Browser notification sounds are controlled by the operating system; the app separately attempts the full azan audio while its page is running.
- Voice alarms and briefings: browser alarms speak the alarm name and next routine while the page is open. The Capacitor Android app instead uses the phone's ringtone and a full-screen alarm screen while the app is closed; this requires Android notification, exact-alarm, and full-screen-intent permissions. Browser/OS restrictions still apply to ordinary web/PWA alarms.
- Closed-app alarms (Android): the Capacitor app schedules alarms with Android `AlarmManager`, rings with a native foreground service, and restores pending alarms after reboot. Account-backed alarms are also mirrored to `POST /api/alarms` for Web Push and Telegram; browser push alone cannot play a custom looping ringtone with the browser closed. Guests can set native local alarms without an account. Android alarms are not controlled by the `push.alarms` server flag.
- Daily story and quiz: the server checks each minute and generates one English story and quiz for the current day in Bangladesh time, regardless of interface language. Gemini is instructed to write a funny, believable 90–120-word beginner story with at least three short, three medium, and three longer sentences for sentence-order practice; curated English fallback stories keep the daily lesson available when AI generation fails. The Android WebView and website read the same daily lesson from the API; Gemini keys stay on the server. Existing lessons for a date are cached and are not silently replaced when the prompt changes. Daily lesson quiz submissions require sign-in and include CSRF protection; the two homepage practice quizzes remain public.
- Learning streak: opening the app or a lesson does not count. A streak day is recorded when a signed-in learner marks a story complete or submits its quiz, including a zero-point quiz; missing a calendar day resets the current streak, and the next learning activity starts it at one. Scores remain awarded once per story/quiz, while the separate per-day marker supports streaks for repeat learning.
- Learning points: stories award 50 points once. Quizzes award up to 30 points proportionally to correct answers (for a three-question quiz: 10 per correct answer); retrying can raise the saved best score, but only the difference is added, so points cannot be farmed by repeating the same score.
- Task-completion push reminders: subscribed users with routine reminders enabled receive reminders at 09:00 and 18:00 in their account timezone. The scheduler sends them only when routines exist, avoids duplicate sends per time slot, and uses a completion message if all routines are already done. Push delivery still depends on the server scheduler and configured Web Push credentials.
- Landing practice quizzes: the homepage always displays two bilingual sample quizzes. Admins with editor/owner access and verified MFA can manage each fixed slot in **Admin → Landing quizzes**; saving publishes that slot immediately. The public API omits answer keys, checks submissions server-side, returns a localized explanation, and rate-limits attempts. Starter questions are built in and can be replaced through the admin panel.
- Cloudinary: set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `server/.env`. Upload signatures and media metadata are handled by the API; image, video, and audio lesson media are served from Cloudinary in production. The user-provided round logo and landing-page background are also delivered from Cloudinary with automatic format/quality optimization.
- Story audio and speaking practice: **Learn English by Story** uses dialogue role tags to assign distinct father, mother, child, and storyteller voices. The player requests a timestamped clip for each sentence, saves the clips and a JSON timing manifest in Cloudinary, then plays the clips in order; word highlighting follows ElevenLabs character alignment and does not advance until a clip is actually playing. Matching manifests are reused on later plays. A saved legacy single-file narration is not used for synchronized playback. If timestamped generation is unavailable, Google TTS remains an audio-only fallback and does not move sentence selection. **Learn to speak** includes listen-and-repeat practice: each English line allows up to three microphone attempts, shows an approximate word-match score, and makes line words tappable for meanings. Where the browser or device provides them, learners can choose an installed Microsoft English voice for the example audio; this uses local browser speech synthesis, not a paid speech API. The story reader shows one dialogue chunk at a time with previous/next controls. Tapping a word opens its meaning and a text-to-speech pronunciation button. Android uses the native speech recognizer; web browsers use Web Speech recognition when available. Recognition audio is not saved by the app and may be processed by the platform's speech service; the score is not phonetic pronunciation analysis. The separate daily voice briefing also uses Google TTS.
- Building English practice: the Building tab contains bilingual, step-by-step Basic, Intermediate, and Advanced lessons on sentence order, be verbs, common tenses, and connecting ideas. Each lesson has an answer-checked quiz and natural English voice playback using Google TTS. A separate story-practice section turns sentences from today's generated lesson and published English stories into Basic (up to 5 words), Intermediate (6–9 words), and Advanced (10+ words) word-order challenges; level progress is derived from server-saved completions and is shared across the website and Android app. Completing ten distinct, verified story sentences awards 30 points once per account. The Focus shortcut is in the header; statistics and miss-risk insights are grouped inside Settings.
- Android app: Capacitor project files live in `android/`. By default, the APK loads its UI from the locally bundled `client/out` assets for a faster startup and an offline-capable app shell. Build them with `npm run build:android -w client`, then run `npx cap sync android` and build with `gradlew.bat assembleDebug` from `android/`. To deliberately load the UI from a hosted site instead, set `CAPACITOR_SERVER_URL` to that site's origin when syncing; Capacitor opens its `/app` route. The Android CI job follows the bundled-UI build and uploads a debug APK artifact. The UI shell and assets load locally, but sign-in, saved data, and other API-backed features still need an internet connection. Debug APKs use Android's debug certificate and are for development only; they cannot update an APK signed with the release key. Release signing secrets can be kept in the ignored local file `android/release-signing.local.properties` (create an upload key once and back it up securely; do not lose it or commit either file). The properties are `storeFile=upload-key.jks`, `storePassword=...`, `keyAlias=smart-routine-upload`, and `keyPassword=...`; protect the properties file and keep its passwords in a password manager. Alternatively, set `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` in the local build environment or CI secrets. Run `gradlew.bat :app:bundleRelease` from `android/`. Never commit or paste signing passwords into chat. Set `ANDROID_VERSION_CODE` to a value higher than every version already uploaded to Play Console; `ANDROID_VERSION_NAME` is optional. Upload the signed `android/app/build/outputs/bundle/release/app-release.aab` to the Play Console internal testing track and use its tester opt-in link to install. Release tasks fail rather than silently falling back to a debug signature when signing values are missing. Google Play distribution and Play Protect review are required to establish trusted distribution; sideloading an unfamiliar app may still show a warning.
- Website APK download: the public site links to `client/public/downloads/smart-routine-android-v1.11.apk`. Replace it only with a release-signed APK that uses the same signing key and a version code higher than the installed version. The website labels sideloading warnings and Google Play availability as planned; the direct download is not a Play Store release.
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

Interactive playback uses ElevenLabs' text-to-speech-with-timestamps endpoint once per sentence; explicit admin generation of the daily narration still uses the multi-voice dialogue endpoint. Voice access and quality depend on the account, chosen voices, model, and current ElevenLabs plan; the read-only voice catalog confirms availability but does not test generated sound. Free accounts can use API-accessible premade voices, but community Voice Library voices may require a paid plan (`402 paid_plan_required`). Only select voice IDs returned for your account. Voice IDs are account-specific; never put your API key in the client.

Catalog descriptions and premade previews do not guarantee the quality of generated audio. Story playback requires ElevenLabs and Cloudinary when no matching narration has already been saved.

### How natural voice generation works

Voice quality comes primarily from the actual voice IDs and the model; CSS, character icons, or transcript highlighting do not change the generated voices. The single dialogue request sends each tagged turn with its configured voice ID, `ELEVENLABS_MODEL`, and these voice controls:

| Control | Current default | What it controls |
| --- | ---: | --- |
| `ELEVENLABS_STABILITY` | `0.5` | How consistent versus expressive delivery sounds. |
| `ELEVENLABS_SIMILARITY_BOOST` | `0.75` | How closely output follows each selected voice identity. |
| `ELEVENLABS_OUTPUT_FORMAT` | `mp3_44100_128` | MP3 encoding and output quality. |

These settings are sent with each generated sentence clip. Interactive playback makes one billable synthesis request per uncached sentence; Cloudinary stores each MP3 and a raw JSON manifest with sentence and word timestamps. The manifest is versioned by text and voice settings, so later plays reuse the generated assets. Admin daily narration remains a single multi-voice dialogue request. Settings are configuration choices, not a promise that a voice will sound natural in every language. Do not tune voices/settings by repeated live requests on a low-credit plan; inspect the read-only catalog first, then generate one short sample only when its credit cost is approved. A `GET /v1/voices` catalog request and the catalog's pre-recorded `preview_url` samples do not synthesize requested story text or spend TTS credits.

#### Daily lesson in the signed-in app

The private app's Lessons & quizzes tab loads two distinct APIs: `GET /api/lessons` contains individually published lessons, while `GET /api/lessons/today?locale=en` supplies the English daily story and quiz for every interface language. The daily lesson starts collapsed; open it to see the complete story, audio, and quiz. Public lesson pages remain expanded. Daily content appears in the lesson tab even when the published collection is empty; published lessons remain available alongside it when present. `PrivateApp.loadLessons()` handles failures from each request independently, so an unavailable daily story does not hide the published collection (and vice versa).

#### Multi-voice story playback

`AudioDramaPlayer` requests a versioned sentence manifest from `POST /api/speech/audio-drama`. For each sentence the server requests ElevenLabs character alignment, uploads the sentence MP3 to Cloudinary, and stores the complete JSON manifest as a Cloudinary raw asset. The client plays these clips sequentially, preloads the next clip, and selects/highlights text only from actual playback events and timestamps. A matching manifest is reused on later plays. If the timestamped flow is unavailable, Google TTS can still play the story but the transcript selection stays still rather than drifting out of sync. New sentence clips are also cached in IndexedDB for offline playback; legacy full-story audio cache entries are versioned out. This interactive path requires all four voice IDs, ElevenLabs, and Cloudinary.

#### Profile and routine streaks

Users can save a display name and choose from six built-in avatars in **Trust & account**. A routine streak counts dates with at least one routine marked **Done** (or an enabled streak freeze); simply opening the app does not count as a completed day. The dashboard refreshes after sync and when the page becomes visible again. It reports rejected or still-pending completion syncs instead of presenting them as saved.

The learning streak shown in Today progress is separate from the routine streak: it counts a story marked complete or a submitted quiz per local calendar day. If a day is missed, the next completed learning activity starts a new streak.

#### Free Google Translate voice briefing and AI-assisted routine planning

The signed-in daily voice briefing uses Google's free, undocumented Translate speech endpoint for Bengali and English; it requires no API key or Cloud billing configuration. The server splits longer text into short requests and joins the resulting MP3 audio. This third-party endpoint is undocumented, can be throttled, and may change or stop working without notice; it is not suitable for guaranteed or high-volume service. Briefing text (including the user's display name and routine titles) is sent to Google. Briefing audio is not cached and requests are limited to 20 per user every 15 minutes. Story dialogue instead uses the multi-voice ElevenLabs/Cloudinary flow described above. Goal-to-routine suggestions, adaptive replanning, and personal voice briefings use configured server AI providers (Gemini, then Groq fallback when available); their prompts are sent to the selected provider.

An owner can replace a published daily story and quiz with a Gemini-generated version or explicitly generate its full narration in **Admin → Daily stories**. Admin narration remains a single ElevenLabs dialogue request and is saved to Cloudinary for other lesson surfaces. Interactive story playback independently creates synchronized sentence clips and a timing manifest on first play. Editing or replacing the story clears and removes its superseded admin narration; synchronized assets are content/version hashed and reused when they match. Narration requires complete Cloudinary and ElevenLabs configuration; missing configuration is reported to the admin instead of silently falling back.

#### Audio-drama implementation map

#### Files and functions changed

| File | Functions/config changed | Purpose |
| --- | --- | --- |
| `server/.env` | `ELEVENLABS_MOTHER_VOICE_ID` set to Bella; `ELEVENLABS_SON_VOICE_ID` set to Will; `ELEVENLABS_STORYTELLER_VOICE_ID` set to Chris | Runtime-only voice selection for Mother, Rafi, and Storyteller. This file contains secrets; do not commit or copy its values into docs/chat. |
| `shared/src/storyNarration.js` | `parseStoryNarration()`, `parseNarrationSpeakerName()` | Shared speaker parsing, framing, and segment splitting so displayed story text and both TTS providers receive the same narration segments. |
| `server/src/services/elevenLabs.js` | `ElevenLabsApiError`, dialogue and timestamp request builders, timestamped audio generation, `createAudioDramaAsset()`, `generateAndUploadAudioDrama()` | Admin dialogue synthesis plus sentence-level timed clips, word alignment extraction, versioned Cloudinary MP3/JSON cache, and in-flight request deduplication. |
| `server/src/services/cloudinary.js` | `CloudinaryApiError`, `buildClient().resourceInfo()`, `buildClient().uploadBuffer()`, `uploadBufferToCloudinary()`, `signParams()` | Admin API asset lookup and signed MP3 upload. The signature covers every signed form field (`folder`, bare `public_id`, `timestamp`); `file`, `api_key`, and `resource_type` are excluded as Cloudinary requires. `folder` is supplied separately, so `public_id` must not repeat that path. |
| `server/src/routes/speech.js` | `googleTtsError()`, `elevenLabsError()`, `POST /audio-drama/free`, `POST /audio-drama` | Google TTS fallback plus the timestamped sentence-manifest route; validation, rate limits, safe provider logging, and bilingual errors. |
| `server/src/config/env.js` | `ELEVENLABS_MODEL` default and voice/config schema | Validates server-only AI voice settings; model default is `eleven_v3`. |
| `server/.env.example` | ElevenLabs model default | Documents the default model without real credentials. |
| `server/tests/unit/env-empty.test.js` | Default model configuration test | Verifies the empty/default environment selects `eleven_v3`. |
| `client/lib/audioDrama.js` | `characterSettings()`, `parseStoryScript()`, `playDrama()` | Shared-parser story display, saved or generated Cloudinary multi-voice playback, Google TTS fallback, pause/resume/seek progress, and in-flight request cleanup. |
| `client/components/ProfileAvatar.jsx` | `ProfileAvatar()`, `ProfileAvatarPicker()` | Six lightweight, built-in avatars for the user's saved profile. |
| `client/components/RoutineDashboard.jsx` | `RoutineDashboard()` | Loads the completion summary/streak and refreshes after sync, focus, and page visibility changes. |
| `client/components/AudioDramaPlayer.jsx` | `characterIcon()`, `spokenTextParts()`, `AudioDramaPlayer()` | Character icons, chunked dialogue navigation, tappable word meanings and pronunciation playback, progress-based word highlighting, bilingual notices, and English speaking practice. |
| `client/components/GrammarLessons.jsx` | `getGrammarLevelAvailability()`, `GrammarLessons()` | Progressive bilingual Building lessons with answer-checked quizzes and natural English voice playback, alongside story-based practice. |
| `client/components/SentenceBuilder.jsx` | `extractGrammarExercises()`, `getUnlockedLevels()`, `isSentenceCorrect()`, `SentenceBuilder()` | Extracts English sentences from existing stories, progressively unlocks word-order practice, and awards 30 points once after ten distinct verified sentences. |
| `client/lib/speechPractice.js` | `speechWords()`, `compareSpeechText()` | Normalizes recognized English words and estimates word-level matches against a story line. |
| `client/components/PrivateApp.jsx` | `loadLessons()`, alarm handlers, Lessons & quizzes tab | Fetches the English daily story/quiz, navigates to a selected story or quiz, and syncs local alarms with the Capacitor Android plugin. |
| `client/components/DailyLessonCard.jsx` | `DailyLessonCard()` | Keeps signed-in daily stories collapsed until opened; public lesson pages remain expanded. The opened view includes the story, quiz, feedback, and audio player. |
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
| `server/tests/unit/elevenLabs.test.js` | Provider/Cloudinary error, English narration, and saved-audio cache tests | Uses mocked provider/storage responses; no live API/credit use. |
| `server/tests/unit/cloudinary-sign.test.js` | `signParams()` and upload-form signature test | Verifies the exact signed fields match the multipart upload request, including the folder. |
| `server/tests/unit/env-empty.test.js` | Default model configuration test | Verifies the empty/default environment selects `eleven_v3`. |
| `client/tests/audio-drama.test.js` | Transcript, role mapping, free audio playback, and provider-error tests | Verifies the free Google audio flow and playback controls without live TTS. |
| `server/tests/unit/islamicReflections.test.js` | Islamic reflection service tests | Covers bilingual caching, Gemini-only generation, and citation validation without provider calls. |
| `README.md` | This implementation/learning guide | Records the actual code path, settings, cost boundaries, edited files, and verification steps. |

Also in the earlier Google-login configuration change, `client/next.config.mjs` was updated to allow the Google Identity Services stylesheet in CSP. That is separate from narration; Google OAuth still requires the active site origin in Google Cloud Console.

#### Error visibility and safe logging

Show a user-visible error only when it helps resolve the user's current action (for example: credits exhausted, sign-in required, retry later, or Cloudinary credentials rejected). Send unrelated implementation diagnostics to the server console/logger instead of the story UI. Log only safe metadata such as error class, HTTP status, sanitized provider code, and operation name; never log API keys, Authorization headers, cookies, raw provider response bodies, or story text. When changing error handling, keep actionable bilingual UI messages and add tests for both the displayed error and safe log fields.

- Required server-only configuration: `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL`, the four `ELEVENLABS_*_VOICE_ID` values, and all three `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` values. `cloudinaryAudioReady` means the three Cloudinary variables are present; only Cloudinary's Admin API can verify that the values are valid together. A rejected lookup/upload is reported as `CLOUDINARY_UNAVAILABLE` with the failing HTTP status logged, without logging provider response bodies. Restart the API after changing `server/.env`; do not put provider keys in client code or chat.
- Focused regression tests: run `npm.cmd test -- tests/unit/elevenLabs.test.js` from `server/`, `npm.cmd test -- tests/unit/googleTts.test.js` from `server/`, and `npm.cmd test -- tests/audio-drama.test.js` from `client/`. They mock provider responses and consume no live TTS credits.

ElevenLabs usage is billable: one uncached story makes one synthesis request, then users reuse its saved Cloudinary audio. Confirm current pricing and API access on your account before generating narration; do not assume the free tier is unrestricted or permanent.
- Local ML demo: with MongoDB running at `localhost`, run `npm run ml:local-demo -w server`. It installs explicitly synthetic demo weights only in a local development database; displayed percentages are illustrative and are never validated personal-risk estimates. New users default to no model-training consent; exports include active users with `consents.modelTraining.granted: true`. Existing saved consent values are preserved and are not migrated by this code change.

## Where things are documented

- `docs/RELEASE-v2.md`: what this release contains, what was verified, and what is still open.
- `docs/runbooks/`: what to do when something breaks in production.
- `docs/PHASE*.md`: the notes for each build phase.
# time-manaze-routine
