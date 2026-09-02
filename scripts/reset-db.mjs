// Wipes ALL club data (clubs, members, matches, events, emails) but keeps the
// schema. Use it to clear test data and start a fresh club.
//   npm run db:reset
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });

await client.connect();
await client.query(`
  truncate table
    email_outbox,
    match_events, innings, match_squads, matches,
    match_day_players, match_days,
    rating_changes, members, clubs
  restart identity cascade
`);
await client.end();
console.log("database cleared — open /welcome to create a fresh club");
