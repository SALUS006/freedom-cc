import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

// The Playwright process doesn't load .env (only the dev server does), so read it
// here for the DATABASE_URL used to verify emails/tokens the API doesn't return.
function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set — is Postgres running and .env present?");
  const local = /localhost|127\.0\.0\.1/.test(url);
  const client = new pg.Client({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** The password-reset link from the most recent reset email sent to `email`. */
export async function latestResetLink(email: string): Promise<string | null> {
  return withClient(async (c) => {
    const { rows } = await c.query<{ body: string }>(
      `select body from email_outbox
        where lower(to_email) = lower($1) and subject ilike 'Reset%'
        order by created_at desc limit 1`,
      [email]
    );
    if (!rows[0]) return null;
    return (rows[0].body.match(/https?:\/\/\S+\/reset-password\?token=\S+/) ?? [])[0] ?? null;
  });
}
