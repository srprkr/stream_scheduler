import { describe, expect, it } from "vitest";

import { monthOn, planCost, planRotation, type PlanTitle } from "../../src/lib/planner";

const TODAY = "2026-10-01";
const H = 60;
const opts = { today: TODAY, minutesPerMonth: 20 * H, maxWaitDays: 90 };

const title = (
  id: string,
  hours: number | null,
  readyOn: string | null,
  startsOn: string | null = null,
): PlanTitle => ({
  id,
  title: id,
  minutes: hours === null ? null : hours * H,
  startsOn,
  readyOn,
});

describe("planRotation", () => {
  it("pays for one service a month, the one with the most ready", () => {
    const plan = planRotation(
      [
        { key: "prime", titles: [title("Reacher", 24, TODAY)] },
        { key: "netflix", titles: [title("Dark", 22, TODAY)] },
      ],
      opts,
    );
    expect(plan.months.map((m) => m.service)).toEqual(["prime", "netflix"]);
    expect(plan.months[0]?.minutes).toBe(20 * H);
  });

  it("doesn't buy a month for the tail of a series", () => {
    const plan = planRotation(
      [
        { key: "prime", titles: [title("Reacher", 24, TODAY)] },
        { key: "netflix", titles: [title("Dark", 22, TODAY)] },
      ],
      opts,
    );
    // 4 h of Reacher and 2 h of Dark left over: they wait for each service's
    // next real turn rather than costing a month each.
    expect(plan.unplaced).toEqual([
      { key: "prime", title: "Reacher", minutes: 4 * H },
      { key: "netflix", title: "Dark", minutes: 2 * H },
    ]);
  });

  it("carries a tail over into the service's next turn", () => {
    const plan = planRotation(
      [
        {
          key: "prime",
          titles: [title("Reacher", 24, TODAY), title("The Boys", 20, "2026-11-15")],
        },
      ],
      opts,
    );
    expect(plan.months.filter((m) => m.service).map((m) => m.watched.map((w) => w.title))).toEqual([
      ["Reacher"],
      ["Reacher", "The Boys"],
    ]);
  });

  it("waits for a month's worth instead of paying for one film", () => {
    const plan = planRotation([{ key: "netflix", titles: [title("Norm", 2, "2026-10-16")] }], opts);
    // Under a month's worth: it waits the full 90 days, then binges.
    expect(plan.months.map((m) => m.service)).toEqual([null, null, null, null, "netflix"]);
    expect(plan.months[4]?.reason).toBe("waited");
  });

  it("lets titles pile up until together they fill a month", () => {
    const plan = planRotation(
      [
        {
          key: "prime",
          titles: [
            title("Rings of Power", 9, "2026-11-25", "2026-11-11"),
            title("The Boys", 12, "2026-12-10"),
          ],
        },
      ],
      opts,
    );
    const first = plan.months.find((m) => m.service);
    expect(first?.start).toBe("2026-12-30");
    expect(first?.watched.map((w) => w.title)).toEqual(["Rings of Power", "The Boys"]);
  });

  it("holds a service back while a season it carries is still airing", () => {
    const plan = planRotation(
      [
        {
          key: "prime",
          titles: [
            title("Reacher", 30, TODAY),
            title("Rings of Power", 9, "2026-11-25", "2026-09-20"),
          ],
        },
      ],
      opts,
    );
    // Rings of Power is mid-season until Nov 25: Prime's first month is after.
    expect(plan.months[0]?.service).toBeNull();
    expect(plan.months.find((m) => m.service)?.start).toBe("2026-11-30");
  });

  it("lets a long wait override an airing season", () => {
    const plan = planRotation(
      [
        {
          key: "prime",
          titles: [title("Reacher", 30, TODAY), title("Invincible", 8, null, "2026-09-01")],
        },
      ],
      { ...opts, maxWaitDays: 30 },
    );
    expect(plan.months[1]?.service).toBe("prime");
    expect(plan.months[1]?.reason).toBe("waited");
  });

  it("watches a title on two services once", () => {
    const shared = title("Demon Slayer", 20, TODAY);
    const plan = planRotation(
      [
        { key: "hulu", titles: [shared] },
        { key: "netflix", titles: [shared] },
      ],
      opts,
    );
    expect(plan.months.filter((m) => m.service)).toHaveLength(1);
  });

  it("leaves undated titles unplaced", () => {
    const plan = planRotation([{ key: "apple", titles: [title("Severance", 9, null)] }], opts);
    expect(plan.months).toEqual([]);
    expect(plan.unplaced).toEqual([{ key: "apple", title: "Severance", minutes: 9 * H }]);
  });
});

describe("planCost and monthOn", () => {
  const plan = planRotation(
    [
      { key: "prime", titles: [title("Reacher", 24, TODAY)] },
      { key: "netflix", titles: [title("Dark", 22, TODAY)] },
    ],
    opts,
  );

  it("adds up the paid months", () => {
    const prices: Record<string, number> = { prime: 899, netflix: 799 };
    expect(planCost(plan, (k) => prices[k] ?? null)).toEqual({
      cents: 899 + 799,
      unpriced: 0,
      paidMonths: 2,
    });
  });

  it("finds the month a date falls in", () => {
    expect(monthOn(plan, "2026-11-05")?.service).toBe("netflix");
    expect(monthOn(plan, "2027-06-01")).toBeUndefined();
  });
});
