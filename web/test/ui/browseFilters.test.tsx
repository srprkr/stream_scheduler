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
      <p data-testid="selected">
        {[...filters.slugs, ...(filters.disc ? ["disc"] : [])].join(",")}
      </p>
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
    expect(selected()).toBe("hulu,netflix,peacock,disc");
    // With every service on, the shortcut offers the way out instead.
    expect(within(services()).getByRole("button", { name: "Clear All" })).toBeInTheDocument();
    expect(within(services()).getByRole("button", { name: "My Services" })).toBeDisabled();
  });

  it("starts on the user's services when they have some", async () => {
    saveSubscriptions([{ slug: "netflix", choice: { planId: "x" } }]);
    renderApp(<Row />, { mocks, route: "/whats-on" });
    await within(services()).findByRole("button", { name: "Netflix" });
    expect(selected()).toBe("netflix");
    expect(within(services()).getByRole("button", { name: "My Services" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("toggles services like checkboxes, and the shortcut follows the selection", async () => {
    const user = userEvent.setup();
    renderApp(<Row />, { mocks, route: "/whats-on" });
    const peacockButton = await within(services()).findByRole("button", { name: "Peacock" });

    await user.click(peacockButton);
    expect(selected()).toBe("hulu,netflix,disc");
    expect(within(services()).getByRole("button", { name: "Select All" })).toBeInTheDocument();

    await user.click(peacockButton);
    expect(within(services()).getByRole("button", { name: "Clear All" })).toBeInTheDocument();
  });

  it("clears every service with Clear All, so one can be picked alone", async () => {
    const user = userEvent.setup();
    renderApp(<Row />, { mocks, route: "/whats-on" });
    await within(services()).findByRole("button", { name: "Peacock" });

    await user.click(within(services()).getByRole("button", { name: "Clear All" }));
    expect(selected()).toBe("");
    expect(within(services()).getByRole("button", { name: "Hulu" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(within(services()).getByRole("button", { name: "Hulu" }));
    expect(selected()).toBe("hulu");

    await user.click(within(services()).getByRole("button", { name: "Select All" }));
    expect(selected()).toBe("hulu,netflix,peacock,disc");
  });

  it("picks On disc like a service: in Select All, out of My Services", async () => {
    const user = userEvent.setup();
    saveSubscriptions([{ slug: "netflix", choice: { planId: "x" } }]);
    renderApp(<Row />, { mocks, route: "/whats-on" });
    // On disc draws at once; the services wait for their query.
    await within(services()).findByRole("button", { name: "Netflix" });
    const disc = within(services()).getByRole("button", { name: "On disc" });
    expect(disc).toHaveAttribute("aria-pressed", "false");

    await user.click(disc);
    expect(selected()).toBe("netflix,disc");
    // No longer exactly the user's services.
    expect(within(services()).getByRole("button", { name: "My Services" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(within(services()).getByRole("button", { name: "Select All" }));
    expect(selected()).toBe("hulu,netflix,peacock,disc");
    await user.click(within(services()).getByRole("button", { name: "Clear All" }));
    expect(disc).toHaveAttribute("aria-pressed", "false");

    await user.click(disc);
    expect(selected()).toBe("disc");
    expect(screen.getByRole("button", { name: /Filters:/ })).toHaveTextContent("On disc");
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
