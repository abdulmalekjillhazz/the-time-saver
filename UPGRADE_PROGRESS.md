# The Time Saver / Smart Routine — Upgrade Progress

## Non-negotiable constraints
- Upgrade the existing project; do not replace it with a new frontend.
- Keep Vercel for the web experience and online API/sync.
- The Android app must eventually bundle its UI and work offline for data the user has saved locally.
- Preserve existing account, database, authentication, and routine behavior unless a targeted fix requires a change.
- Build and test each phase before moving on; do not claim device behavior is verified until tested on a physical Android device.

## Ordered upgrade plan

### Phase 1 — routine creation and scoring feedback (started in this revision)
- Route AI-generated routine creation through the same `routine.create` outbox/sync operation used by the main routine form.
- Route template creation through the same outbox/sync operation.
- Attach stable client UUIDs to generated drafts so retrying a partially completed batch can be idempotent.
- Prevent double-click submissions while adding a template and show a distinct queued-for-sync status when the server is unavailable.
- Put the XP/level bar on the progress dashboard and refresh it after sync, focus, or returning to the app.

### Phase 2 — prove scoring correctness
- Verify completion writes and XP calculations against the persisted Completion records.
- Test duplicate completion/retry behavior, date/time-zone boundaries, and XP refresh after sync.
- Add visible diagnostics for rejected or pending completion operations.

### Phase 3 — Android screen-off alarm reliability
- Verify JS-to-native plugin registration and alarm payloads.
- Test exact-alarm permission, notification permission, full-screen intent access, alarm receiver, foreground media-playback service, wake lock, reboot rescheduling, and app force-stop behavior.
- Add a permission/diagnostics screen that states exactly which permission or Android setting is missing.
- Test with screen off and device locked on a real device. OEM battery restrictions may require user-visible guidance; do not promise that every manufacturer behaves identically.

### Phase 4 — real offline-first Android shell
- Remove the runtime dependency on `server.url` for the Android app only after the Next.js client is made buildable as a bundled local app.
- Store routines, completions, user-created alarms, templates, and relevant preferences locally; keep an explicit sync queue and conflict/error states.
- Keep Vercel online for account/API access and sync, not for loading the app shell or firing local alarms.
- Ensure previously saved data remains visible and editable offline; distinguish data that requires an online AI/API call.

### Phase 5 — audio and mobile UX
- Inspect word-by-word audio segmentation and fix chunking at the source rather than only changing button styling.
- Redesign bottom navigation and action groups for touch targets, responsive spacing, hierarchy, and accessibility.
- Test small Android screens, keyboard open, screen rotation, dark/light themes, Bengali and English.

### Phase 6 — strict update and release validation
- Define a version policy for mandatory update separately from Android native package updates.
- Use a native APK/AAB release for native plugin changes; do not imply a Vercel deployment updates Java code.
- Run tests, production build, Android Gradle build, install the APK, and perform a regression checklist before release.

## Changes in this revision
- `TemplatePicker.jsx`: uses the outbox/sync path rather than direct `POST /api/routines`; adds a busy state, stable operation shape, and queued-for-sync status.
- `GoalToRoutine.jsx`: adds generated drafts through the outbox/sync path; gives each draft a stable client UUID to prevent duplicates on retry; improves error/queued feedback.
- `GamificationBar.jsx`: refreshes stats after sync/focus/visibility changes.
- `PrivateApp.jsx`: exposes the XP/level bar in the dashboard and passes the authenticated user ID to the routine-add components.

## Verification status
- Static code inspection completed for the Phase 1 changes.
- Automated test/build verification is **not yet complete**: dependency installation did not finish in this environment.
- Android alarm behavior and APK installation have **not** been verified on a physical device.

### Phase 2 — scoring calculation isolated and smoke-tested (partial)
- Extracted the XP/level calculation into `server/src/services/gamificationStats.js`, keeping the existing award rules unchanged: 50 XP per currently completed routine and 30 XP per saved reflection.
- The `/api/gamification/stats` route now uses that pure calculation helper after querying persisted MongoDB counts.
- Added `server/tests/unit/gamification-stats.test.js` covering zero XP, routine/reflection awards, level boundaries, and invalid/negative counts.
- Improved the XP progress bar with accessible progress semantics and clamped visual progress.
- Verification: `node --check` passed for the new helper and route; direct Node smoke checks passed 4/4. Vitest/build could not run because the Vitest executable is not installed in this environment. End-to-end score refresh still needs a real authenticated session and persisted completion data.

### Phase 3 — template retry/idempotency hardening (targeted patch)
- Code review found a concrete duplicate-creation risk in `TemplatePicker.jsx`: each click generated a new `clientId`. If the server committed a routine but the response was lost, a retry could use a different ID and create a duplicate.
- Added `client/lib/templateClientId.js` to persist a stable client ID per user/template, with best-effort storage and a valid UUID fallback when storage is restricted.
- `TemplatePicker.jsx` now watches outbox changes: a queued indicator clears after the operation leaves the outbox successfully, and a rejected queued operation re-enables the template instead of leaving it permanently disabled.
- Added Node built-in tests for stable IDs, user/template isolation, and storage failure.
- Verification: `node --test client/tests/template-client-id.test.js` passed 3/3; `node --check` passed for the helper and gamification files; TypeScript's JSX parser accepted `TemplatePicker.jsx` syntax.
- Still not verified: full Next.js/Vitest build (dependencies are unavailable in this environment), real authenticated API sync, or any physical-device Android alarm behavior.

### Phase 4 — alarm action lifecycle bug (targeted native fix)
- Code review found a concrete Android foreground-service lifecycle defect in `AlarmRingingActivity.finishAlarm()`: STOP/SNOOZE used `startForegroundService()`, but `AlarmRingingService` handles these actions and exits before calling `startForeground()`. On Android 8+, that can trigger a foreground-service start timeout crash.
- Changed STOP/SNOOZE to call `startService()` from the currently visible alarm activity. This is an explicit user action from a foreground activity and avoids incorrectly starting a foreground service for an action that immediately exits.
- Verification: template client-ID Node tests passed 3/3; `node --check` passed for the relevant JS helpers; a source-level regression assertion confirms the alarm activity no longer uses `startForegroundService()` for these actions.
- Limitations: Android Gradle compilation was not run because this environment has no configured Android SDK; alarm ringing while locked still requires a physical-device test with permissions granted.
