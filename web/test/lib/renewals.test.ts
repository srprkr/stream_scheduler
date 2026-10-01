import { describe, expect, it } from "vitest";

import { nextRenewal, renewalAdvice, renewalsBetween } from "../../src/lib/renewals";

const TODAY = "2026-09-30";
const monthly = (day: number) => ({ cycle: "monthly", day }) as const;

describe("nextRenewal", () => {
  it("is this month's billing day if it hasn't passed, else next month's", () => {
    expect(nextRenewal(monthly(30), TODAY)).toBe("2026-09-30");
    expect(nextRenewal(monthly(14), TODAY)).toBe("2026-10-14");
  });

  it("falls back to a short month's last day", () => {
    expect(nextRenewal(monthly(31), "2026-11-01")).toBe("2026-11-30");
    expect(nextRenewal(monthly(31), "2027-02-01")).toBe("2027-02-28");
  });

  it("rolls into the new year", () => {
    expect(nextRenewal(monthly(5), "2026-12-20")).toBe("2027-01-05");
  });

  it("rolls an annual date forward a year at a time", () => {
    const annual = { cycle: "annual", renewsOn: "2025-03-02", cents: 18499 } as const;
    expect(nextRenewal(annual, TODAY)).toBe("2027-03-02");
    expect(nextRenewal({ ...annual, renewsOn: "2026-12-01" }, TODAY)).toBe("2026-12-01");
  });
});

describe("renewalsBetween", () => {
  it("lists each monthly renewal in the window", () => {
    expect(renewalsBetween(monthly(14), TODAY, "2026-12-29")).toEqual([
      "2026-10-14",
      "2026-11-14",
      "2026-12-14",
    ]);
  });

  it("lists an annual renewal only if it falls in the window", () => {
    const annual = { cycle: "annual", renewsOn: "2027-03-02", cents: null } as const;
    expect(renewalsBetween(annual, TODAY, "2026-12-29")).toEqual([]);
  });
});

describe("renewalAdvice", () => {
  const base = {
    service: "Netflix",
    billing: monthly(14),
    renewsOn: "2026-10-14",
    monthlyCents: 899,
    today: TODAY,
  };
  const on = (date: string, estimated = false) => ({ state: "on", date, estimated }) as const;

  it("asks about titles already out, and says what comes after", () => {
    const advice = renewalAdvice({
      ...base,
      titles: [
        { title: "Wednesday", ready: { state: "now" } },
        { title: "Norm", ready: on("2026-12-20") },
      ],
    });
    expect(advice).toEqual({
      action: "decide",
      text: "Still watching Wednesday? Keep it. Otherwise pause: nothing else on your watchlist is all out until Dec 20 (Norm). Pausing saves $8.99.",
    });
  });

  it("judges a later renewal from its own date, not today's", () => {
    // Norm is out Oct 16: inside October's paid month, but already out by
    // November's renewal.
    const norm = [{ title: "Norm", ready: on("2026-10-16") }];
    expect(renewalAdvice({ ...base, titles: norm }).action).toBe("keep");
    const november = renewalAdvice({ ...base, renewsOn: "2026-11-14", titles: norm });
    expect(november.action).toBe("decide");
    expect(november.text).toContain("Still watching Norm?");
  });

  it("keeps a service with something out inside the month it pays for", () => {
    const advice = renewalAdvice({ ...base, titles: [{ title: "Norm", ready: on("2026-10-16") }] });
    expect(advice.action).toBe("keep");
    expect(advice.text).toContain("Norm is all out Oct 16");
  });

  it("pauses until the first thing is out, past the paid month", () => {
    const advice = renewalAdvice({
      ...base,
      titles: [
        { title: "Stranger Things", ready: on("2026-12-31", true) },
        { title: "Norm", ready: on("2026-11-20") },
      ],
    });
    expect(advice).toEqual({
      action: "pause",
      text: "Pause it: nothing on your watchlist is all out until Nov 20 (Norm). Resubscribe then. Pausing saves $8.99.",
    });
  });

  it("says when what it's waiting on has no dates", () => {
    const advice = renewalAdvice({
      ...base,
      titles: [{ title: "Invincible", ready: { state: "unknown" } }],
    });
    expect(advice.text).toBe("Pause it: Invincible has no dates yet. Pausing saves $8.99.");
  });

  it("asks about a service with nothing on the watchlist", () => {
    expect(renewalAdvice({ ...base, titles: [] }).text).toBe(
      "Nothing on your watchlist is on Netflix. Pause or cancel it? Pausing saves $8.99.",
    );
  });

  it("shows the break-even for an annual renewal", () => {
    const advice = renewalAdvice({
      ...base,
      service: "HBO Max",
      billing: { cycle: "annual", renewsOn: "2027-03-02", cents: 18499 },
      renewsOn: "2027-03-02",
      monthlyCents: 1849,
      titles: [],
    });
    expect(advice.action).toBe("decide");
    expect(advice.text).toBe(
      "HBO Max's annual plan renews Mar 2, 2027. At $184.99 a year against $18.49 a month, " +
        "the annual plan only saves money if you'd keep HBO Max about 10 months or more a year. " +
        "Nothing on your watchlist is on HBO Max.",
    );
  });
});
