# End-to-end automation (Playwright)

Drives a real browser through the whole app in one run: admin creates a club →
players register (UI + API) → profiles → **profile photos, account edits,
password resets** (self-serve and admin-issued, for players *and* admins) →
team selection with the balance report → a **full ball-by-ball two-innings
match** → live scorecard → sign-out. Plus a small PWA check.

## What it needs

- Local Postgres running (`docker compose up -d`)
- One-time: `npx playwright install chromium`
- The dev server — Playwright starts it automatically if it isn't already up
- `SMTP_URL` left **unset** for local runs — reset emails then land in the
  `email_outbox` table, which `e2e/db.ts` reads directly to complete the
  self-serve reset flows without a real inbox

## Run it

```bash
npm run test:e2e            # headless; resets the local DB first
npm run test:e2e:headed     # watch it in a browser window
npm run test:e2e:ui         # Playwright UI mode — step through, time-travel
npm run test:e2e:report     # open the HTML report (video + trace) after a run
```

> The `journey` run **wipes the local database** (via `scripts/reset-db.mjs` in
> `global-setup`) so the club can be created fresh. Don't run it against data you
> care about.

## Against a deployed instance

```bash
BASE_URL=https://your-app.herokuapp.com npm run test:e2e
```

The DB reset is skipped for a non-local URL, so point it only at a **throwaway
test database** with an empty `clubs` table. `e2e/db.ts` also needs a
`DATABASE_URL` it can reach (it reads its own `.env`, not the deployed one) —
for a remote target, export it in the shell instead.

## Layout

```
playwright.config.ts     projects: "journey" (Pixel 7, SW blocked) + "pwa"
e2e/
  global-setup.ts        resets the local DB
  fixtures.ts            registerViaApi() helper (isolated cookie jar), field()
  db.ts                  latestResetLink() — reads a reset email's link straight
                          from email_outbox, for asserting the self-serve flow
  pages/scorer.ts         page object for the scoring console
  full-journey.spec.ts    the serial end-to-end walk-through
  pwa.spec.ts             manifest / service worker / offline checks
```

Serial, single worker — the app allows one club per deployment, so the journey
is stateful and ordered. Each step is its own `test()` so the report shows
exactly where a failure happened.

## Match simulated

2 overs, 4-a-side. Innings 1 exercises: single (strike rotation), wide (no ball
advance), no-ball + free hit, four, six, bye, dot + **Undo**, over completion +
**new-bowler rule** (previous bowler not offered), and wickets — bowled, caught
(fielder + crossed), run-out — to **all out**. Innings 2 chases the target down.
Result asserted: `Side B won by 3 wickets (N balls to spare)`.

## Screenshots

Every key screen gets a numbered, full-page screenshot as the journey passes
through it — `e2e/screenshots/01-welcome.png`, `02-admin-sign-in.png`, …
`29-signed-out-welcome.png` — so there's an accurate visual record of each step
beyond the pass/fail dot, without opening the HTML report. Overwritten each
run; not committed (gitignored). Failure screenshots and full videos still land
in `test-results/` / the HTML report as before.

## Profiles, photos & password resets covered

- Player uploads a profile photo (client-resized PNG), edits name/email from
  `/profile`, and is blocked from stealing another member's email
- The photo shows up in the players directory
- **Self-serve reset**: `/sign-in` → "Forgot your password?" → `/forgot-password`
  → email link (read from `email_outbox`) → `/reset-password` → signs in with
  the new password
- **Admin-issued reset**: admin opens `/admin/players/[id]`, sets the player's
  photo and name, sends a reset link, the player completes it
- **Admin's own forgotten password**: `/admin/sign-in` → "Forgot your
  password?" → same reset flow → old password rejected (401), new one signs
  back into `/admin`
- `GET /api/members/[id]/avatar` asserted to serve the stored image
