import { describe, expect, it } from "vitest";

import { pathsForward, splitDone, type InsightInput } from "../../src/lib/insights";
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
  appletv: "Apple TV",
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
  // Every tracked service keeps access to the end of the paid period.
  cancellationOf: () => ({ keepsAccessUntilPeriodEnd: true, refunds: "No refunds." }),
  ...extra,
});

describe("pathsForward", () => {
  it("suggests cancelling a service the plan doesn't use now, keeping what's paid for", () => {
    const [netflix] = pathsForward(input([sub("netflix")]));
    expect(netflix).toEqual({
      id: "pause:netflix",
      key: "pause:netflix@2026-10-10",
      kind: "pause",
      service: "netflix",
      title: "Cancel Netflix now",
      detail:
        "Nothing in your plan needs it until Dec 3, for Dark. You keep it until Oct 10, then it simply doesn't renew. $7.99 a month × 2 months.",
      savesCents: 1598,
      date: null,
    });
  });

  it("says to cancel a day early where a service needs notice", () => {
    const [apple] = pathsForward(
      input([sub("appletv")], {
        cancellationOf: () => ({
          keepsAccessUntilPeriodEnd: true,
          cancelHoursBefore: 24,
          refunds: "No refunds.",
        }),
        monthlyCost: () => 1299,
      }),
    );
    expect(apple?.detail).toContain("Do it at least 1 day before.");
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

  it("puts turning off a yearly renewal first, with the sums and refund terms", () => {
    const yearly = sub("hbomax", {
      billing: { cycle: "annual", renewsOn: "2027-03-02", cents: 18499 },
    });
    const steps = pathsForward(input([sub("netflix"), yearly]));
    expect(steps[0]).toEqual({
      id: "switch-to-monthly:hbomax",
      key: "switch-to-monthly:hbomax@2027-03-02",
      kind: "switch-to-monthly",
      service: "hbomax",
      title: "Turn off HBO Max's yearly renewal now",
      detail:
        "Nothing is lost: You keep it until Mar 2, 2027, then it simply doesn't renew. " +
        "Your plan doesn't need it in the year ahead: that's $184.99 you'd stop paying. " +
        "No refunds.",
      savesCents: 18499,
      date: "2027-03-02",
    });
  });

  it("still suggests turning off renewal when the yearly price is cheaper, without a saving", () => {
    const busy: Plan = {
      months: Array.from({ length: 12 }, (_, i) =>
        month(
          `2027-${String(i + 1).padStart(2, "0")}-01`,
          `2027-${String(i + 1).padStart(2, "0")}-28`,
          "hbomax",
          ["X"],
        ),
      ),
      unplaced: [],
    };
    const yearly = sub("hbomax", {
      billing: { cycle: "annual", renewsOn: "2027-03-02", cents: 18499 },
    });
    const [hbo] = pathsForward(input([yearly], { plan: busy }));
    expect(hbo?.savesCents).toBeNull();
    expect(hbo?.detail).toContain("this year the yearly price is cheaper");
  });

  it("says when to subscribe to a service the plan needs but the user doesn't pay for", () => {
    const steps = pathsForward(input([]));
    expect(steps.map((s) => [s.title, s.date])).toEqual([
      ["Subscribe to Prime Video on or after Oct 4", "2026-10-04"],
      ["Subscribe to Netflix on or after Dec 3", "2026-12-03"],
    ]);
    expect(steps[0]?.detail).toBe(
      "For Reacher - and cancel the same day: you keep the whole month, and it can't renew by accident.",
    );
  });

  it("ranks savings first, biggest first, then dated steps", () => {
    const kinds = pathsForward(input([sub("netflix"), sub("hulu")])).map((i) => i.id);
    expect(kinds).toEqual(["pause:hulu", "pause:netflix", "resubscribe:prime"]);
  });
});

describe("splitDone", () => {
  it("moves ticked steps apart and adds up what they saved", () => {
    const steps = pathsForward(input([sub("netflix"), sub("hulu")]));
    const { todo, done, savedCents } = splitDone(steps, new Set(["pause:hulu@2026-10-10"]));
    expect(todo.map((s) => s.id)).toEqual(["pause:netflix", "resubscribe:prime"]);
    expect(done.map((s) => s.id)).toEqual(["pause:hulu"]);
    expect(savedCents).toBe(1249 * 3);
  });

  it("brings a step back when it's needed again for a new date", () => {
    const steps = pathsForward(input([sub("netflix")]));
    const { done } = splitDone(steps, new Set(["pause:netflix@2026-09-10"]));
    expect(done).toEqual([]);
  });
});
