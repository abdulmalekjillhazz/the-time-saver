# Phase 6 — Template retry ID lifecycle

## Bug
The template client ID was persisted permanently per user/template. After the server successfully created a routine, later intentional uses of the same template could reuse the old `clientId`; the server's idempotency check would return the original routine instead of creating a new one. Reconciliation also called the allocating ID helper, which could create IDs as a side effect merely while inspecting outbox state.

## Fix
- Added `peekTemplateClientId()` to inspect a pending ID without allocating one.
- Added `clearTemplateClientId()` to release the ID after the outbox confirms the operation.
- `TemplatePicker` retains the ID while an operation is pending/retryable, so retry attempts remain idempotent.
- After a confirmed delivery, the ID is cleared, so a future intentional add gets a fresh ID.
- Outbox reconciliation now only reads existing IDs and does not create new ones as a side effect.
- Added a regression test covering pending retry ID reuse and fresh ID allocation after confirmed success.

## Validation
- `node --test client/tests/template-client-id.test.js`: 4/4 tests passed.
- Full frontend build, full test suite, backend integration tests, and physical Android validation were not run in this environment.
