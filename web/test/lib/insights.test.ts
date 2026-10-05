import { describe, expect, it } from "vitest";

import { pathsForward, type InsightInput } from "../../src/lib/insights";
import type { Plan } from "../../src/lib/planner";
import type { Subscription } from "../../src/lib/subscriptions";

const TODAY = "2026-10-04";

const month = (start: string, end: string, service: string | null, titles: string[] = []) => ({
  start,
  end,
  service,
  reason: service ? ("most" as const) : null,
  watched: titles.map((t) => ({ id: t, title: t, minutes: 600 })),
  minutes: 0,
});

// Prime this month, nothing next, Netflix the month after.
const plan: Plan = {
  months: [
    month("2026-10-04", "2026-11-03", "prime", ["Reacher"]),
    month("2026-11-03", "2026-12-03", null),
    month("2026-12-03", "2027-01-02", "netflix", ["Dark"]),
  ],
  unplaced: [],
};

const sub = (slug: string, extra: Partial<Subscription> = {}): Subscription => ({
  slug,
  choice: { planId: "x" },
  billing: { cycle: "monthly", day: 10 },
  ...extra,
});

const names: Record<string, string> = {
  prime: "Prime Video",
  netflix: "Netflix",
  hulu: "Hulu",
  hbomax: "HBO Max",
};
const prices: Record<string, number> = { prime: 899, netflix: 799, hulu: 1249, hbomax: 1849 };

const input = (subscriptions: Subscription[], extra: Partial<InsightInput> = {}): InsightInput => ({
  today: TODAY,
  plan,
  subscriptions,
  monthlyCost: (s) => prices[s.slug] ?? null,
  publishedMonthly: (slug) => prices[slug] ?? null,
  nameOf: (k) => names[k] ?? k,
  wishlistOn: () => [],
  ...extra,
});

describe("pathsForward", () => {
  it("suggests pausing a service the plan doesn't use now, worth each idle month", () => {
    const [netflix] = pathsForward(input([sub("netflix")]));
    expect(netflix).toEqual({
      id: "pause:netflix",
      kind: "pause",
      title: "Pause Netflix",
      detail: "Nothing in your plan needs it until Dec 3, for Dark. $7.99 a month × 2 months.",
      savesCents: 1598,
      date: null,
    });
  });

  it("leaves alone the service whose month it is, and ones kept whatever happens", () => {
    const pauses = pathsForward(input([sub("prime"), sub("hulu", { leftOut: true })]))
      .filter((i) => i.kind === "pause")
      .map((i) => i.id);
    expect(pauses).toEqual([]);
  });

  it("pauses a service nothing needs for the whole horizon, and suggests buying its wishlist", () => {
    const [hulu] = pathsForward(
      input([sub("hulu")], { wishlistOn: (s) => (s === "hulu" ? ["Shōgun"] : []) }),
    );
    expect(hulu?.savesCents).toBe(1249 * 3);
    expect(hulu?.detail).toContain("Nothing on your watchlist needs it.");
    expect(hulu?.detail).toContain("Shōgun - is on disc: buy it rather than keep paying.");
  });

  it("suggests switching a yearly plan the plan barely uses to monthly", () => {
    const yearly = sub("hbomax", {
      billing: { cycle: "annual", renewsOn: "2027-03-02", cents: 18499 },
    });
    const [hbo] = pathsForward(input([yearly]));
    expect(hbo?.kind).toBe("switch-to-monthly");
    expect(hbo?.savesCents).toBe(18499);
    expect(hbo?.date).toBe("2027-03-02");
  });

  it("says when to subscribe to a service the plan needs but the user doesn't pay for", () => {
    const steps = pathsForward(input([]));
    expect(steps.map((s) => [s.title, s.date])).toEqual([
      ["Subscribe to Prime Video on Oct 4", "2026-10-04"],
      ["Subscribe to Netflix on Dec 3", "2026-12-03"],
    ]);
  });

  it("ranks savings first, biggest first, then dated steps", () => {
    const kinds = pathsForward(input([sub("netflix"), sub("hulu")])).map((i) => i.id);
    expect(kinds).toEqual(["pause:hulu", "pause:netflix", "resubscribe:prime"]);
  });
});
