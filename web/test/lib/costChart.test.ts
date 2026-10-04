import { describe, expect, it } from "vitest";

import { cumulativeCosts, niceTicks } from "../../src/lib/costChart";
import type { Plan } from "../../src/lib/planner";

const month = (start: string, end: string, service: string | null) => ({
  start,
  end,
  service,
  reason: service ? ("most" as const) : null,
  watched: [],
  minutes: 0,
});

const plan: Plan = {
  months: [
    month("2026-10-03", "2026-11-02", "prime"),
    month("2026-11-02", "2026-12-02", null),
    month("2026-12-02", "2027-01-01", "netflix"),
  ],
  unplaced: [],
};
const prices: Record<string, number> = { prime: 899, netflix: 799 };

describe("cumulativeCosts", () => {
  it("runs both totals from zero today, paying each month at its start", () => {
    const { points } = cumulativeCosts(plan, (k) => prices[k] ?? null, 2500);
    expect(points.map((p) => [p.date, p.keep, p.plan, p.service])).toEqual([
      ["2026-10-03", 0, 0, "prime"],
      ["2026-11-02", 2500, 899, null],
      ["2026-12-02", 5000, 899, "netflix"],
      ["2027-01-01", 7500, 1698, null],
    ]);
  });

  it("puts always-on services on both lines, leaving the gap alone", () => {
    const { points } = cumulativeCosts(plan, (k) => prices[k] ?? null, 2500, 1499);
    const end = points.at(-1);
    expect([end?.keep, end?.plan]).toEqual([7500 + 3 * 1499, 1698 + 3 * 1499]);
    expect((end?.keep ?? 0) - (end?.plan ?? 0)).toBe(7500 - 1698);
  });

  it("counts plan months with no known price apart", () => {
    const { points, unpriced } = cumulativeCosts(plan, () => null, 0);
    expect(unpriced).toBe(2);
    expect(points.at(-1)?.plan).toBe(0);
  });

  it("has nothing to draw for an empty plan", () => {
    expect(cumulativeCosts({ months: [], unplaced: [] }, () => 0, 2500).points).toEqual([]);
  });
});

describe("niceTicks", () => {
  it("steps on round numbers past the top value", () => {
    expect(niceTicks(7500)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(niceTicks(1698)).toEqual([0, 500, 1000, 1500, 2000]);
  });

  it("is just zero when there's nothing to show", () => {
    expect(niceTicks(0)).toEqual([0]);
  });
});
