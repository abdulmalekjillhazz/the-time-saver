# Release candidate 1.0.0-rc.1 (restructured, with first fixes)

This is a release candidate. It is not a production release. Read the "Still open" section before deploying anything.

## What changed in this release

1. The folders are now `server/` (was apps/api), `client/` (was apps/web), and `shared/` (was packages/shared). Package names are unchanged, so imports and CI keep working.
2. Client (Phase 0 quick wins): the footer draft notice and the navigation labels are bilingual. The mobile menu has a 44px button, `aria-expanded`, Escape to close with focus returned, and closes when a link is chosen. The home page has one primary action. Copy about unbuilt features is reworded, and a claim about contact details that the page did not contain is removed.
3. Client (font): the Bangla font is now served from this site by the `@fontsource/noto-sans-bengali` package. The build no longer downloads anything from Google, and users' browsers no longer contact Google for the font.
4. Server (audit item 1): an offline batch refused with a permanent 4xx is split until the bad operation is found. Only that operation is marked failed. Network errors, 5xx, 408, and 429 keep every operation pending.
5. Server (audit item 2): empty optional environment values count as unset, so a copied `.env.example` boots.
6. Server (audit item 3): a trailing slash in `CLIENT_ORIGIN` is removed. A path or query string is refused.
7. Server (audit item 4): every header whose name ends in token, secret, key, password, cookie, or authorization is redacted from request logs. This includes `X-Ready-Token`.

## Verification log (commands run in the build sandbox)

| Check | Result |
|---|---|
| `npm install` | Passes |
| `npm run lint` | Passes, no errors |
| Unit tests, server | 71 pass |
| Unit tests, shared | 67 pass |
| Unit tests, client | 15 pass |
| Contrast check (client) | 6 pairs pass, 0 fail |
| JSX parse, all `.jsx` files | 13 files, 0 failures |
| `npm run build -w client` | Passes. Every page, sitemap, and robots file generated. |
| SEO checks against the built site | 24 pass |

## Not verified here

- Integration tests (68 database tests). They need MongoDB, which the sandbox cannot run. They have never run. CI's integration job is the first real run.
- Playwright browser tests (the 360px layout, the menu behaviour, axe accessibility). The sandbox cannot download browsers.
- Lighthouse budgets and the PWA install check.
- Real phones, Android and iPhone, and real PCs.
- The server running against MongoDB, with real sessions, sync, push, and reminders.

## Still open (do these before production)

- Stage 0: the database tests must run and pass in CI. The integration suites currently skip silently when `MONGODB_URI_TEST` is unset, and CI would still show green. The suites also wipe whatever database the URI names, with no check on the name.
- Audit item 5 and 6: sync errors (validation failures and a lost completion update) still return a server error or leave the client stuck.
- Audit item 7: outbox automatic retry is not scheduled yet in the browser.
- Audit item 8: the site URL still defaults to localhost in production builds.
- Audit item 9 to 16: see `docs/` and the audit list.
- Phases 1 to 8 (design system, Today screen, PWA install, reminders, learning, trust and control, insight) and the browser-based tests.
- Bangla copy needs a native speaker's review. `SEO_BN_INDEXABLE` stays false until then.
- Privacy policy and terms need a lawyer's review.

## rc2: Phase 1, design system

- Colours, radius, and focus styles are CSS variables in `client/app/globals.css`. Tailwind reads them, so light and dark themes share one set of names.
- Dark theme follows the device setting and can be forced with `data-theme="dark"` or `data-theme="light"`.
- Components: Button, Card, StatusChip (done, missed, skipped, each with a text label), and AiBadge ("AI, may be wrong" in both languages).
- Reduced motion turns off animation and smooth scrolling.
- Tests: the light tokens match `lib/palette.js`, the dark theme defines every token, text pairs in both themes meet 4.5:1, no component uses a raw hex colour, and interface labels exist in both languages.
- Still open in Phase 1: the header and footer brand colours have not been reviewed in dark mode. Check them on a device.

## rc3: Stage 0 status (database tests)

Acceptance for Stage 0 is a green integration job on a pull request. That has not happened yet. This is what is known.

Done in rc3:
- The integration run refuses to start without `MONGODB_URI_TEST`. Before this, a missing variable made the suites skip, and a skipped run can look green.
- The run also refuses a database whose name does not contain "test", because the suites wipe that database first.
- CI now uses `smart-routine-test` as its database name, so the guard accepts it.
- Test counts in PHASE4, PHASE5, and PHASE8 are corrected to 8 (lessons), 16 (admin), and 68 (total).

Diagnostic results (local only, not part of the release):
- The sandbox cannot run MongoDB 4.2 or newer. Its download site is blocked. A MongoDB 3.6 server runs, but the Node driver used by Mongoose requires 4.2 or newer.
- FerretDB 1.24 (a MongoDB-compatible server with a SQLite backend) was used as a stand-in. With index setup softened, 56 of 68 tests passed.
- The 12 failures are all in admin.test.js. They come from one FerretDB limitation: it does not support the field projection that Mongoose adds to findOneAndUpdate. This is not confirmed as an application bug. Real MongoDB supports this projection.
- Four suites (flags, ml, ops, push, and parts of others) create TTL or partial indexes. FerretDB cannot create those, so those tests could not be checked here at all.

Still open for Stage 0:
- CI's integration job must be green on a pull request. Paste its summary when it runs.
- Any failures CI reports must be fixed, and the count must reach 68 executed tests.
