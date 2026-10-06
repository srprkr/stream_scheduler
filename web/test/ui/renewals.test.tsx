// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Renewals } from "../../src/components/Renewals";
import { addDays } from "../../src/lib/renewals";
import { localToday } from "../../src/lib/seasons";
import { planServicesMock, saveSubscriptions } from "./mocks";
import { renderApp } from "./render";

const today = localToday();
// Six months out: well past the 90-day window renewals usually cover.
const yearlyRenewal = addDays(today, 180);

beforeEach(() => {
  saveSubscriptions([
    {
      slug: "peacock",
      choice: { planId: "premium" },
      billing: { cycle: "annual", renewsOn: yearlyRenewal, cents: 13999 },
    },
    { slug: "netflix", choice: { planId: "standard-ads" } },
  ]);
});

// The calendar file is handed to the browser as a blob; catch it.
let downloaded: Blob | null = null;
beforeEach(() => {
  downloaded = null;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    downloaded = blob;
    return "blob:test";
  });
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("Renewals", () => {
  it("lists a yearly plan however far off, marked to go monthly", async () => {
    renderApp(<Renewals />, { mocks: [planServicesMock()] });
    const row = (await screen.findByText("Peacock")).closest("li") as HTMLElement;
    expect(within(row).getByText("Go monthly")).toBeInTheDocument();
    expect(row).toHaveTextContent("Turn off auto-renew now");
  });

  it("asks for a renewal day where there isn't one", async () => {
    renderApp(<Renewals />, { mocks: [planServicesMock()] });
    expect(await screen.findByText(/No renewal day yet for Netflix/)).toBeInTheDocument();
  });

  it("puts a month-out and a week-out reminder for the yearly plan in the calendar file", async () => {
    const user = userEvent.setup();
    renderApp(<Renewals />, { mocks: [planServicesMock()] });
    await user.click(await screen.findByRole("button", { name: "Add to calendar (.ics)" }));

    expect(downloaded).not.toBeNull();
    // Calendar files wrap long lines; rejoin them before reading.
    const ics = (await (downloaded as unknown as Blob).text()).replace(/\r\n /g, "");
    const compact = (iso: string) => iso.replace(/-/g, "");
    expect(ics).toContain(`DTSTART;VALUE=DATE:${compact(addDays(yearlyRenewal, -30))}`);
    expect(ics).toContain(`DTSTART;VALUE=DATE:${compact(addDays(yearlyRenewal, -7))}`);
    expect(ics).toContain("SUMMARY:Turn off Peacock's yearly auto-renew");
    expect(ics).toContain("https://peacock.example/cancel");
  });
});
