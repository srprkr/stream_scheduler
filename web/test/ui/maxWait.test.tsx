// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MaxWait } from "../../src/components/MaxWait";
import type { useRotationPlan } from "../../src/hooks/useRotationPlan";
import type { Plan } from "../../src/lib/planner";
import { renderApp } from "./render";

/** A plan paying Netflix for `paid` of its months. */
const plan = (paid: number, months = 4): Plan => ({
  months: Array.from({ length: months }, (_, i) => ({
    start: `2026-1${i}-01`,
    end: `2026-1${i}-31`,
    service: i < paid ? "netflix" : null,
    reason: null,
    watched: [],
    minutes: 0,
  })),
  unplaced: [],
});

/** Just what MaxWait reads, with the plan each wait would give. */
function rotation(paidFor: (wait: number) => number) {
  return {
    plan: plan(paidFor(3)),
    planFor: (wait: number) => plan(paidFor(wait)),
    priceOf: () => 899,
    maxWaitMonths: 3,
    setMaxWaitMonths: () => {},
    payingNow: 899,
    billing: { monthly: 899, alwaysOn: 0, yearly: [] },
  } as unknown as ReturnType<typeof useRotationPlan>;
}

const options = () =>
  within(screen.getByRole("combobox"))
    .getAllByRole("option")
    .map((o) => o.textContent);

describe("Wait at most", () => {
  it("shows what each other choice changes against the current one", () => {
    // Waiting 1 month pays for 3; 2 for 2; 3 (current) for 1; longer, none.
    renderApp(<MaxWait rotation={rotation((w) => Math.max(0, 4 - w))} />);
    expect(options()).toEqual([
      "1 month · +$17.98",
      "2 months · +$8.99",
      "3 months",
      "4 months · −$8.99",
      "6 months · −$8.99",
    ]);
  });

  it("drops the figures and says why when the choice changes nothing", () => {
    renderApp(<MaxWait rotation={rotation(() => 2)} />);
    expect(options()).toEqual(["1 month", "2 months", "3 months", "4 months", "6 months"]);
    expect(screen.getByText(/How long you wait doesn't change that yet/)).toBeInTheDocument();
  });
});
