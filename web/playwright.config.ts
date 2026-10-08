import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests: the real app in a real browser, against the server's
 * fixture data - no TMDB, no network. They run beside the dev servers on
 * their own ports (API 4100, web 5174), so `npm run dev` can stay up.
 *
 * "Today" is pinned on the server (FIXTURE_NOW) and in the browser (see
 * e2e/fixtures.ts), so dates, countdowns and screenshots are the same on
 * every run.
 */
export const FIXTURE_NOW = "2026-10-01T12:00:00.000Z";
const API_PORT = 4100;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: "e2e",
  // Screenshot baselines live beside the tests, one folder per project.
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  expect: {
    // Tolerates anti-aliasing noise, not layout changes.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    // A phone-sized Chromium: the folded filters, stacked layouts.
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "../server",
      env: { CATALOG_SOURCE: "fixture", PORT: String(API_PORT), FIXTURE_NOW },
      url: `http://localhost:${API_PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      env: { API_PORT: String(API_PORT) },
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: false,
    },
  ],
});
