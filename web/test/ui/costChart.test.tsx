// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CostLines } from "../../src/components/CostChart";
import type { CostPoint } from "../../src/lib/costChart";
import { renderApp } from "./render";

const pt = (index: number, keep: number, plan: number): CostPoint => ({
  index,
  date: `2026-1${index}-01`,
  keep,
  plan,
  service: null,
});

describe("Cost chart views", () => {
  it("describes running totals by where they end", () => {
    renderApp(
      <CostLines
        points={[pt(0, 0, 0), pt(1, 2500, 899), pt(2, 5000, 899)]}
        today="2026-10-01"
        nameOf={(k) => k}
      />,
    );
    expect(
      screen.getByRole("img", {
        name: "Running cost over 2 months: keeping everything reaches $50.00, your plan $8.99.",
      }),
    ).toBeInTheDocument();
  });

  it("describes per-month bills by their highest month", () => {
    renderApp(
      <CostLines
        points={[pt(0, 2500, 899), pt(1, 16499, 0)]}
        view="month"
        today="2026-10-01"
        nameOf={(k) => k}
      />,
    );
    expect(
      screen.getByRole("img", {
        name: "Cost each month over 2 months: keeping everything up to $164.99, your plan up to $8.99.",
      }),
    ).toBeInTheDocument();
  });
});
