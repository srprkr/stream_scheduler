import { describe, expect, it } from "vitest";

import {
  cumulativeCosts,
  keepingCost,
  monthlyCosts,
  niceTicks,
  stepPath,
} from "../../src/lib/costChart";
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

describe("stepPath", () => {
  const pt = (index: number, keep: number, plan: number) => ({
    index,
    date: "2026-10-09",
    keep,
    plan,
    service: null,
  });

  it("jumps at each month's start and runs flat through it", () => {
    // Pay 10 in month 0, nothing in month 1 (a pause), 10 in month 2.
    const points = [pt(0, 0, 0), pt(1, 10, 10), pt(2, 20, 10), pt(3, 30, 20)];
    expect(
      stepPath(
        points,
        "plan",
        (i) => i * 100,
        (c) => c,
      ),
    ).toBe("M0,0 V10 H100 V10 H200 V20 H300");
  });

  it("draws nothing with no points", () => {
    expect(
      stepPath(
        [],
        "keep",
        (i) => i,
        (c) => c,
      ),
    ).toBe("");
  });
});

describe("yearly plans in the cost lines", () => {
  const peacock = (leftOut: boolean, renewsOn = "2026-11-20") => ({
    renewsOn,
    cents: 13999,
    leftOut,
  });

  it("charges a yearly renewal in full in its month, on keeping everything only", () => {
    const { points } = cumulativeCosts(plan, (k) => prices[k] ?? null, 0, 0, [peacock(false)]);
    // Renews in the second month (Nov 2 - Dec 2): keep jumps there by the whole year.
    expect(points.map((p) => p.keep)).toEqual([0, 0, 13999, 13999]);
    // The plan turns its auto-renew off, so never pays it.
    expect(points.map((p) => p.plan)).toEqual([0, 899, 899, 1698]);
  });

  it("charges an always-kept yearly plan on both lines", () => {
    const { points } = cumulativeCosts(plan, (k) => prices[k] ?? null, 0, 0, [peacock(true)]);
    expect(points.at(-1)).toMatchObject({ keep: 13999, plan: 1698 + 13999 });
  });

  it("leaves out a renewal past the plan's end: that year's already paid", () => {
    const { points } = cumulativeCosts(plan, () => 0, 0, 0, [peacock(false, "2027-06-01")]);
    expect(points.at(-1)?.keep).toBe(0);
  });
});

describe("monthlyCosts", () => {
  it("turns running totals into each month's bill: valleys where the plan pauses", () => {
    const { points } = cumulativeCosts(plan, (k) => prices[k] ?? null, 2500);
    expect(monthlyCosts(points).map((p) => [p.date, p.keep, p.plan, p.service])).toEqual([
      ["2026-10-03", 2500, 899, "prime"],
      ["2026-11-02", 2500, 0, null],
      ["2026-12-02", 2500, 799, "netflix"],
    ]);
  });
});

describe("keepingCost", () => {
  it("is the monthly bills over the plan's months, plus a yearly renewal inside them", () => {
    const renewing = [{ renewsOn: "2026-11-20", cents: 13999, leftOut: false }];
    expect(keepingCost(plan, 2500, renewing)).toBe(3 * 2500 + 13999);
    // An always-kept plan is paid either way, so it isn't counted.
    expect(keepingCost(plan, 2500, [{ ...renewing[0]!, leftOut: true }])).toBe(3 * 2500);
  });
});
