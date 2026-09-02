import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load .env for local runs (Heroku injects real env vars, so this is a no-op there).
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const dir = path.join(root, "db", "migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and start Postgres (docker compose up -d).");
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });

await client.connect();
await client.query(
  "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())"
);
const applied = new Set(
  (await client.query("select name from _migrations")).rows.map((r) => r.name)
);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let ran = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = readFileSync(path.join(dir, file), "utf8");
  process.stdout.write(`applying ${file} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into _migrations(name) values ($1)", [file]);
    await client.query("commit");
    ran++;
    console.log("ok");
  } catch (err) {
    await client.query("rollback");
    console.log("failed");
    console.error(err);
    await client.end();
    process.exit(1);
  }
}
await client.end();
console.log(ran === 0 ? "migrations already up to date" : `done (${ran} applied)`);
