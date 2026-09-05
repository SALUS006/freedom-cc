import { test, expect, field, registerViaApi } from "./fixtures";
import { devices, type BrowserContext, type Page } from "@playwright/test";
import { Scorer } from "./pages/scorer";
import { hasEmail, latestResetLink } from "./db";
import { mkdirSync } from "node:fs";
import path from "node:path";

// A numbered screenshot per key screen — proof of what each step actually
// rendered, beyond the failure-only screenshots and the video capture.
const SCREEN_DIR = path.join(process.cwd(), "e2e", "screenshots");
mkdirSync(SCREEN_DIR, { recursive: true });
let shotSeq = 0;
async function snap(page: Page, name: string) {
  shotSeq += 1;
  await page.screenshot({
    path: path.join(SCREEN_DIR, `${String(shotSeq).padStart(2, "0")}-${name}.png`),
    fullPage: true,
  });
}

/**
 * End-to-end walk-through of the whole app: admin creates a club, players
 * register (UI + API), profiles, team selection with the balance report, a full
 * ball-by-ball two-innings match simulation, live scorecard, sign-out.
 *
 * One shared browser context for the whole run (a single continuous session),
 * serial, single worker — the app allows one club per deployment.
 */
test.describe.configure({ mode: "serial" });

const ADMIN = { name: "Club Admin", email: "admin@test.cc", password: "test1234" };
const INVITEE = { name: "Invitee One", email: "invitee@test.cc" };
const PW = "test1234";

let context: BrowserContext;
let page: Page;
let baseURL = "";
let inviteCode = "";
let inviteeTempPassword = "";
let matchId = "";
let dayId = "";

test.beforeAll(async ({ browser }, testInfo) => {
  baseURL = (testInfo.project.use.baseURL as string) ?? "http://localhost:3000";
  context = await browser.newContext({
    baseURL,
    ...devices["Pixel 7"],
    serviceWorkers: "block",
  });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
});

async function signIn(email: string, password: string, opts: { expectFail?: boolean } = {}) {
  await page.request.post("/api/auth/sign-out").catch(() => {});
  await page.goto("/sign-in");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  if (opts.expectFail) {
    await expect(page.locator(".error")).toBeVisible();
  } else {
    await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 15000 });
  }
}

test.describe("Freedom CC — full journey", () => {
  test("landing page shows only player options", async () => {
    await page.goto("/welcome");
    await expect(page.getByRole("link", { name: "Player sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register with a club code" })).toBeVisible();
    await expect(page.getByRole("link", { name: /admin sign in/i })).toHaveCount(0);
    await expect(page.getByText(/invite code/i)).toHaveCount(0);
    await snap(page, "welcome");

    // no visible admin button, but the logo is a quiet way in
    await page.getByTestId("admin-icon-link").click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await snap(page, "admin-sign-in");
  });

  test("admin creates the club", async () => {
    await page.goto("/admin/sign-in");
    await expect(page.getByRole("button", { name: /sign in as admin/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot your password/i })).toBeVisible();
    await page.getByRole("link", { name: /create one/i }).click();

    await expect(page.getByRole("heading", { name: /create your club/i })).toBeVisible();
    await field(page, "Club name").fill("Test CC");
    await field(page, "Your name").fill(ADMIN.name);
    await field(page, "Email").fill(ADMIN.email);
    await field(page, "Password").fill(ADMIN.password);

    const submit = page.getByRole("button", { name: /create club/i });
    await expect(submit).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page).toHaveURL(/\/admin$/);
    inviteCode = (await page.getByTestId("invite-code").innerText()).trim();
    expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);
    await snap(page, "admin-console");

    // the admin accepted the waiver too — they get a confirmation copy
    expect(await hasEmail(ADMIN.email, "consent confirmation")).toBe(true);
  });

  test("admin adds a player by email (invite)", async () => {
    await page.goto("/admin");
    await field(page, "Name").fill(INVITEE.name);
    await field(page, "Email").fill(INVITEE.email);
    await page.getByRole("button", { name: /add .*invite/i }).click();

    const notice = page.locator(".notice, .error").first();
    await expect(notice).toBeVisible();
    const text = await notice.innerText();
    inviteeTempPassword = (text.match(/([A-Z0-9]{4}-[A-Z0-9]{4})/) ?? [])[1] ?? "";
    expect(inviteeTempPassword, `temp password in: "${text}"`).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    await expect(page.getByText(INVITEE.email)).toBeVisible();
    await expect(page.getByText("Invited").first()).toBeVisible();
    await snap(page, "admin-invite-sent");
  });

  test("three players register through the UI", async () => {
    for (const n of [1, 2, 3]) {
      await page.request.post("/api/auth/sign-out");
      await page.goto("/register");
      await field(page, "Invite code").fill(inviteCode);
      await field(page, "Full name").fill(`Player-${n}`);
      await field(page, "Email").fill(`player${n}@test.cc`);
      await field(page, "Password").fill(PW);

      const submit = page.getByRole("button", { name: /create account/i });
      await expect(submit).toBeDisabled();
      await page.getByRole("checkbox").check();
      if (n === 1) await snap(page, "register-form");
      await submit.click();
      await expect(page).not.toHaveURL(/\/register/);
    }
    await page.request.post("/api/auth/sign-out");

    // each of them gets a waiver confirmation email
    expect(await hasEmail("player1@test.cc", "consent confirmation")).toBe(true);
  });

  test("bulk-register the rest of the squad via API", async () => {
    const spread = [
      { n: 4, p: { roles: ["keeper", "batter"], isKeeper: true, batSelf: 7, bowlSelf: 3, fieldSelf: 8 } },
      { n: 5, p: { roles: ["bowler"], batSelf: 4, bowlSelf: 8, fieldSelf: 6, happyToCaptain: true } },
      { n: 6, p: { roles: ["allrounder"], batSelf: 7, bowlSelf: 7, fieldSelf: 6 } },
      { n: 7, p: { roles: ["batter"], batSelf: 8, bowlSelf: 3, fieldSelf: 5 } },
      { n: 8, p: { roles: ["keeper"], isKeeper: true, batSelf: 6, bowlSelf: 3, fieldSelf: 7 } },
      { n: 9, p: { roles: ["bowler"], batSelf: 3, bowlSelf: 8, fieldSelf: 6 } },
      { n: 10, p: { roles: ["batter"], batSelf: 6, bowlSelf: 4, fieldSelf: 5 } },
    ];
    for (const { n, p } of spread) {
      await registerViaApi(baseURL, inviteCode, `Player-${n}`, `player${n}@test.cc`, p as never);
    }
  });

  test("invited player completes onboarding", async () => {
    await signIn(INVITEE.email, inviteeTempPassword);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
    await snap(page, "onboarding");
    await field(page, "New password").fill("brandnew123");
    await field(page, "Confirm password").fill("brandnew123");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /finish sign-up/i }).click();
    await expect(page).not.toHaveURL(/\/onboarding/);

    // invited players accept the waiver on first sign-in too — same receipt
    expect(await hasEmail(INVITEE.email, "consent confirmation")).toBe(true);

    await signIn(INVITEE.email, inviteeTempPassword, { expectFail: true });
    await expect(page.locator(".error")).toContainText(/wrong email or password/i);
  });

  test("player signs in and edits their profile", async () => {
    await signIn("player1@test.cc", PW);
    await page.goto("/profile");
    await page.getByRole("button", { name: "Batter" }).click();
    await page.getByRole("button", { name: "All-rounder" }).click();

    const sliders = page.locator('input[type="range"]');
    await sliders.nth(0).fill("9");
    await sliders.nth(1).fill("6");
    await sliders.nth(2).fill("7");

    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();

    await page.reload();
    await expect(sliders.nth(0)).toHaveValue("9");
    await expect(page.getByRole("button", { name: "Batter" })).toHaveClass(/on/);
    await snap(page, "profile-ratings");
  });

  test("home shows club stats", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Test CC" })).toBeVisible();
    await expect(page.locator(".stat-tile").filter({ hasText: "Players" })).toContainText("12");
    await expect(page.getByText(inviteCode)).toBeVisible();
    await expect(page.getByRole("link", { name: /admin & invites/i })).toHaveCount(0);
    await snap(page, "home-dashboard");
  });

  test("players directory and a player detail", async () => {
    await page.goto("/players");
    await expect(page.getByText("Player-1", { exact: true })).toBeVisible();
    await expect(page.getByText("Player-8", { exact: true })).toBeVisible();
    await snap(page, "players-directory");
    await page.getByText("Player-4", { exact: true }).click();
    await expect(page).toHaveURL(/\/players\/[0-9a-f-]+$/);
    await expect(page.getByText(/Matches played/)).toBeVisible();
    await snap(page, "player-detail");
  });

  test("non-admin cannot reach the admin console", async () => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/$/);
  });

  // --- profile picture / account details / password reset ---

  const PNG_1PX =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  let inviteeEmail = INVITEE.email;

  test("player uploads a photo and edits their account", async () => {
    await signIn(inviteeEmail, "brandnew123");
    await page.goto("/profile");

    await page.getByTestId("avatar-input").setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG_1PX, "base64"),
    });
    await expect(page.getByTestId("avatar-uploader").locator("img.avatar-img")).toBeVisible();
    await snap(page, "avatar-uploaded");

    // can't steal another member's email
    await field(page, "Name").fill("Renamed Invitee");
    await field(page, "Email").fill("player1@test.cc");
    await page.getByRole("button", { name: /save account details/i }).click();
    await expect(page.locator(".error")).toContainText(/already uses that email/i);

    await field(page, "Email").fill("renamed@test.cc");
    await page.getByRole("button", { name: /save account details/i }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(field(page, "Name")).toHaveValue("Renamed Invitee");
    inviteeEmail = "renamed@test.cc";

    // the new photo shows up in the directory too
    await page.goto("/players");
    await expect(page.locator("img.avatar-img").first()).toBeVisible();
    await snap(page, "directory-with-avatar");
  });

  test("forgot-password: full self-serve reset from the landing screen", async () => {
    await page.request.post("/api/auth/sign-out");

    // discoverable from the player sign-in page too
    await page.goto("/sign-in");
    await expect(page.getByRole("link", { name: /forgot your password/i })).toBeVisible();
    await page.getByRole("link", { name: /forgot your password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);

    await field(page, "Email").fill(inviteeEmail);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByTestId("forgot-sent")).toBeVisible();
    await snap(page, "forgot-password-sent");

    const link = await latestResetLink(inviteeEmail);
    expect(link, `no reset email found for ${inviteeEmail}`).toBeTruthy();

    await page.goto(link!);
    await field(page, "New password").fill("selfserve123");
    await field(page, "Confirm password").fill("selfserve123");
    await page.getByRole("button", { name: /set new password/i }).click();
    await expect(page.getByTestId("reset-done")).toBeVisible();
    await snap(page, "reset-password-done");

    await signIn(inviteeEmail, "selfserve123");
    await expect(page).not.toHaveURL(/\/sign-in/);
  });

  test("admin edits a player and issues a password reset", async () => {
    await signIn(ADMIN.email, ADMIN.password);
    const roster = await (await page.request.get("/api/players")).json();
    const player = roster.find((r: { email: string }) => r.email === inviteeEmail);
    expect(player).toBeTruthy();

    await page.goto(`/admin/players/${player.id}`);
    await expect(field(page, "Name")).toHaveValue("Renamed Invitee");

    // admin can set the player's photo on their behalf
    await page.getByTestId("avatar-input").setInputFiles({
      name: "admin-set.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG_1PX, "base64"),
    });
    await expect(page.getByTestId("avatar-uploader").locator("img.avatar-img")).toBeVisible();
    const avatarRes = await page.request.get(`/api/members/${player.id}/avatar`);
    expect(avatarRes.ok()).toBeTruthy();
    expect(avatarRes.headers()["content-type"]).toContain("image");

    await field(page, "Name").fill("Admin Named");
    await page.getByRole("button", { name: /save details/i }).click();
    await expect(page.getByTestId("admin-player-msg")).toContainText("Saved");
    await snap(page, "admin-edit-player");

    await page.getByRole("button", { name: /send reset/i }).click();
    const msg = await page.getByTestId("admin-player-msg").innerText();
    const link = msg.match(/https?:\/\/\S+\/reset-password\?token=\S+/)?.[0];
    expect(link, `reset link in: ${msg}`).toBeTruthy();

    await page.goto(link!);
    await field(page, "New password").fill("afterreset123");
    await field(page, "Confirm password").fill("afterreset123");
    await page.getByRole("button", { name: /set new password/i }).click();
    await expect(page.getByTestId("reset-done")).toBeVisible();

    await signIn(inviteeEmail, "afterreset123");
    await expect(page).not.toHaveURL(/\/sign-in/);

    // admin list reflects the renamed player
    await signIn(ADMIN.email, ADMIN.password);
    await page.goto("/admin");
    await expect(page.getByText("Admin Named")).toBeVisible();
  });

  test("admin creates a match day", async () => {
    await signIn(ADMIN.email, ADMIN.password);
    await page.goto("/play/new");
    await field(page, "Ground (optional)").fill("Test Ground");
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await page
        .locator(".list-tap", { hasText: new RegExp(`Player-${n}\\b`) })
        .locator('input[type="checkbox"]')
        .check();
    }
    await page.getByRole("button", { name: /create match day/i }).click();
    await expect(page).toHaveURL(/\/play\/day\/[0-9a-f-]+$/);
    dayId = page.url().match(/day\/([0-9a-f-]+)/)![1];
    await snap(page, "match-day");
  });

  test("re-creating a match day for the same date joins the existing one", async () => {
    // one match day per club per date: submitting "New match day" again for
    // today must not create a second one
    await page.goto("/play/new");
    for (const n of [1, 2, 3, 4]) {
      await page
        .locator(".list-tap", { hasText: new RegExp(`Player-${n}\\b`) })
        .locator('input[type="checkbox"]')
        .check();
    }
    await page.getByRole("button", { name: /create match day/i }).click();

    await expect(page).toHaveURL(new RegExp(`/play/day/${dayId}\\?joined=1$`));
    await expect(page.getByTestId("joined-existing-day")).toBeVisible();
    await snap(page, "joined-existing-match-day");

    await page.goto("/play");
    await expect(page.locator(".match-card")).toHaveCount(1);
  });

  test("match day turnout can be refreshed to add newly-registered players", async () => {
    // reproduces the reported bug: only the 8 ticked at creation show up, even
    // though 12 are registered — the day page must say so and offer a fix
    await page.goto(`/play/day/${dayId}`);
    await expect(page.getByText(/Only 8 of 12 registered players/i)).toBeVisible();
    const editLink = page.getByTestId("edit-turnout-link");
    await expect(editLink).toContainText("4 missing");
    await snap(page, "turnout-gap-warning");

    await editLink.click();
    await expect(page).toHaveURL(new RegExp(`/play/day/${dayId}/turnout$`));
    await expect(page.getByTestId("turnout-count")).toContainText("8 of 12");

    // Player-9 registered after this match day was created — currently unchecked
    await expect(page.getByTestId("turnout-Player-9")).not.toBeChecked();
    await snap(page, "edit-turnout");

    await page.getByTestId("turnout-select-all").click();
    await expect(page.getByTestId("turnout-count")).toContainText("12 of 12");
    await page.getByRole("button", { name: /save turnout/i }).click();

    await expect(page).toHaveURL(new RegExp(`/play/day/${dayId}$`));
    await expect(page.getByText(/Only 8 of 12/i)).toHaveCount(0);
    await expect(page.getByText("Player-9", { exact: true })).toBeVisible();
    await expect(page.getByText("Player-10", { exact: true })).toBeVisible();
    await snap(page, "turnout-fixed");
  });

  test("squad selection shows the balance report, then create the match", async () => {
    await page.getByRole("link", { name: /new match/i }).click();
    await expect(page).toHaveURL(/\/new-match$/);
    // 5 is the shortest preset the UI offers; the sim ends both innings early
    // (all out / target reached) so the per-bowler over cap never bites.
    await page.getByRole("button", { name: "5", exact: true }).click();

    for (const n of [1, 2, 3, 4]) {
      await page.getByTestId(`to-a-Player-${n}`).click();
      await expect(page.getByTestId("side-a").getByTestId(`squad-Player-${n}`)).toBeVisible();
    }
    for (const n of [5, 6, 7, 8]) {
      await page.getByTestId(`to-b-Player-${n}`).click();
      await expect(page.getByTestId("side-b").getByTestId(`squad-Player-${n}`)).toBeVisible();
    }

    // let the debounced balance fetch settle before toggling flags
    await expect(page.getByTestId("balance-report")).toBeVisible();
    await page.getByTestId("captain-Player-1").click();
    await page.getByTestId("keeper-Player-4").click();
    await page.getByTestId("captain-Player-5").click();
    await page.getByTestId("keeper-Player-8").click();

    await expect(page.getByTestId("balance-a-overall")).toContainText(/\d\.\d \/ 10/);
    await expect(page.getByTestId("balance-b-overall")).toContainText(/\d\.\d \/ 10/);
    await expect(page.getByTestId("balance-verdict")).not.toBeEmpty();
    await snap(page, "squad-balance-report");

    await page.getByRole("button", { name: /create match & go to toss/i }).click();
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("toss and start the match", async () => {
    // the setup page fetches match data client-side — wait past its "Loading…"
    // before capturing, or the screenshot just shows a spinner state
    await expect(page.getByRole("heading", { name: "Who won the toss?" })).toBeVisible();
    await snap(page, "toss-screen");
    await page.locator(".chip-select").first().getByRole("button").first().click(); // toss winner = Side A
    await page.getByRole("button", { name: "Bat", exact: true }).click();
    await page.getByRole("button", { name: /start match/i }).click();
    await expect(page).toHaveURL(/\/score$/);
    matchId = page.url().match(/match\/([0-9a-f-]+)/)![1];

    // same for the scoring console's own client-side fetch
    await expect(page.getByTestId("pick-two")).toBeVisible();
    await snap(page, "openers-picker");
  });

  test("first innings — every delivery type, pickers, undo, wickets, all out", async () => {
    const s = new Scorer(page);
    await s.pickOpeners("Player-1", "Player-2");
    await s.pickBowler("Player-5");
    await s.waitForKeypad();

    await s.run(1);
    await s.expectScore("1/0");
    await s.expectStriker("Player-2");

    await s.wide();
    await s.expectScore("2/0");
    await s.expectOvers("0.1");

    await s.run(4);
    await s.expectScore("6/0");

    await s.noBall();
    await s.expectScore("7/0");
    await s.expectFreeHit(true);

    await s.run(6);
    await s.expectScore("13/0");
    await s.expectFreeHit(false);
    await snap(page, "scoring-mid-innings");

    await s.bye(1);
    await s.expectScore("14/0");
    await s.expectStriker("Player-1");

    await s.run(0);
    await s.undo();
    await s.expectScore("14/0");
    await s.run(0);

    await s.run(2); // 6th legal ball — over completes, new bowler required
    await s.assertBowlerNotOffered("Player-5");
    await s.pickBowler("Player-6");
    await s.waitForKeypad();
    await s.expectScore("16/0");

    await s.wicket({ kind: "bowled" });
    await s.pickNewBatter("Player-3");
    await s.expectScore("16/1");

    // caught, captured mid-flow: dismissal type chosen, then crossed + fielder filled in
    await page.getByTestId("key-wicket").click();
    await expect(page.getByTestId("wicket-sheet")).toBeVisible();
    await page.getByTestId("wkt-caught").click();
    await snap(page, "wicket-sheet-caught");
    await page.getByTestId("wicket-crossed").locator('input[type="checkbox"]').check();
    await page.getByTestId("wicket-fielder").selectOption({ label: "Player-5" });
    await snap(page, "wicket-sheet-caught-filled");
    await page.getByTestId("wicket-confirm").click();
    await s.pickNewBatter("Player-4");
    await s.expectScore("16/2");

    await s.wicket({ kind: "run_out", who: "striker", runs: 1, crossed: false });
    await s.expectInningsComplete();
    await s.expectScore("17/3");
    await snap(page, "innings-complete");

    await s.startSecondInnings();
  });

  test("home shows the match under Live now while it is in progress", async () => {
    await page.goto("/");
    await expect(page.getByText("Live now")).toBeVisible();
    await expect(page.locator(".match-card").first()).toContainText(/Side A v Side B/);
    await snap(page, "home-live-now");
  });

  test("second innings — chase down the target", async () => {
    await page.goto(`/play/match/${matchId}/score`);
    const s = new Scorer(page);
    await s.pickOpeners("Player-5", "Player-6");
    await s.pickBowler("Player-1");
    await s.waitForKeypad();
    await expect(page.getByTestId("chase")).toContainText("Need 18");
    await snap(page, "second-innings-chase");

    await s.run(6);
    await s.run(6);
    await s.run(6);
    await s.expectInningsComplete();
    await s.expectScore("18/0");
    await s.finishMatch();
  });

  test("match view shows the result and full scorecard", async () => {
    await expect(page).toHaveURL(/\/play\/match\/[0-9a-f-]+$/);
    await expect(page.locator(".notice.win")).toContainText(/Side B won by 3 wickets/);
    await expect(page.locator(".notice.win")).toContainText(/balls? to spare/);
    await expect(page.locator("table.card-table")).toHaveCount(4);
    await snap(page, "match-result");
  });

  test("live scorecard renders the final state", async () => {
    await page.goto(`/play/match/${matchId}/live`);
    await expect(page.getByText(/Side B won by 3 wickets/)).toBeVisible();
    await expect(page.locator("table.card-table").first()).toBeVisible();
    await expect(page.locator(".ballseq .ball").first()).toBeVisible();
    await snap(page, "live-scorecard");
  });

  test("admin resets their own forgotten password", async () => {
    await page.request.post("/api/auth/sign-out");
    await page.goto("/admin/sign-in");
    await page.getByRole("link", { name: /forgot your password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);

    await field(page, "Email").fill(ADMIN.email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByTestId("forgot-sent")).toBeVisible();

    const link = await latestResetLink(ADMIN.email);
    expect(link, `no reset email found for admin ${ADMIN.email}`).toBeTruthy();

    await page.goto(link!);
    await field(page, "New password").fill("adminreset123");
    await field(page, "Confirm password").fill("adminreset123");
    await page.getByRole("button", { name: /set new password/i }).click();
    await expect(page.getByTestId("reset-done")).toBeVisible();

    // old password rejected, new one signs the admin back into the console
    const stale = await page.request.post("/api/auth/sign-in", {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    expect(stale.status()).toBe(401);

    await signIn(ADMIN.email, "adminreset123");
    await page.goto("/admin");
    await expect(page.getByTestId("invite-code")).toBeVisible();
    await snap(page, "admin-self-reset-done");
  });

  test("sign out returns to the landing page", async () => {
    await page.goto("/profile");
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await snap(page, "signed-out-welcome");
  });
});
