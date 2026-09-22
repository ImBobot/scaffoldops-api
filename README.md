# ScaffoldOps NZ — API

Express + PostgreSQL backend matching `src/db/schema.sql`.

## Setup
```
cp .env.example .env        # fill in DATABASE_URL and JWT_SECRET
npm install
createdb scaffoldops        # or use an existing Postgres instance
npm run migrate             # runs src/db/schema.sql
npm run dev                 # starts on http://localhost:4000
```

## PWA & mobile
The dashboard is installable as a Progressive Web App straight from the
browser — no app store needed for this one:
- **Android (Chrome)**: visit your Render URL → menu (⋮) → "Install app" /
  "Add to Home screen".
- **iPhone (Safari)**: visit the URL → Share button → "Add to Home Screen".
  (iOS only supports PWA install through Safari specifically — Chrome/Firefox
  on iOS can't trigger it, that's an Apple restriction, not a bug here.)
- **Desktop (Chrome/Edge)**: an install icon appears in the address bar.

Once installed it opens full-screen with no browser chrome, uses the kiwi
logo as its icon, and `sw.js` caches the app shell so it opens instantly
even on a flaky connection — but API calls always hit the network live
(never cached), so you never see stale job/inspection data.

On screens under 900px wide, the sidebar becomes a slide-in drawer opened
by the hamburger button in a top bar, instead of squeezing 10 nav items
into a cramped column. Tables scroll horizontally within their card rather
than squashing columns unreadably, and form inputs are sized at 16px to
stop iOS Safari's annoying auto-zoom-on-focus.

### Camera QR scanning
The Inspection page has a real "Scan QR tag" button — it opens the device
camera (`getUserMedia`) and decodes tags client-side with `jsQR`, no native
app needed. A scanned tag resolves through `GET /scaffolds/by-code/:qrCode`
(the code printed under the tag, not the internal UUID) rather than the
`GET /scaffolds/:id` route, since that's what scanning actually reads. The
manual dropdown is still there as a fallback for desktop or if camera
permission is denied.

### Offline queue
Inspections and handovers that fail to reach the server because there's no
connection (not because of a validation error — that still surfaces
immediately) get saved to IndexedDB instead of lost, with a "N pending
sync" badge in the sidebar. They replay automatically on the browser's
`online` event and every 30 seconds as a fallback, since `online` doesn't
fire reliably on every device.

**Known limit worth knowing**: this only helps once the page has already
loaded with a connection — a crew member cold-opening the app with zero
signal from the start won't get a populated scaffold/worker list to inspect
against, since that data isn't cached. Good enough for "lost signal
mid-job", not yet a fully offline-first app — caching the last-loaded
scaffold/worker lists for that case is a reasonable next step if it turns
out to matter in practice.

**After you deploy this**: bump the `CACHE` name in `public/sw.js` (e.g.
`scaffoldops-shell-v3`) any time you change the app shell, so installed
devices actually pick up the update instead of serving a stale cached copy.

## Dashboard
`public/index.html` is a full back-office dashboard — Companies, Sites, Job
requests, Scheduling, Crew & certs, Materials, Scaffold IDs, Inspection,
Handover, and a manager Dashboard — served as a static page by this same
Express app at `/`. It calls the API at relative `/api/...` paths, so it's
always same-origin: no CORS setup, no separate deployment, and no "connect
to your API" step. Visit your Render URL in a browser and it's there.

Nav items and action buttons are filtered by the logged-in user's role, but
that's a UI convenience only — the API enforces every permission itself
regardless of what the dashboard shows.

**First-time setup order matters**, since almost everything has a foreign
key: create your own **contractor company** first (Companies page), then
workers/crews/materials will have somewhere to attach to; add a **client
company** and a **site** before raising a job request against it.

**Known shortcut to fix before relying on this daily**: inspection photos
and handover signatures are currently POSTed to `/documents` with the raw
base64 data URL as `file_url`. That works, but bloats the database fast —
swap it for a real upload to cloud storage (S3 signed URL) and store just
the resulting URL instead.

## Auth model
- `POST /users/login` — open, rate-limited to 10 attempts / 15 min per IP.
- `POST /users/register` — open ONLY when `role: "builder"` (a client
  self-registering to raise job requests). Registering any internal role
  (admin/manager/supervisor/worker) requires an existing admin's bearer
  token. **Bootstrapping the very first admin**: since no admin exists yet,
  insert one directly via SQL after migrating —
  ```sql
  insert into users (role, full_name, email, password_hash)
  values ('admin', 'Your Name', 'you@company.co.nz', '<bcrypt hash>');
  ```
  Generate the bcrypt hash with `node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"`.
- Every other route requires `Authorization: Bearer <token>` from `/users/login`.
  Internal-only resources (workers, certifications, crews, jobs, scaffolds,
  inspections, handovers, dashboard) additionally require an internal role
  (admin/manager/supervisor/worker) — a builder token is rejected with 403.
  Mutating endpoints (create/schedule/adjust stock/issue a tag) further
  require admin or manager (tag issuance also allows supervisor).

## Validation
Every POST/PATCH body is checked against a zod schema in
`src/validation/schemas.js` before it touches the database. A bad request
gets a 400 with a field-by-field `details` object instead of a raw SQL error.

## Resource routes (all under /api)
- `POST /users/register`, `POST /users/login`, `GET /users/me`
- `GET|POST /companies` (POST: admin/manager)
- `GET|POST /workers` (internal roles only; POST: admin/manager)
- `GET /certifications/worker/:workerId`, `POST /certifications` (admin/manager)
- `GET|POST /crews`, `POST /crews/:id/members`, `GET /crews/:id` (internal; mutations: admin/manager)
- `GET|POST /sites` (any authenticated role)
- `GET|POST /job-requests` (any authenticated role), `POST /job-requests/:id/schedule` (admin/manager)
- `GET /jobs`, `GET /jobs/:id`, `GET /jobs/:id/materials-check` (internal roles)
- `GET|POST /materials`, `PATCH /materials/:id/stock` (internal; mutations: admin/manager)
- `GET|POST /scaffolds` (internal; POST: admin/manager/supervisor), `GET /scaffolds/:id`, `GET /scaffolds/by-code/:qrCode` (what the camera scanner actually calls)
- `POST /inspections`, `GET /inspections/scaffold/:scaffoldId` (internal roles)
- `POST /handovers`, `GET /handovers` (internal roles)
- `POST /documents`, `GET /documents/:ownerType/:ownerId` (any authenticated role)
- `GET /dashboard/summary` (admin/manager only)

## Notes
- `POST /job-requests/:id/schedule` checks crew competency against the job's
  work_type inside a transaction before creating the job row
  (see `utils/competency.js`).
- `POST /inspections` updates `scaffolds.status` in the same transaction as
  the inspection insert, so the tag colour is always in sync.
- File uploads (photos, signatures): this API assumes photos/signatures are
  uploaded client-side to cloud storage (S3 or similar) first, and only the
  resulting `file_url` is POSTed to `/documents`. Add a signed-upload-URL
  route when you wire that up.
- `helmet()` sets standard security headers; `express-rate-limit` currently
  only guards `/users/login` — add it elsewhere if you see abuse.

#
Set up this Neon project in the current working directory.

1. `npm i -g neon@latest && neon login`
2. `neon skills -y`
3. `neon mcp -y`
4. `neon link --project-id damp-lab-15346523 --branch production -y`
5. `neon config init`
6. Update `neon.ts`:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

7. `neon deploy`