# End-to-end automation (Playwright)

Drives a real browser through the whole app in one run: admin creates a club →
players register (UI + API) → profiles → team selection with the balance report →
a **full ball-by-ball two-innings match** → live scorecard → sign-out. Plus a
small PWA check.

## What it needs

- Local Postgres running (`docker compose up -d`)
- One-time: `npx playwright install chromium`
- The dev server — Playwright starts it automatically if it isn't already up

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
test database** with an empty `clubs` table.

## Layout

```
playwright.config.ts     projects: "journey" (Pixel 7, SW blocked) + "pwa"
e2e/
  global-setup.ts        resets the local DB
  fixtures.ts            registerViaApi() helper (isolated cookie jar)
  pages/scorer.ts        page object for the scoring console
  full-journey.spec.ts   the serial end-to-end walk-through
  pwa.spec.ts            manifest / service worker / offline checks
```

Serial, single worker — the app allows one club per deployment, so the journey
is stateful and ordered. Each step is its own `test()` so the report shows
exactly where a failure happened.

## Match simulated

2 overs, 4-a-side. Innings 1 exercises: single (strike rotation), wide (no ball
advance), no-ball + free hit, four, six, bye, dot + **Undo**, over completion +
**new-bowler rule** (previous bowler not offered), and wickets — bowled, caught
(fielder + crossed), run-out — to **all out**. Innings 2 chases the target down.
Result asserted: `Team B won by 3 wickets (N balls to spare)`.
