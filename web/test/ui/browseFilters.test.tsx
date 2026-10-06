// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BrowseFilters } from "../../src/components/BrowseFilters";
import { useBrowseFilters } from "../../src/hooks/useBrowseFilters";
import { hulu, netflix, peacock, saveSubscriptions, serviceNames } from "./mocks";
import { renderApp } from "./render";

/** The filter row as the pages use it: hook state into the component. */
function Row() {
  const filters = useBrowseFilters();
  return (
    <>
      <BrowseFilters filters={filters} />
      <p data-testid="selected">{filters.slugs.join(",")}</p>
    </>
  );
}

const mocks = [serviceNames(hulu, netflix, peacock)];
const services = () => screen.getByRole("group", { name: "Services" });
const selected = () => screen.getByTestId("selected").textContent;

describe("Browse filters", () => {
  it("starts on all services when none are subscribed", async () => {
    renderApp(<Row />, { mocks, route: "/whats-on" });
    await within(services()).findByRole("button", { name: "Netflix" });
    expect(within(services()).getByRole("button", { name: "All Services" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(services()).getByRole("button", { name: "All Subscribed" })).toBeDisabled();
  });

  it("starts on the user's services when they have some", async () => {
    saveSubscriptions([{ slug: "netflix", choice: { planId: "x" } }]);
    renderApp(<Row />, { mocks, route: "/whats-on" });
    await within(services()).findByRole("button", { name: "Netflix" });
    expect(selected()).toBe("netflix");
    expect(within(services()).getByRole("button", { name: "All Subscribed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("toggles services like checkboxes, and lights the shortcut that matches", async () => {
    const user = userEvent.setup();
    renderApp(<Row />, { mocks, route: "/whats-on" });
    const peacockButton = await within(services()).findByRole("button", { name: "Peacock" });

    await user.click(peacockButton);
    expect(selected()).toBe("hulu,netflix");
    expect(within(services()).getByRole("button", { name: "All Services" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(peacockButton);
    expect(within(services()).getByRole("button", { name: "All Services" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("toggles Series and Films independently", async () => {
    const user = userEvent.setup();
    renderApp(<Row />, { mocks, route: "/whats-on" });
    const types = screen.getByRole("group", { name: "Type" });
    await user.click(within(types).getByRole("button", { name: "Films" }));
    expect(within(types).getByRole("button", { name: "Films" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(types).getByRole("button", { name: "Series" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("marks the page link for the page you're on", async () => {
    renderApp(<Row />, { mocks, route: "/coming-soon" });
    const show = screen.getByRole("navigation", { name: "Show" });
    expect(within(show).getByRole("link", { name: "Coming Soon" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("folds into a Filters button that names the selection, opening and closing", async () => {
    const user = userEvent.setup();
    renderApp(<Row />, { mocks, route: "/whats-on" });
    await within(services()).findByRole("button", { name: "Netflix" });
    const fold = screen.getByRole("button", { name: /Filters:/ });
    expect(fold).toHaveTextContent("All services · Series & films");
    expect(fold).toHaveAttribute("aria-expanded", "false");

    await user.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(fold).toHaveFocus();
  });
});
