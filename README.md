# Freedom CC

A single-club cricket PWA: register players, run a **match day** of several short
games (5–20 overs a side), let captains pick two sides with a live **balance
report**, and score **ball by ball** the way CricClubs does — auto strike
rotation, over changes, free hits, wickets, all-out and result.

Built with **Next.js (App Router) + Postgres**. One process, deploys to Heroku.
Installs to the phone home screen and runs full-screen like a native app.

## What's in this build

- Club create / join by invite code, sign-in (email + password)
- Registration with a consent & responsibility waiver (version + timestamp + IP stored)
- Roles + self-rating (batting / bowling / fielding), player directory
- Match days with a turnout list; several matches per day
- Squad board: assign sides, captain, keeper; overs presets; rule toggles
- Balance report: per-side score /10, strengths, weaknesses, A-vs-B verdict
- Scoring engine (`lib/scoring/engine.ts`) — event-sourced, fully derived, with `Undo`
- Live scorecard, polled every 5s, cached for offline viewing
- PWA: manifest, service worker (offline shell), install prompt

Next build: earned ratings + badges + leaderboards, an offline write-queue for
scoring, super over, and post-match stat roll-ups.

## Run it locally

```bash
cp .env.example .env
docker compose up -d          # local Postgres on :5432
npm install
npm run migrate
npm run dev                    # http://localhost:3000
```

Open the app, create the club (first account is admin), share the invite code.

```bash
npm test                       # scoring-engine unit tests (vitest)
```

### Nicer icons (optional)

The manifest ships an SVG icon that installs fine on Android. For crisp PNG icons
on iOS / older Android:

```bash
npm i -D sharp
npm run gen:icons
```

## Deploy to Heroku

```bash
heroku create freedom-cc
heroku addons:create heroku-postgresql:essential-0
heroku config:set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
heroku config:set APP_URL=https://freedom-cc.herokuapp.com
git push heroku main
```

`Procfile` runs migrations on every release and starts one web dyno. Do **not**
switch to SQLite — Heroku's filesystem is ephemeral and the data would vanish on
each restart.

## Shape of the code

```
app/(app)/…            authenticated screens (home, players, play, profile)
app/api/…              route handlers (auth, club, match-days, matches, events)
lib/scoring/engine.ts  the ball-by-ball reducer — the heart of the app
lib/balance.ts         team balance analyzer
lib/match.ts           loads a match + folds its event log into scorecards
db/migrations/         plain SQL, applied by scripts/migrate.mjs
public/sw.js           offline app shell
```
