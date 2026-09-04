import { execFileSync } from "node:child_process";

/**
 * Before the journey runs: wipe the local database so the club can be created
 * fresh. Skipped for a non-local BASE_URL (point that at a throwaway test DB).
 */
export default async function globalSetup() {
  const base = process.env.BASE_URL || "http://localhost:3000";
  if (!/localhost|127\.0\.0\.1/.test(base)) {
    console.log(`[global-setup] BASE_URL is remote (${base}) — skipping db reset.`);
    return;
  }
  console.log("[global-setup] resetting local database…");
  execFileSync(process.execPath, ["scripts/reset-db.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
}
