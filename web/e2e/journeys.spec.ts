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

test("the question mark in the top bar opens How it works", async ({ page }, info) => {
  await page.goto("/");
  // On a phone it's in the menu.
  if (info.project.name === "phone") await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "How it works" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "How it works" })).toBeVisible();
  // Picking it closed the menu; open it again to see it marked as the page.
  if (info.project.name === "phone") await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "How it works" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("below tablet width, the links fold into a menu the two bars open", async ({ page }, info) => {
  await page.goto("/");
  const insights = page.getByRole("link", { name: "Insights" });
  const menu = page.getByRole("button", { name: /menu$/ });
  if (info.project.name === "desktop") {
    await expect(menu).toBeHidden();
    await expect(insights).toBeVisible();
    return;
  }
  await expect(insights).toBeHidden();
  await menu.click();
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  // The two bars have crossed into an X.
  const bars = page.locator(".menu-toggle__bar");
  await expect(bars.first()).toHaveCSS("transform", /matrix\(0\.7/);
  await insights.click();
  await expect(page).toHaveURL(/\/insights$/);
  await expect(insights).toBeHidden();

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.keyboard.press("Escape");
  await expect(insights).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});
