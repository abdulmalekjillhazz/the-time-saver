# Phase 4 — Native alarm STOP/SNOOZE lifecycle fix

## Finding
`AlarmRingingActivity.finishAlarm()` started `AlarmRingingService` with `startForegroundService()` on Android O and later for both STOP and SNOOZE. The service handles these actions before `startForeground()` is called. Android requires a service launched through `startForegroundService()` to promote itself promptly, so these action paths could cause a foreground-service timeout exception.

## Change
The activity now calls `startService()` for STOP/SNOOZE. The activity is visible and the action is a direct user interaction, so a normal service start is appropriate. The service's `ACTION_RING` path continues to be started as a foreground service by `AlarmReceiver`.

## Verification
- `node --test client/tests/template-client-id.test.js`: 3/3 passed.
- `node --check client/lib/templateClientId.js`: passed.
- `node --check server/src/services/gamificationStats.js`: passed.
- Source-level assertion: STOP/SNOOZE activity path uses `startService()` and no longer uses `startForegroundService()`.

## Not yet verified
- Android Gradle build: no Android SDK configured in this environment.
- Real-device behavior with screen locked/off, notification permission, exact-alarm access, full-screen intent access, and manufacturer battery restrictions.
