// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Panel } from "../../src/components/Panel";

const panel = (collapsible = true) => (
  <Panel id="test" className="test" title="Your services" collapsible={collapsible}>
    <p>Inside</p>
  </Panel>
);

describe("Panel", () => {
  it("starts open, folds from its heading, and remembers it", async () => {
    const user = userEvent.setup();
    const first = render(panel());
    expect(screen.getByText("Inside")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Your services" }));
    expect(screen.getByText("Inside")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Your services" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    first.unmount();

    render(panel());
    expect(screen.getByText("Inside")).not.toBeVisible();
  });

  it("can be pinned open, with no toggle", () => {
    render(panel(false));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your services" })).toBeInTheDocument();
    expect(screen.getByText("Inside")).toBeVisible();
  });
});
