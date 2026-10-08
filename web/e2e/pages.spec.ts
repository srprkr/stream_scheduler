import AxeBuilder from "@axe-core/playwright";

import { expect, subscribeTo, test } from "./fixtures";

/**
 * Every page, as a person with a little data would see it: Netflix ticked
 * and one title on the watchlist. Each gets a full-page screenshot compared
 * with its approved baseline (desktop and phone), and an accessibility
 * scan. To approve a deliberate change: npm run e2e:update, then review the
 * new images in e2e/__screenshots__ before committing them.
 */
const PAGES = [
  { path: "/", name: "home", ready: "What do you own on DVD or Blu-ray?" },
  { path: "/whats-on", name: "whats-on", ready: "Streaming now on your services." },
  { path: "/coming-soon", name: "coming-soon", ready: "Coming Soon" },
  { path: "/watchlist", name: "watchlist", ready: "Renewals" },
  { path: "/insights", name: "insights", ready: "Paths forward" },
  { path: "/settings", name: "settings", ready: "Backup" },
];

test.beforeEach(async ({ page }) => {
  await subscribeTo(page, "Netflix");
  await page.goto("/whats-on");
  await page
    .getByRole("button", { name: "Add The Quiet Harbor to your watchlist" })
    .first()
    .click();
});

for (const { path, name, ready } of PAGES) {
  test(`${name} looks as approved`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText(ready, { exact: true }).first()).toBeVisible();
    // Let images and late queries settle before the picture is taken.
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });

  test(`${name} never scrolls sideways`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText(ready, { exact: true }).first()).toBeVisible();
    // Something wider than the screen - the header once was, on a phone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "page is wider than the screen").toBeLessThanOrEqual(0);
  });

  test(`${name} has no serious accessibility problems`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText(ready, { exact: true }).first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`),
      "serious or critical accessibility violations",
    ).toEqual([]);
  });
}

test("the filter row is one line on a desktop, and folds on a phone", async ({ page }, info) => {
  await page.goto("/whats-on");
  const fold = page.getByRole("button", { name: /Filters:/ });
  const services = page.getByRole("group", { name: "Services" });
  if (info.project.name === "desktop") {
    await expect(fold).toBeHidden();
    await expect(services).toBeVisible();
    // One line: every group sits on the same row.
    const rows = await page
      .locator(".filters__group")
      .evaluateAll((els) => [
        ...new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))),
      ]);
    expect(rows).toHaveLength(1);
  } else {
    await expect(fold).toBeVisible();
    await expect(services).toBeHidden();
    await fold.click();
    await expect(services).toBeVisible();
  }
});
