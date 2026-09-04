import { test, expect } from "@playwright/test";

test.describe("PWA", () => {
  test("manifest is valid and installable-shaped", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const m = await res.json();
    expect(m.name).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(Array.isArray(m.icons) && m.icons.length).toBeGreaterThan(0);
    expect(m.start_url).toBeTruthy();
    expect(m.theme_color).toMatch(/^#/);
  });

  test("service worker script is served with the right headers", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["service-worker-allowed"]).toBe("/");
    expect(await res.text()).toContain("addEventListener");
  });

  test("the app registers a service worker", async ({ page }) => {
    await page.goto("/welcome");
    const registered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
      if (reg) return true;
      // give registration a moment (it fires on window load)
      await new Promise((r) => setTimeout(r, 3000));
      return !!(await navigator.serviceWorker.getRegistration().catch(() => null));
    });
    expect(registered).toBeTruthy();
  });

  test("offline fallback page renders", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
  });

  test("head carries the manifest link and theme-color", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest"
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", /^#/);
  });
});
