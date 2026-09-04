import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const isLocal = /localhost|127\.0\.0\.1/.test(BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  // The app allows exactly one club per deployment, so the journey is stateful
  // and must run serially in a single worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 12_000 },

  globalSetup: "./e2e/global-setup.ts",

  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on",
    video: "on",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "journey",
      testMatch: /full-journey\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        // deterministic viewport; block the service worker to avoid cache flake
        serviceWorkers: "block",
      },
    },
    {
      name: "pwa",
      testMatch: /pwa\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], serviceWorkers: "allow" },
    },
  ],

  // Start the dev server locally if it isn't already running.
  webServer: isLocal
    ? {
        command: "npm run dev",
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
      }
    : undefined,
});
