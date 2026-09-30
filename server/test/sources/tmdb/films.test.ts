import { describe, expect, it } from "vitest";

import { filmOnDisc, streamingPremieres } from "../../../src/sources/tmdb/films.js";
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
