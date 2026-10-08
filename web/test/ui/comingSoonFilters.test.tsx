// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ComingSoonPage } from "../../src/pages/ComingSoonPage";
import { hulu, netflix, serviceNames } from "./mocks";
import { renderApp } from "./render";

const services = () => screen.getByRole("group", { name: "Services" });

describe("Coming Soon's filter row", () => {
  it("offers no On disc: it shows what's arriving on services", async () => {
    renderApp(<ComingSoonPage />, { mocks: [serviceNames(hulu, netflix)], route: "/coming-soon" });
    await within(services()).findByRole("button", { name: "Netflix" });
    expect(within(services()).queryByRole("button", { name: "On disc" })).not.toBeInTheDocument();
  });

  it("judges Select All by the services alone, so a hidden On disc never leaves it half-done", async () => {
    const user = userEvent.setup();
    // Every service picked, On disc not: a choice made on What's On.
    window.localStorage.setItem("stream-scheduler:browse-services", "hulu,netflix");
    renderApp(<ComingSoonPage />, { mocks: [serviceNames(hulu, netflix)], route: "/coming-soon" });
    await within(services()).findByRole("button", { name: "Netflix" });
    expect(within(services()).getByRole("button", { name: "Clear All" })).toBeInTheDocument();

    await user.click(within(services()).getByRole("button", { name: "Clear All" }));
    expect(within(services()).getByRole("button", { name: "Netflix" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
