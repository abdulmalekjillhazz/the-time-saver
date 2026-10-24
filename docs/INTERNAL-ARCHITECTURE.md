# INTERNAL ARCHITECTURE & CODE MAPPING (CONFIDENTIAL - DO NOT EXPOSE PUBLICLY)
# Project: Time Saver / Smart Routine
# Security Classification: Internal Developer Reference Only

## 1. System Topology & Request Lifecycle
```
[User Touch / Input Event]
          │
          ▼
[React 18 Client Component (client/components/PrivateApp.jsx)]
          │
          ├── (A) Remote Backend Sync: via client/lib/apiClient.js
          │         │
          │         ▼ (HTTPS JSON Payload + X-CSRF-Token)
          │   [Express 5 Server (server/src/routes/*.js)]
          │         │
          │         ▼ (Mongoose Schema Validation)
          │   [MongoDB Multi-tenant DB]
          │
          ├── (B) Native Mobile Bridge: via client/lib/nativeAlarm.js & nativeGoogleAuth.js
          │         │
          │         ▼ (Capacitor Message Passing / JSON Bridge)
          │   [Android Java Plugin (android/app/src/main/java/.../NativeAlarmPlugin.java)]
          │         │
          │         ▼ (Android System AlarmManager / Google Play Services)
          │   [Hardware WakeLock, Speaker Ringing & Exact Background Schedule]
          │
          └── (C) Offline Resiliency: via client/lib/outboxClient.js & idbStore.js
                    │
                    ▼ (IndexedDB Browser Storage)
              [Transient Queue flushed upon navigator.onLine event]
```

## 2. Directory & Architecture Map
- `capacitor.config.ts`:
  - Android bundle builds load `server.url` (`https://made-your-dream-bigger.vercel.app/app`) for web updates and same-origin `/api` proxy/auth requests; `CAPACITOR_SERVER_URL` can override the origin.
  - Keeps local web assets as the Capacitor bundle and declares native plugin bindings (`@capgo/capacitor-social-login`).
- `client/lib/nativeGoogleAuth.js`:
  - Contains `signInWithGoogleNative(webClientId)` to bypass Chromium WebView `disallowed_useragent` blocks.
- `client/components/PrivateApp.jsx`:
  - Contains `GoogleSignInButton` with 48px touch-target, spinner feedback, and reactive state stores.
- `android/app/src/main/java/com/madeyourdreambigger/smartroutine/AlarmScheduler.java`:
  - Schedules precise alarms using Android `AlarmManager.setExactAndAllowWhileIdle()`.
- `android/app/src/main/java/com/madeyourdreambigger/smartroutine/AlarmRingingService.java`:
  - Plays audio via `MediaPlayer` with `AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE` and handles screen lock bypass.
- `client/lib/outboxClient.js`:
  - Manages idempotent client mutations, preventing duplicated routine writes during network reconnections.

## 3. Confidentiality Note
This file documents internal endpoints, package names, and native bridge interfaces. Never commit credentials,
and keep these documents out of public-facing web routes or search index crawlers.
