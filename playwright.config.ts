import { defineConfig, devices } from "@playwright/test";

/**
 * Demo-path test (PRD section 7: one Playwright test for the full demo path).
 * Target: PLAYWRIGHT_BASE_URL (default: the local production server on :3101).
 * It creates a new agency account, so point it only at a local server or a test deployment.
 * The AI steps use real Gemini, so timeouts are generous.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 8 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
});
