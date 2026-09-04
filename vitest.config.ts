import { defineConfig } from "vitest/config";

// Unit tests only. The Playwright end-to-end suite lives in e2e/ and runs via
// `npm run test:e2e`.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
