import { describe, expect, it } from "vitest";

import { planDiscs, windowSaving, type WantedTitle } from "../../src/lib/discPlan";
import type { Plan, PlanMonth } from "../../src/lib/planner";

const today = "2026-10-08";
const HOURS = 20 * 60;

/** A plan month streaming `minutes` on Netflix, starting `i` months out. */
function month(i: number, minutes: number): PlanMonth {
  const start = new Date(Date.parse(today) + i * 30 * 86_400_000).toISOString().slice(0, 10);
  return { start, end: start, service: "netflix", reason: "most", watched: [], minutes };
}
const plan = (...months: PlanMonth[]): Plan => ({ months, unplaced: [] });
const want = (title: string, kind: WantedTitle["kind"], hours: number | null): WantedTitle => ({
  id: title,
  title,
  kind,
  minutes: hours === null ? null : hours * 60,
});

describe("planDiscs", () => {
  it("finds the gaps: pause months whole, light months in part", () => {
    // Month 0 streams a full month; month 1 streams 5 h; the rest pause.
    const result = planDiscs({
      plan: plan(month(0, HOURS), month(1, 5 * 60)),
      today,
      minutesPerMonth: HOURS,
      wanted: [],
    });
    expect(result.gaps.map((g) => [g.minutes / 60, g.paused])).toEqual([
      [15, false],
      [20, true],
      [20, true],
      [20, true],
      [20, true],
    ]);
    expect(result.gapMinutes).toBe(95 * 60);
    expect(result.shortMinutes).toBe(95 * 60);
  });

  it("buys series first, then the longest films, each by the first gap it fills", () => {
    const result = planDiscs({
      plan: plan(month(0, HOURS), month(1, HOURS), month(2, HOURS), month(3, HOURS)),
      today,
      minutesPerMonth: HOURS,
      wanted: [want("Heat", "Movie", 3), want("The Wire", "Series", 30), want("Ronin", "Movie", 2)],
    });
    // Two pause months (4 and 5), 40 h: The Wire fills the first and half the next.
    expect(result.picks.map((p) => [p.title, p.by, p.fills.length])).toEqual([
      ["The Wire", result.gaps[0]?.start, 2],
      ["Heat", result.gaps[1]?.start, 1],
      ["Ronin", result.gaps[1]?.start, 1],
    ]);
    expect(result.shortMinutes).toBe(5 * 60);
  });

  it("stops buying once the gaps are filled", () => {
    const result = planDiscs({
      plan: plan(
        month(0, HOURS),
        month(1, HOURS),
        month(2, HOURS),
        month(3, HOURS),
        month(4, HOURS),
      ),
      today,
      minutesPerMonth: HOURS,
      wanted: [want("The Wire", "Series", 60), want("Heat", "Movie", 3)],
    });
    expect(result.picks.map((p) => p.title)).toEqual(["The Wire"]);
    expect(result.shortMinutes).toBe(0);
  });

  it("leaves titles with no runtime out of the sums, and names them", () => {
    const result = planDiscs({
      plan: plan(),
      today,
      minutesPerMonth: HOURS,
      wanted: [want("Mystery", "Movie", null)],
    });
    expect(result.picks).toEqual([]);
    expect(result.unknown).toEqual(["Mystery"]);
  });

  it("has nothing to fill when every month streams enough", () => {
    const months = [0, 1, 2, 3, 4, 5].map((i) => month(i, HOURS));
    expect(
      planDiscs({ plan: plan(...months), today, minutesPerMonth: HOURS, wanted: [] }).gaps,
    ).toEqual([]);
  });
});

describe("windowSaving", () => {
  const priceOf = (key: string) => ({ netflix: 1800, hulu: null })[key] ?? null;

  it("is what six months of everything costs, less the plan's months", () => {
    // Paying $30 a month now; the plan pays Netflix ($18) twice, then pauses.
    const result = windowSaving(plan(month(0, HOURS), month(1, HOURS)), today, priceOf, 3000);
    expect(result).toEqual({ cents: 6 * 3000 - 2 * 1800, unpriced: 0 });
  });

  it("leaves out a month with no known price, and says so", () => {
    const hulu = { ...month(0, HOURS), service: "hulu" };
    expect(windowSaving(plan(hulu), today, priceOf, 3000)).toEqual({
      cents: 5 * 3000,
      unpriced: 1,
    });
  });
});
