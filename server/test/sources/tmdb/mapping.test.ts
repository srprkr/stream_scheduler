import { describe, expect, it } from "vitest";

import { movieRecord, pickTrailer, seriesRecord } from "../../../src/sources/tmdb/mapping.js";
import type { TmdbVideo } from "../../../src/sources/tmdb/types.js";

function video(overrides: Partial<TmdbVideo>): TmdbVideo {
  return {
    id: "v1",
    key: "abc",
    name: "Official Trailer",
    site: "YouTube",
    type: "Trailer",
    official: true,
    ...overrides,
  };
}
describe("pickTrailer", () => {
  it("returns null when there is nothing to pick", () => {
    expect(pickTrailer(undefined)).toBeNull();
    expect(pickTrailer([])).toBeNull();
  });

  it("prefers an official trailer over one listed earlier", () => {
    const picked = pickTrailer([
      video({ id: "fan", official: false }),
      video({ id: "studio", official: true }),
    ]);
    expect(picked?.id).toBe("video:studio");
  });

  it("falls back to a teaser when there is no trailer", () => {
    const picked = pickTrailer([
      video({ id: "clip", type: "Clip" }),
      video({ id: "teaser", type: "Teaser" }),
    ]);
    expect(picked?.id).toBe("video:teaser");
  });

  it("ignores hosts it cannot embed", () => {
    expect(pickTrailer([video({ site: "Vimeo" })])).toBeNull();
  });
});

describe("score and release year", () => {
  const film = {
    id: 603,
    title: "The Matrix",
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "1999-03-31",
    vote_average: 8.2,
    vote_count: 26000,
  };

  it("carries TMDB's score and the first release year", () => {
    expect(movieRecord(film)).toMatchObject({
      score: { average: 8.2, votes: 26000 },
      releaseYear: 1999,
    });
  });

  it("has no score when nobody has voted - TMDB's 0.0 isn't a score", () => {
    expect(movieRecord({ ...film, vote_average: 0, vote_count: 0 }).score).toBeNull();
  });

  it("leaves the year out when the list's date is a disc date", () => {
    expect(movieRecord({ ...film, release_date: "2018-05-22" }, false).releaseYear).toBeNull();
  });

  it("reads a series' year from its first air date, and none from a blank one", () => {
    const show = {
      id: 1,
      name: "Monster",
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2004-04-07",
    };
    expect(seriesRecord(show).releaseYear).toBe(2004);
    expect(seriesRecord({ ...show, first_air_date: "" }).releaseYear).toBeNull();
  });
});
