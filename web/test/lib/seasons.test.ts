import { describe, expect, it } from "vitest";

import { localToday, readiness, readyLine, seasonLine } from "../../src/lib/seasons";

const TODAY = "2026-09-27";

describe("seasonLine", () => {
  it("says an undated season is announced, and nothing more", () => {
    expect(seasonLine({ seasonNumber: 3 }, TODAY)).toBe("Season 3 announced · no date yet");
  });

  it("gives a coming full drop one date", () => {
    expect(
      seasonLine({ seasonNumber: 2, premieresOn: "2026-10-16", isFullDrop: true }, TODAY),
    ).toBe("Season 2 arrives Oct 16 · all episodes at once");
  });

  it("gives a coming weekly season both ends, with the year when it changes", () => {
    expect(
      seasonLine(
        { seasonNumber: 4, premieresOn: "2026-11-28", fullyOutOn: "2027-01-30", isFullDrop: false },
        TODAY,
      ),
    ).toBe("Season 4 premieres Nov 28 · fully out Jan 30, 2027");
  });

  it("admits an unknown finale rather than guessing one", () => {
    expect(
      seasonLine({ seasonNumber: 6, premieresOn: "2026-10-07", isFullDrop: false }, TODAY),
    ).toBe("Season 6 premieres Oct 7 · finale date not announced");
  });

  it("gives an estimated finale as a month only", () => {
    expect(
      seasonLine(
        {
          seasonNumber: 6,
          premieresOn: "2026-10-07",
          expectedFullyOutOn: "2027-04-28",
          isFullDrop: false,
        },
        TODAY,
      ),
    ).toBe("Season 6 premieres Oct 7 · finale estimated for April 2027");
    expect(
      seasonLine(
        { seasonNumber: 5, premieresOn: "2026-09-01", expectedFullyOutOn: "2026-12-09" },
        TODAY,
      ),
    ).toBe("Season 5 airing now · finale estimated for December");
  });

  it("describes a season already airing", () => {
    expect(
      seasonLine({ seasonNumber: 5, premieresOn: "2026-09-01", fullyOutOn: "2026-11-10" }, TODAY),
    ).toBe("Season 5 airing weekly · finale Nov 10");
    expect(seasonLine({ seasonNumber: 5, premieresOn: "2026-09-01" }, TODAY)).toBe(
      "Season 5 airing now · finale date not announced",
    );
  });
});

describe("localToday", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(localToday(new Date(2026, 8, 27, 12))).toBe("2026-09-27");
  });
});

describe("readiness", () => {
  const today = "2026-09-28";

  it("is now without a season to come", () => {
    expect(readiness(null, today)).toEqual({ state: "now" });
  });

  it("dates a full drop by its premiere", () => {
    expect(
      readiness({ seasonNumber: 5, premieresOn: "2026-11-26", isFullDrop: true }, today),
    ).toEqual({ state: "on", date: "2026-11-26", estimated: false });
  });

  it("dates a weekly season by its finale, or its estimate", () => {
    expect(readiness({ seasonNumber: 3, fullyOutOn: "2026-11-25" }, today)).toEqual({
      state: "on",
      date: "2026-11-25",
      estimated: false,
    });
    expect(readiness({ seasonNumber: 3, expectedFullyOutOn: "2026-12-16" }, today)).toEqual({
      state: "on",
      date: "2026-12-16",
      estimated: true,
    });
  });

  it("is now once the finale has aired", () => {
    expect(readiness({ seasonNumber: 3, fullyOutOn: "2026-09-01" }, today)).toEqual({
      state: "now",
    });
  });

  it("is unknown without a finale or estimate", () => {
    expect(readiness({ seasonNumber: 3, premieresOn: "2026-11-11" }, today)).toEqual({
      state: "unknown",
    });
  });
});

describe("readyLine", () => {
  const today = "2026-09-28";
  it("says the date plainly, and an estimate loosely", () => {
    expect(readyLine({ state: "on", date: "2026-11-25", estimated: false }, today)).toBe(
      "All out Nov 25",
    );
    expect(readyLine({ state: "on", date: "2026-12-16", estimated: true }, today)).toBe(
      "All out around December",
    );
  });
});
