import { expect, type Page } from "@playwright/test";

type WicketKind = "bowled" | "lbw" | "caught" | "stumped" | "run_out" | "hit_wicket";

/** Page object for the ball-by-ball scoring console. */
export class Scorer {
  constructor(private readonly page: Page) {}

  private t(id: string) {
    return this.page.getByTestId(id);
  }

  async waitForKeypad() {
    await expect(this.t("scorebar")).toBeVisible();
    await expect(this.t("key-0")).toBeVisible();
  }

  async pickOpeners(striker: string, nonStriker: string) {
    await expect(this.t("pick-two")).toBeVisible();
    await this.t(`striker-${striker}`).click();
    await this.t(`nonstriker-${nonStriker}`).click();
    await this.page.getByRole("button", { name: "Start batting" }).click();
  }

  async pickBowler(name: string) {
    await expect(this.page.getByRole("heading", { name: /bowler/i })).toBeVisible();
    await this.t(`pick-${name}`).click();
  }

  async assertBowlerNotOffered(name: string) {
    await expect(this.page.getByRole("heading", { name: /bowler/i })).toBeVisible();
    await expect(this.t(`pick-${name}`)).toHaveCount(0);
  }

  async pickNewBatter(name: string) {
    await expect(this.page.getByRole("heading", { name: /next batter/i })).toBeVisible();
    await this.t(`pick-${name}`).click();
  }

  /** A run off the bat: 0,1,2,3,4,6 */
  async run(n: 0 | 1 | 2 | 3 | 4 | 6) {
    await this.t(`key-${n}`).click();
  }

  async wide() {
    await this.t("key-wide").click();
  }

  async noBall() {
    await this.t("key-noball").click();
  }

  async bye(runs: 1 | 2 | 3 | 4) {
    await this.t("key-bye").click();
    await this.t("extra-sheet").getByTestId(`extra-runs-${runs}`).click();
  }

  async legBye(runs: 1 | 2 | 3 | 4) {
    await this.t("key-legbye").click();
    await this.t("extra-sheet").getByTestId(`extra-runs-${runs}`).click();
  }

  async undo() {
    await this.t("key-undo").click();
  }

  async wicket(opts: {
    kind: WicketKind;
    fielder?: string;
    crossed?: boolean;
    who?: "striker" | "nonStriker";
    runs?: 0 | 1 | 2 | 3;
  }) {
    await this.t("key-wicket").click();
    await expect(this.t("wicket-sheet")).toBeVisible();
    await this.t(`wkt-${opts.kind}`).click();

    if (opts.kind === "run_out") {
      const whoBtn = this.t("runout-who").getByRole("button");
      await whoBtn.nth(opts.who === "nonStriker" ? 1 : 0).click();
      await this.t("runout-runs")
        .getByRole("button", { name: String(opts.runs ?? 0), exact: true })
        .click();
    }
    if (opts.crossed) {
      await this.t("wicket-crossed").locator('input[type="checkbox"]').check();
    }
    if (opts.fielder) {
      await this.t("wicket-fielder").selectOption({ label: opts.fielder });
    }
    await this.t("wicket-confirm").click();
  }

  // ---- assertions ----
  async expectScore(text: string) {
    await expect(this.t("score")).toHaveText(text);
  }

  async expectOvers(prefix: string) {
    await expect(this.t("overs")).toContainText(prefix);
  }

  async expectStriker(name: string) {
    await expect(this.t("crease-striker")).toContainText(name);
  }

  async expectFreeHit(on = true) {
    if (on) await expect(this.t("freehit")).toBeVisible();
    else await expect(this.t("freehit")).toHaveCount(0);
  }

  async expectThisOver(contains: string) {
    await expect(this.t("this-over")).toContainText(contains);
  }

  async expectInningsComplete() {
    await expect(this.t("innings-complete")).toBeVisible();
  }

  async startSecondInnings() {
    await this.page.getByRole("button", { name: "Start 2nd innings" }).click();
  }

  async finishMatch() {
    await this.page.getByRole("button", { name: "Finish match" }).click();
  }
}
