import { describe, expect, it } from "vitest";

import { comingSoonStats, monthName } from "../../src/lib/comingSoon";
import type { WatchlistTitle } from "../../src/lib/watchlist";

const TODAY = "2026-09-30";

const film = (
  title: string,
  slug: string,
  date: string,
  minutes: number | null,
): WatchlistTitle => ({
  id: title,
  title,
  runtime: minutes === null ? null : { minutes, estimated: false },
  comingRuntime: minutes === null ? null : { minutes, estimated: false },
  availableOn: [],
  upcoming: [{ slug, availableFrom: date, bingeableFrom: date }],
});

const rings: WatchlistTitle = {
  id: "rings",
  title: "The Rings of Power",
  runtime: { minutes: 1111, estimated: false },
  comingRuntime: { minutes: 532, estimated: true },
  availableOn: [{ slug: "prime" }],
  nextSeason: { seasonNumber: 3, premieresOn: "2026-11-11", expectedFullyOutOn: "2026-11-25" },
};

const reacher: WatchlistTitle = {
  id: "reacher",
  title: "Reacher",
  runtime: { minutes: 1200, estimated: false },
  availableOn: [{ slug: "prime" }],
};

describe("comingSoonStats", () => {
  const stats = comingSoonStats(
    [
      film("Norm", "netflix", "2026-10-16", null),
      film("Winter K2", "appletv", "2026-10-01", 95),
      rings,
      reacher,
      { ...rings, id: "undated", title: "Invincible", nextSeason: { seasonNumber: 4 } },
    ],
    new Set(["prime"]),
    TODAY,
  );

  it("counts each coming title in the month it's all out, by its coming hours", () => {
    expect(stats.months).toEqual([
      {
        month: "2026-10",
        minutes: 95,
        estimated: false,
        titles: ["Norm", "Winter K2"],
        untimed: 1,
      },
      {
        month: "2026-11",
        minutes: 532,
        estimated: true,
        titles: ["The Rings of Power"],
        untimed: 0,
      },
    ]);
  });

  it("leaves out what's already watchable, and lists the undated apart", () => {
    expect(stats.months.flatMap((m) => m.titles)).not.toContain("Reacher");
    expect(stats.undated).toEqual(["Invincible"]);
  });

  it("rolls the coming titles up by service, with their coming hours", () => {
    const prime = stats.services.find((s) => s.key === "prime");
    expect(prime?.titles.map((t) => t.title)).toEqual(["The Rings of Power", "Invincible"]);
    expect(prime?.minutes).toBe(1064);
    expect(prime?.subscribed).toBe(true);
  });
});

describe("monthName", () => {
  it("adds the year only when it isn't this one", () => {
    expect(monthName("2026-11", TODAY)).toBe("November");
    expect(monthName("2027-01", TODAY)).toBe("January 2027");
  });
});
