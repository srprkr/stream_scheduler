import { describe, expect, it } from "vitest";

import { filmOnDisc, streamingPremieres, usDiscRelease } from "../../../src/sources/tmdb/films.js";
import type { TmdbReleaseDate } from "../../../src/sources/tmdb/types.js";

describe("streamingPremieres", () => {
  const services = [
    { slug: "netflix", noteAliases: ["netflix"] },
    { slug: "hbomax", noteAliases: ["hbo max", "max"] },
  ];

  function dates(country: string, ...entries: Partial<TmdbReleaseDate>[]) {
    return {
      results: [
        {
          iso_3166_1: country,
          release_dates: entries.map((e) => ({
            type: 4,
            release_date: "2026-10-16T00:00:00.000Z",
            note: "",
            ...e,
          })),
        },
      ],
    };
  }

  it("reads the service from a digital release's note", () => {
    expect(streamingPremieres(dates("US", { note: "Netflix" }), services)).toEqual([
      { slug: "netflix", date: "2026-10-16" },
    ]);
  });

  it("matches every service in a shared note, by any alias", () => {
    const found = streamingPremieres(dates("US", { note: "Max / Netflix" }), services);
    expect(found.map((p) => p.slug)).toEqual(["netflix", "hbomax"]);
  });

  it("treats a blank note as rent-or-buy, not streaming", () => {
    expect(streamingPremieres(dates("US", { note: "" }), services)).toEqual([]);
  });

  it("ignores theatrical dates and other countries", () => {
    expect(streamingPremieres(dates("US", { type: 3, note: "Netflix" }), services)).toEqual([]);
    expect(streamingPremieres(dates("GB", { note: "Netflix" }), services)).toEqual([]);
  });

  it("does not match a name buried in a longer note", () => {
    const note = "Netflix Documentary Talent Fund screening";
    expect(streamingPremieres(dates("US", { note }), services)).toEqual([]);
  });

  it("skips rental listings that name a storefront", () => {
    const store = [{ slug: "appletv", noteAliases: ["apple tv"] }];
    const note = "Apple TV, Prime Video, Google VOD";
    expect(streamingPremieres(dates("US", { note }), store)).toEqual([]);
  });
});
describe("filmOnDisc", () => {
  const dates = (country: string, type: number) => ({
    results: [
      { iso_3166_1: country, release_dates: [{ type, release_date: "2024-05-14", note: "" }] },
    ],
  });

  it("counts a disc release in any country", () => {
    // Heat: discs on record in the UK, none in TMDB's US rows.
    expect(filmOnDisc(dates("GB", 5))).toBe(true);
  });

  it("doesn't count a digital release as ownable", () => {
    expect(filmOnDisc(dates("US", 4))).toBe(false);
  });
});

describe("usDiscRelease", () => {
  const entry = (type: number, date: string) => ({
    type,
    release_date: `${date}T00:00:00.000Z`,
    note: "",
  });

  it("takes a re-release's date in the window, not the film's first disc", () => {
    // Eyes Wide Shut: first on disc in 2000, a 4K edition this October.
    const dates = {
      results: [
        {
          iso_3166_1: "US",
          release_dates: [entry(5, "2000-03-07"), entry(5, "2026-10-20"), entry(5, "2027-02-01")],
        },
      ],
    };
    expect(usDiscRelease(dates, "2026-10-08", "2027-01-06")).toBe("2026-10-20");
  });

  it("ignores digital dates and other countries' discs", () => {
    const dates = {
      results: [
        { iso_3166_1: "US", release_dates: [entry(4, "2026-10-20")] },
        { iso_3166_1: "GB", release_dates: [entry(5, "2026-10-21")] },
      ],
    };
    expect(usDiscRelease(dates, "2026-10-08", "2027-01-06")).toBeNull();
  });
});
