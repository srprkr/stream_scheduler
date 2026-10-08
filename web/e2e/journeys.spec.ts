import { expect, subscribeTo, test } from "./fixtures";

test.describe("journeys", () => {
  test("ticking a service fills What's On with what it streams", async ({ page }) => {
    await subscribeTo(page, "Netflix");
    await page.goto("/whats-on");
    await expect(page.getByRole("heading", { name: "What's On" })).toBeVisible();
    await expect(page.getByText("Streaming now on your services.")).toBeVisible();
    await expect(page.getByText("The Quiet Harbor").first()).toBeVisible();
  });

  test("a title added to the watchlist shows up on the Watchlist page", async ({ page }) => {
    await subscribeTo(page, "Netflix");
    await page.goto("/whats-on");
    await page
      .getByRole("button", { name: "Add The Quiet Harbor to your watchlist" })
      .first()
      .click();
    await page
      .getByRole("navigation", { name: "Browse" })
      .getByRole("link", { name: "Watchlist" })
      .click();
    await expect(page.getByRole("heading", { name: "Watchlist", level: 1 })).toBeVisible();
    await expect(page.getByText("The Quiet Harbor").first()).toBeVisible();
  });

  test("the reminders download as a calendar file", async ({ page }) => {
    await subscribeTo(page, "Netflix");
    await page.goto("/watchlist");
    // Wait for the renewal row, as a person would: clicking before the
    // service names load would write "netflix" instead of "Netflix".
    const row = page.locator(".renewals__row").filter({ hasText: "Netflix" });
    await expect(row.getByText("Netflix", { exact: true })).toBeVisible();
    // Ticked today, so billed today: the renewal shown is next month's.
    await expect(row).toContainText("renews Nov 1");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Add to calendar (.ics)" }).click();
    const file = await (await download).path();
    const ics = (await import("node:fs")).readFileSync(file, "utf8");
    expect((await download).suggestedFilename()).toBe("streamhopper-renewals.ics");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics.replace(/\r\n /g, "")).toContain("Netflix");
  });

  test("a backup restores into a fresh browser", async ({ page, browser }) => {
    await subscribeTo(page, "Netflix");
    await page.goto("/whats-on");
    await page
      .getByRole("button", { name: "Add The Quiet Harbor to your watchlist" })
      .first()
      .click();

    await page.goto("/settings");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download backup" }).click();
    const file = await (await download).path();

    // Another device: a brand-new browser context with nothing saved.
    const fresh = await browser.newPage();
    await fresh.clock.setFixedTime(new Date("2026-10-01T12:00:00.000Z"));
    await fresh.goto("/settings");
    await fresh.getByLabel("From a backup file").setInputFiles(file);
    await expect(fresh.getByText(/has 1 title/)).toBeVisible();
    await fresh.getByRole("button", { name: "Replace everything here" }).click();
    await expect(fresh.getByRole("status").filter({ hasText: "Restored" })).toBeVisible();

    await fresh.goto("/watchlist");
    await expect(fresh.getByText("The Quiet Harbor").first()).toBeVisible();
    await fresh.close();
  });
});
