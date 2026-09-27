import { describe, expect, it } from "vitest";

import { localToday, seasonLine } from "../../src/lib/seasons";

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
