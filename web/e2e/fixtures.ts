import { test as base, expect } from "@playwright/test";

import { FIXTURE_NOW } from "../playwright.config";

/** One fixed 1×1 PNG for every poster and logo, so screenshots never vary. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqGeoBwAEhAGAhBjB2wAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Every browser test starts from a fresh, empty browser (Playwright gives
 * each test its own context), with:
 * - the clock pinned to the server's fixture day, so the page and the API
 *   agree on "today";
 * - images answered locally - the fixture's placeholder URLs point at an
 *   outside site, and nothing in a test should depend on the network.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await page.route(/placehold\.co|image\.tmdb\.org/, (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
    );
    await use(page);
  },
});

export { expect };

/** Ticks a service in Your services on Insights and closes its options. */
export async function subscribeTo(page: import("@playwright/test").Page, name: string) {
  await page.goto("/insights");
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Done" }).click();
}
