// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CancelHowTo } from "../../src/components/CancelHowTo";

const netflix = {
  url: "https://www.netflix.com/cancelplan",
  steps: ["Go to netflix.com/cancelplan and sign in.", "Choose Cancel, then Finish Cancellation."],
  keepsAccessUntilPeriodEnd: true,
  cancelHoursBefore: null,
  pause: null,
  refunds: "No refunds for part of a month.",
  gotchas: ["Deleting the app doesn't cancel."],
  checkedOn: "2026-10-05",
};

describe("How to cancel", () => {
  it("stays folded until opened", async () => {
    render(<CancelHowTo name="Netflix" cancellation={netflix} />);
    expect(screen.getByText("How to cancel Netflix")).toBeInTheDocument();
    expect(screen.getByText("Choose Cancel, then Finish Cancellation.")).not.toBeVisible();
  });

  it("opens every link in a new tab, safely, and says so", async () => {
    const user = userEvent.setup();
    render(<CancelHowTo name="Netflix" cancellation={netflix} />);
    await user.click(screen.getByText("How to cancel Netflix"));

    const links = screen.getAllByRole("link");
    // The cancel page, and the address written inside the first step.
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://netflix.com/cancelplan",
      "https://www.netflix.com/cancelplan",
    ]);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent("(opens in a new tab)");
    }
  });

  it("shows refunds, gotchas and when it was checked", async () => {
    const user = userEvent.setup();
    render(<CancelHowTo name="Netflix" cancellation={netflix} />);
    await user.click(screen.getByText("How to cancel Netflix"));
    expect(screen.getByText("No refunds for part of a month.")).toBeVisible();
    expect(screen.getByText("Deleting the app doesn't cancel.")).toBeVisible();
    expect(screen.getByText(/Checked Oct 5, 2026/)).toBeVisible();
  });
});
