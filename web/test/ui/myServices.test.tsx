// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MyServices } from "../../src/components/MyServices";
import { subscriptions } from "../../src/hooks/useSubscriptions";
import { myServicesMock } from "./mocks";
import { renderApp } from "./render";

const mocks = [myServicesMock()];

describe("Your services", () => {
  it("subscribes to a service on its default plan, and asks for its options", async () => {
    const user = userEvent.setup();
    renderApp(<MyServices />, { mocks });

    await user.click(await screen.findByRole("button", { name: "Netflix" }));

    expect(subscriptions.subscriptions()).toMatchObject([
      { slug: "netflix", choice: { planId: "standard-ads" } },
    ]);
    // Ticking one opens its options straight away.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Netflix" })).toBeInTheDocument();
    expect(screen.getByText(/\$8\.99/, { selector: ".services__total *" })).toBeInTheDocument();
  });

  it("switches a plan to yearly, filling in its published yearly price", async () => {
    const user = userEvent.setup();
    renderApp(<MyServices />, { mocks });
    await user.click(await screen.findByRole("button", { name: "Peacock" }));
    const dialog = await screen.findByRole("dialog");

    await user.selectOptions(within(dialog).getByLabelText("Billed"), "annual");

    expect(within(dialog).getByLabelText("Peacock yearly price in dollars")).toHaveValue("139.99");
    expect(subscriptions.subscriptions()[0]?.billing).toMatchObject({
      cycle: "annual",
      cents: 13999,
    });
  });

  it("reopens a subscribed service's options with its pencil, and removes it", async () => {
    const user = userEvent.setup();
    renderApp(<MyServices />, { mocks });
    await user.click(await screen.findByRole("button", { name: "Netflix" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    await user.click(
      screen.getByRole("button", { name: "Edit Netflix: plan, billing and renewal" }),
    );
    await user.click(screen.getByRole("button", { name: "Remove service" }));

    expect(subscriptions.subscriptions()).toEqual([]);
  });

  it("lets the renewal day be cleared and retyped", async () => {
    const user = userEvent.setup();
    renderApp(<MyServices />, { mocks });
    await user.click(await screen.findByRole("button", { name: "Netflix" }));
    const day = await screen.findByLabelText("Day of the month Netflix renews");

    await user.clear(day);
    await user.type(day, "28");

    expect(subscriptions.subscriptions()[0]?.billing).toEqual({ cycle: "monthly", day: 28 });
  });
});
