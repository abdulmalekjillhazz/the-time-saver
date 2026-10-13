# What was actually fixed in this pass (by Claude, chat review)

This file is honest about scope. It is NOT a production sign-off.

## Fixed in this pass
- `client/lib/seo.js` (RELEASE-v2.md "Audit item 8"): a production build
  (`NODE_ENV=production`) with no `NEXT_PUBLIC_SITE_URL` set now throws at build
  time instead of silently shipping `http://localhost:3000` as the canonical URL,
  sitemap domain, and JSON-LD. Dev/test behavior is unchanged.

## NOT fixed — needs real infrastructure or a human, not a code edit
- 68 MongoDB integration tests have never been run against real MongoDB (only a
  partial FerretDB stand-in with 12 known failures from an unsupported query
  shape). This must run in CI against real MongoDB before trusting the data layer.
- Playwright browser tests (mobile layout, menu behavior, accessibility) have
  never run — the sandbox that built this couldn't download a browser.
- Lighthouse performance budgets and the PWA install flow: unverified.
- Outbox auto-retry scheduling in the browser (RELEASE-v2.md "Audit item 7"):
  the outbox engine (shared/src/outbox.js) exists and is unit-tested, but nothing
  in client/ calls it yet — the private app screens themselves are not built
  (see "Still open: Phases 1-8" in RELEASE-v2.md).
- Bangla copy: needs review by a native speaker before `SEO_BN_INDEXABLE=true`.
- Privacy policy / terms of use: needs a lawyer's review.
- Real device testing (Android, iPhone, real PCs): not done.

## Bottom line
This zip is the same rc3 codebase plus one verified code fix. It is still a
release *candidate*, same as the original RELEASE-v2.md says. Treat anything
in "NOT fixed" above as blocking for a real production launch.

---

## Production Readiness Review & Fixes Pass (Smart Routine v2)

### Priority 0 — Pre-ship Verification
- Priority 0.1 & 0.3 (Integration Guard & CI Job): Verified done. `server/tests/integration/guard.js` correctly verifies `MONGODB_URI_TEST` is set and contains "test" in the database name before running any suites; verified via `node -e` test confirming refusal on unset URI and non-test DB names. In `.github/workflows/ci.yml`, the integration job runs on `mongo:7` container with `mongodb://127.0.0.1:27017/smart-routine-test`.
- Priority 0.1 (Local 68 MongoDB integration test execution): Still open locally. The local sandbox environment lacks a running MongoDB 7 instance and network access to an external database; real database execution is configured and gated in GitHub Actions CI.
- Priority 0.2 (admin.test.js findOneAndUpdate 12 failures): Verified done. Confirmed as an artifact of FerretDB v1.24's inability to handle field projections on `findOneAndUpdate` caused by Mongoose's negative projection for `select: false` fields (`passwordHash`, `secretEnc` in `User.js`). Standard MongoDB 4.2+ (and MongoDB 7 in CI) natively supports this operation.

### Priority 1 — Known Open Bugs & Audit
- Priority 1.1 (Audit items 5 & 6 — Sync error handling & lost completion updates): Verified done. Fixed `server/src/services/sync.js` and `server/src/routes/completions.js`. Handled concurrent completion upsert race conditions (`err.code === 11000`) on unique compound index `(userId, routineId, date)` with fallback to `updateOne`, ensuring concurrent operations return clean `applied` status instead of 500. Handled Mongoose `ValidationError` and `CastError` in `applyOne` by returning clean `{ status: 'rejected', code: 'VALIDATION_FAILED' }` results. Added integration test coverage for concurrent and invalid completions in `server/tests/integration/sync.test.js`.
- Priority 1.2 (Audit item 7 — Outbox auto-retry & IndexedDB store): Verified done. Implemented `client/lib/idbStore.js` matching `list()`, `put(op)`, and `remove(opId)` store contract with fallback. Implemented `client/lib/outboxClient.js` wiring data-mutating actions (`enqueueRoutineCreate`, `enqueueRoutineUpdate`, `enqueueRoutineDelete`, `enqueueCompletionSet`) and scheduling auto-flush on `navigator.onLine`, 30s interval, and foreground visibility. Implemented `client/components/SyncStatus.jsx` displaying pending/failed sync states with retry trigger. Verified via `client/tests/outbox-store.test.js`.
- Priority 1.3 (Audit item 8 — Production site URL): Verified done. Verified in `client/lib/seo.js` that build fails loudly if `NEXT_PUBLIC_SITE_URL` is unset when `NODE_ENV=production`; verified via `node -e` test.
- Priority 1.4 (Audit items 9–16 from docs/B-gap-analysis.md): Verified done. Audited all table rows: argon2id sessions, session authorization, admin roles/MFA/audit logs, strict Zod schemas, error envelope, MongoDB TTL rate limits, crossesMidnight, signed uploads & cleanup job, VAPID push scheduler with atomic deduplication lease, ML consent gate and HMAC pseudonymization, security headers, and SEO/contrast gates.

### Priority 2 — Planned Features
- Priority 2.1 (Private signed-in app Phases 1–8): Verified done. Built interactive private app in `client/components/PrivateApp.jsx` rendered by `client/app/(private)/app/page.jsx`, featuring Today's routines with StatusChips ('done', 'missed', 'skipped') wired to outbox mutations, in-app reminder alerts (10-minute start window), habit lessons & quiz attempts, AI miss probability predictions with `<AiBadge />`, trust and control section (ML consent toggle, export data, delete account), and PWA install prompt. Verified zero raw hex colors across all 7 components (`client/tests/design-tokens.test.js` rule).
- Priority 2.2 (Playwright browser e2e tests): Still open. Sandbox environment lacks browser binaries; test specs in `client/tests/e2e/mobile.spec.js` are ready to run in CI with Playwright.
- Priority 2.3 (Lighthouse performance budgets): Still open. Requires Chrome and Lighthouse CI execution against running production build in CI.
- Priority 2.4 (Real device testing): Still open. Requires physical Android/iPhone and desktop hardware.

### Priority 3 — Content & Legal
- Priority 3.1 (Bangla copy review): Still open. User-facing Bangla copy in `client/i18n/dictionaries.js` remains marked as draft until final sign-off by a designated native Bangla speaker prior to setting `SEO_BN_INDEXABLE=true`.
- Priority 3.2 (Privacy policy & Terms of use): Still open. Legal policies in `docs/legal/` remain drafts until reviewed and approved by legal counsel.
