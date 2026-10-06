// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SettingsPage } from "../../src/pages/SettingsPage";
import { planServicesMock } from "./mocks";
import { renderApp } from "./render";

describe("Settings page", () => {
  it("saves a field and puts everything back on reset", async () => {
    const user = userEvent.setup();
    renderApp(<SettingsPage />, { mocks: [planServicesMock()], route: "/settings" });
    const hours = screen.getByLabelText("Hours you watch a month");

    await user.clear(hours);
    await user.type(hours, "35");
    // The box could be emptied on the way: "35", not "203".
    expect(window.localStorage.getItem("stream-scheduler:hours-per-month")).toBe("35");
    expect(hours).toHaveValue(35);

    await user.click(screen.getByRole("button", { name: "Reset all to defaults" }));
    expect(screen.getByLabelText("Hours you watch a month")).toHaveValue(20);
    expect(screen.getByLabelText("Days before a renewal to remind you")).toHaveValue(3);
  });

  it("puts the saved value back when an invalid one is left in the box", async () => {
    const user = userEvent.setup();
    renderApp(<SettingsPage />, { mocks: [planServicesMock()], route: "/settings" });
    const hours = screen.getByLabelText("Hours you watch a month");
    await user.clear(hours);
    await user.tab();
    expect(hours).toHaveValue(20);
  });

  it("refuses values out of range", async () => {
    const user = userEvent.setup();
    renderApp(<SettingsPage />, { mocks: [planServicesMock()], route: "/settings" });
    const lead = screen.getByLabelText("Days before a renewal to remind you");
    await user.clear(lead);
    await user.type(lead, "99");
    expect(window.localStorage.getItem("stream-scheduler:reminder-lead-days")).not.toBe("99");
  });
});
