# Freedom CC

A single-club cricket PWA: register players, run a **match day** of several short
games (5–20 overs a side), let captains pick two sides with a live **balance
report**, and score **ball by ball** the way CricClubs does — auto strike
rotation, over changes, free hits, wickets, all-out and result.

Built with **Next.js (App Router) + Postgres**. One process, deploys to Heroku.
Installs to the phone home screen and runs full-screen like a native app.

## What's in this build

- Club create / join by invite code, sign-in (email + password)
- Registration with a consent & responsibility waiver (version + timestamp + IP
  stored, and a confirmation copy emailed to the player)
- Profile pictures, editing your own name/email, forgot-password from the
  landing screen — and an admin console to do the same for any player
  (including resetting their password) or the admin's own
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

### Email (free)

Without any email config, every email (waiver receipts, invites, password
resets) is printed to the server console and logged to `email_outbox` — the app
is fully usable, players/admins just relay temp passwords and reset links by
hand. To actually send them:

**[Brevo](https://www.brevo.com)** (recommended) — 300 emails/day free, forever, no card:

1. Sign up, verify your sending email address (check your inbox for their link).
2. **Settings → SMTP & API → SMTP tab** — note the login, click **Generate a new SMTP key**.
3. Set on Heroku (or `.env` locally):
   ```bash
   heroku config:set SMTP_HOST=smtp-relay.brevo.com
   heroku config:set SMTP_PORT=587
   heroku config:set SMTP_USER=your-brevo-login-email@example.com
   heroku config:set SMTP_PASS=your-brevo-smtp-key
   heroku config:set MAIL_FROM="Freedom CC <your-verified-sender@example.com>"
   ```

**Gmail** works too for a small club (personal-account sending limits apply):
enable 2-Step Verification, create an [App Password](https://myaccount.google.com/apppasswords),
then `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com`,
`SMTP_PASS=<the 16-char app password>`.

No restart needed on Heroku — `config:set` restarts the dyno automatically.
Verify with `heroku logs --tail` while triggering a reset; look for
`email send failed` (bad credentials) vs. the entry moving to `status = sent`
in `email_outbox`.

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
