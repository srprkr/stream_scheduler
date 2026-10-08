import { describe, expect, it } from "vitest";

import { planRotation } from "../../src/lib/planner";
import {
  nextRenewal,
  renewalAdvice,
  renewalsBetween,
  upcomingRenewal,
} from "../../src/lib/renewals";

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

describe("upcomingRenewal", () => {
  it("skips a renewal falling today: it's already been charged", () => {
    expect(upcomingRenewal(monthly(30), TODAY)).toBe("2026-10-30");
    expect(upcomingRenewal(monthly(14), TODAY)).toBe("2026-10-14");
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
  // Prime has 24 h ready now, Netflix 22 h: Prime's month first, then Netflix's.
  const plan = planRotation(
    [
      {
        key: "prime",
        titles: [{ id: "r", title: "Reacher", minutes: 1440, startsOn: null, readyOn: TODAY }],
      },
      {
        key: "netflix",
        titles: [{ id: "d", title: "Dark", minutes: 1320, startsOn: null, readyOn: TODAY }],
      },
      {
        key: "hulu",
        titles: [{ id: "s", title: "Shogun", minutes: 60, startsOn: null, readyOn: null }],
      },
    ],
    { today: TODAY, minutesPerMonth: 1200, maxWaitDays: 90 },
  );
  const names: Record<string, string> = { prime: "Prime Video", netflix: "Netflix", hulu: "Hulu" };
  const base = {
    billing: monthly(14),
    plan,
    nameOf: (k: string) => names[k] ?? k,
    monthlyCents: 899,
    today: TODAY,
  };

  it("keeps a service in its month of the plan", () => {
    const advice = renewalAdvice({
      ...base,
      service: "Prime Video",
      key: "prime",
      renewsOn: "2026-10-14",
    });
    expect(advice).toEqual({
      action: "keep",
      text: "Keep it: this is Prime Video's month in your plan, for Reacher.",
    });
  });

  it("pauses a service until its turn, and says whose month it is", () => {
    const advice = renewalAdvice({
      ...base,
      service: "Netflix",
      key: "netflix",
      renewsOn: "2026-10-14",
    });
    expect(advice).toEqual({
      action: "pause",
      text: "Cancel it before Oct 14: you keep it until then, and it won't renew. Netflix's next month in your plan starts Oct 30, for Dark. This month is for Prime Video. That saves $8.99.",
    });
  });

  it("keeps the same service on a later renewal inside its turn", () => {
    const advice = renewalAdvice({
      ...base,
      service: "Netflix",
      key: "netflix",
      renewsOn: "2026-11-14",
    });
    expect(advice.action).toBe("keep");
  });

  it("keeps a service the user always keeps, naming what's on it to watch", () => {
    const advice = renewalAdvice({
      ...base,
      service: "Prime Video",
      key: "prime",
      renewsOn: "2026-10-14",
      alwaysKeep: ["Reacher"],
    });
    expect(advice).toEqual({
      action: "keep",
      text: "You always keep Prime Video (bundled or shared), so it's not in the rotation. Watch Reacher on it any time.",
    });
  });

  it("asks for a service's notice period before the renewal", () => {
    const advice = renewalAdvice({
      ...base,
      service: "Apple TV",
      key: "appletv",
      renewsOn: "2026-10-14",
      cancelHoursBefore: 24,
    });
    expect(advice.text).toContain("Cancel it before Oct 13:");
  });

  it("pauses a service whose titles aren't enough for a month yet", () => {
    const advice = renewalAdvice({ ...base, service: "Hulu", key: "hulu", renewsOn: "2026-10-14" });
    expect(advice.action).toBe("pause");
    expect(advice.text).toContain("Shogun isn't enough for a month yet, or has no dates.");
  });

  it("asks about a service with nothing on the watchlist", () => {
    const advice = renewalAdvice({
      ...base,
      service: "Peacock",
      key: "peacock",
      renewsOn: "2026-10-14",
    });
    expect(advice.text).toBe(
      "Nothing on your watchlist needs Peacock. Cancel it before Oct 14: you keep it until then, and it won't renew. That saves $8.99.",
    );
  });

  it("tells a yearly plan to turn off auto-renew, with the monthly sums", () => {
    const advice = renewalAdvice({
      ...base,
      service: "Netflix",
      key: "netflix",
      billing: { cycle: "annual", renewsOn: "2027-03-02", cents: 18499 },
      renewsOn: "2027-03-02",
      monthlyCents: 1849,
    });
    expect(advice).toEqual({
      action: "switch",
      text:
        "Turn off auto-renew now: you keep Netflix until Mar 2, 2027, so nothing is lost. " +
        "Your plan needs it for 1 month of the year ahead: 1 × $18.49 = $18.49 by the month, against $184.99 for another year.",
    });
  });

  it("asks for the yearly price when it isn't known", () => {
    const advice = renewalAdvice({
      ...base,
      service: "Peacock",
      key: "peacock",
      billing: { cycle: "annual", renewsOn: "2027-03-02", cents: null },
      renewsOn: "2027-03-02",
    });
    expect(advice.action).toBe("switch");
    expect(advice.text).toContain("Add its yearly price");
  });
});
