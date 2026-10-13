# A. Architecture Decision Record

Decision: one monorepo with npm workspaces.

Layout
- client          Next.js (Vercel)
- server          Express and Mongoose (Node host)
- shared   Zod schemas, time module, error codes, constants
- ml/               Python training, feature code, parity fixtures

Why monorepo
The time module and validation schemas must match on client and server. One repo gives one source of truth, atomic pull requests for API plus UI changes, and one CI pipeline. Separate repos would need a published package and version coordination for every change.

Responsibilities
- Web: rendering, local cache, service worker, Web Push subscription, Bengali/Gregorian calendar UI. Holds no secrets.
- API: authentication, all authorization, validation, rate limits, Gemini calls, Cloudinary signing, admin, holiday data, reminder scheduler, export and delete.
- Shared: schemas, time logic (built-in Intl with IANA timezone, no date library), error codes.
- ML: training runs offline by a developer. The browser receives only a versioned read-only model file.

Deployment
- Vercel (web): project root client. Only NEXT_PUBLIC_API_URL is set.
- API host (Render or Railway): persistent Node process so the reminder scheduler can run.
- Build the workspaces independently with `npm run build -w client` and `npm run build -w server`; the root `npm run build` runs both. The API build syntax-checks its Node source (the server runs directly from ESM, with no compilation output).
- Start the API with `npm run start -w server`; build and start the web app from the client workspace on its web host.
- MongoDB Atlas: dedicated least-privilege user, IP allow-list.
- Cookies: app.yourdomain and api.yourdomain are same-site, so httpOnly cookies with SameSite=Lax work.
- Boot check: the API refuses to start when required variables are missing or malformed. It names the variables, never their values.
