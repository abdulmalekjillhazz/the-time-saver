# Phase 5 — Reflection scoring and save reliability

## Root cause found
`EveningReflectionModal` used a raw `fetch()` for an authenticated POST. Unlike `apiRequest()`, it did not fetch/send the CSRF token required by the API. It also silently ignored non-2xx responses, so users saw no explanation when the save failed.

## Changes
- Use the shared CSRF-aware `apiRequest()` helper.
- Display a localized error when saving fails and always reset the loading state.
- Remove the unconditional `+30 XP` claim from the save button.
- Award reflection XP only when a reflection is first created for a date; editing that date's reflection returns `earnedXP: 0`. The XP dashboard is based on reflection count, so this keeps the response consistent with the score.
- Dispatch the existing `smart-routine:sync` event after a successful save so the gamification bar refreshes immediately.
- Add an integration test for first-save vs edit XP behavior.

## Validation
- `node --check` passed for changed JavaScript files.
- Full Vitest integration tests were not run in this environment because the archive does not contain installed test dependencies and `MONGODB_URI_TEST` is not configured.
- Physical Android testing is not part of this phase.
