import { test as base, expect, request as pwRequest, type Page, type Locator } from "@playwright/test";

export { expect };

/**
 * The app renders `<label>Text</label><input/>` as siblings with no for/id, so
 * getByLabel() can't find them. This targets the control that follows a label
 * whose text is exactly `label`.
 */
export function field(page: Page, label: string): Locator {
  return page.locator(
    `label:text-is("${label}") + input, label:text-is("${label}") + select, label:text-is("${label}") + textarea`
  );
}

export interface SeedProfile {
  roles?: ("batter" | "bowler" | "keeper" | "allrounder")[];
  battingStyle?: "right" | "left" | null;
  bowlingType?: "pace" | "off-spin" | "leg-spin" | "left-arm" | null;
  batSelf?: number;
  bowlSelf?: number;
  fieldSelf?: number;
  isKeeper?: boolean;
  happyToCaptain?: boolean;
}

/**
 * Registers a player through the API in an isolated request context (its own
 * cookie jar, never touches the browser page's session), and optionally sets
 * their profile.
 */
export async function registerViaApi(
  baseURL: string,
  inviteCode: string,
  name: string,
  email: string,
  profile?: SeedProfile,
  password = "test1234"
) {
  const ctx = await pwRequest.newContext({ baseURL });
  const res = await ctx.post("/api/auth/register", {
    data: { inviteCode, name, email, password, consent: true },
  });
  if (!res.ok()) {
    throw new Error(`register ${name} failed: ${res.status()} ${await res.text()}`);
  }
  if (profile) {
    const p = await ctx.patch("/api/me", {
      data: {
        phone: "",
        roles: profile.roles ?? [],
        battingStyle: profile.battingStyle ?? null,
        bowlingType: profile.bowlingType ?? null,
        batSelf: profile.batSelf ?? 5,
        bowlSelf: profile.bowlSelf ?? 5,
        fieldSelf: profile.fieldSelf ?? 5,
        isKeeper: profile.isKeeper ?? false,
        happyToCaptain: profile.happyToCaptain ?? false,
      },
    });
    if (!p.ok()) throw new Error(`profile ${name} failed: ${p.status()} ${await p.text()}`);
  }
  await ctx.dispose();
}

export const test = base;
