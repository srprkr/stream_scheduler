import { describe, expect, it } from "vitest";

import { analyseSeason, pickTrailer } from "./source.js";
import type { TmdbEpisode, TmdbSeasonDetail, TmdbVideo } from "./types.js";

function season(episodes: Partial<TmdbEpisode>[]): TmdbSeasonDetail {
  return {
    season_number: 1,
    air_date: null,
    episodes: episodes.map((e, i) => ({
      episode_number: i + 1,
      air_date: null,
      runtime: null,
      ...e,
    })),
  };
}

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

describe("analyseSeason", () => {
  it("treats one shared air date as a full drop", () => {
    const s = season([
      { air_date: "2026-10-01", runtime: 50 },
      { air_date: "2026-10-01", runtime: 50 },
      { air_date: "2026-10-01", runtime: 60 },
    ]);
    expect(analyseSeason(s)).toEqual({
      firstAirDate: "2026-10-01",
      bingeableFrom: "2026-10-01",
      isFullDrop: true,
      episodeCount: 3,
      watchTimeMinutes: 160,
    });
  });

  it("dates a weekly season by its last episode, whatever order upstream sends", () => {
    const s = season([
      { air_date: "2026-10-15" },
      { air_date: "2026-10-01" },
      { air_date: "2026-10-08" },
    ]);
    expect(analyseSeason(s)).toMatchObject({
      firstAirDate: "2026-10-01",
      bingeableFrom: "2026-10-15",
      isFullDrop: false,
    });
  });

  it("refuses to sum partial runtimes", () => {
    const s = season([{ runtime: 50 }, { runtime: null }, { runtime: 50 }]);
    expect(analyseSeason(s).watchTimeMinutes).toBeNull();
  });

  it("treats a zero runtime as missing", () => {
    const s = season([{ runtime: 50 }, { runtime: 0 }]);
    expect(analyseSeason(s).watchTimeMinutes).toBeNull();
  });

  it("has no dates when no episode is dated", () => {
    const s = season([{}, {}]);
    expect(analyseSeason(s)).toMatchObject({
      firstAirDate: null,
      bingeableFrom: null,
      isFullDrop: null,
    });
  });

  it("knows nothing about the finale when only the premiere is dated", () => {
    const s = season([{ air_date: "2026-10-01" }, {}, {}, {}]);
    expect(analyseSeason(s)).toMatchObject({
      firstAirDate: "2026-10-01",
      bingeableFrom: null,
      isFullDrop: null,
    });
  });

  it("knows a season is weekly from two dates, even with gaps", () => {
    const s = season([{ air_date: "2026-10-01" }, { air_date: "2026-10-08" }, {}]);
    expect(analyseSeason(s)).toMatchObject({
      bingeableFrom: null,
      isFullDrop: false,
    });
  });

});

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
