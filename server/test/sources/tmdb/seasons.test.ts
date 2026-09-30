import { describe, expect, it } from "vitest";

import {
  analyseSeason,
  expectedFinale,
  nextSeasonNumber,
  seriesRuntime,
} from "../../../src/sources/tmdb/seasons.js";
import type {
  TmdbEpisode,
  TmdbSeasonDetail,
  TmdbTvDetail,
} from "../../../src/sources/tmdb/types.js";

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
      { air_date: "2026-10-15", episode_type: "finale" },
      { air_date: "2026-10-01" },
      { air_date: "2026-10-08" },
    ]);
    expect(analyseSeason(s)).toMatchObject({
      firstAirDate: "2026-10-01",
      bingeableFrom: "2026-10-15",
      isFullDrop: false,
    });
  });

  it("won't call a weekly season finished before its finale is listed", () => {
    // Abbott Elementary season 6, a week before it premiered: two of its
    // episodes listed and dated, the other twenty not yet announced.
    const s = season([
      { air_date: "2026-10-07", runtime: 22, episode_type: "standard" },
      { air_date: "2026-10-14", runtime: 22, episode_type: "standard" },
    ]);
    expect(analyseSeason(s)).toMatchObject({
      firstAirDate: "2026-10-07",
      bingeableFrom: null,
      isFullDrop: false,
      watchTimeMinutes: null,
    });
  });

  it("proves nothing from a single listed episode", () => {
    expect(analyseSeason(season([{ air_date: "2026-10-01" }]))).toMatchObject({
      bingeableFrom: null,
      isFullDrop: null,
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
describe("seriesRuntime", () => {
  const TODAY = "2026-09-25";

  function numbered(n: number, episodes: Partial<TmdbEpisode>[]): TmdbSeasonDetail {
    return { ...season(episodes.map((e) => ({ air_date: "2020-01-01", ...e }))), season_number: n };
  }

  it("sums every aired episode of every season", () => {
    const total = seriesRuntime(
      [numbered(1, [{ runtime: 30 }, { runtime: 22 }]), numbered(2, [{ runtime: 25 }])],
      TODAY,
    );
    expect(total).toEqual({ minutes: 77, estimated: false });
  });

  it("leaves out specials and episodes that have not aired", () => {
    const total = seriesRuntime(
      [
        numbered(0, [{ runtime: 90 }]),
        numbered(1, [
          { runtime: 30 },
          { runtime: 30, air_date: "2026-12-01" },
          { runtime: 30, air_date: null },
        ]),
      ],
      TODAY,
    );
    expect(total).toEqual({ minutes: 30, estimated: false });
  });

  it("fills a missing runtime with its season's median, and says so", () => {
    const total = seriesRuntime(
      [numbered(1, [{ runtime: 20 }, { runtime: 24 }, { runtime: 40 }, {}])],
      TODAY,
    );
    expect(total).toEqual({ minutes: 20 + 24 + 40 + 24, estimated: true });
  });

  it("falls back to the series median when a whole season lacks runtimes", () => {
    const total = seriesRuntime(
      [numbered(1, [{ runtime: 50 }, { runtime: 60 }]), numbered(2, [{}, {}])],
      TODAY,
    );
    expect(total).toEqual({ minutes: 50 + 60 + 55 + 55, estimated: true });
  });

  it("gives up rather than guess when nothing has a runtime", () => {
    expect(seriesRuntime([numbered(1, [{}, {}])], TODAY)).toBeNull();
  });
});
describe("nextSeasonNumber", () => {
  function series(overrides: Partial<TmdbTvDetail>): TmdbTvDetail {
    return {
      id: 1,
      name: "Show",
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2020-01-01",
      number_of_seasons: 2,
      ...overrides,
    };
  }

  it("follows a dated next episode", () => {
    const next = { season_number: 6, episode_number: 1, air_date: "2026-10-07" };
    expect(nextSeasonNumber(series({ next_episode_to_air: next }))).toBe(6);
  });

  it("finds an announced but undated season of a returning show", () => {
    const detail = series({
      status: "Returning Series",
      last_episode_to_air: { season_number: 2, episode_number: 10, air_date: "2025-03-20" },
      seasons: [
        { season_number: 1, air_date: "2022-02-17", name: "" },
        { season_number: 2, air_date: "2025-01-16", name: "" },
        { season_number: 3, air_date: null, name: "" },
      ],
    });
    expect(nextSeasonNumber(detail)).toBe(3);
  });

  it("has nothing for a finished show, or a returning one with nothing announced", () => {
    expect(nextSeasonNumber(series({ status: "Ended" }))).toBeNull();
    const detail = series({
      status: "Returning Series",
      last_episode_to_air: { season_number: 3, episode_number: 8, air_date: "2026-08-09" },
      seasons: [{ season_number: 3, air_date: "2026-06-21", name: "" }],
    });
    expect(nextSeasonNumber(detail)).toBeNull();
  });
});
describe("expectedFinale", () => {
  // Abbott Elementary season 5: premiered Oct 1, finale Apr 22 - 203 days.
  const lastSeason = season([
    { air_date: "2025-10-01" },
    { air_date: "2025-10-08" },
    { air_date: "2026-04-22", episode_type: "finale" },
  ]);

  it("adds the previous season's run to the new premiere", () => {
    expect(expectedFinale("2026-10-07", lastSeason)).toBe("2027-04-28");
  });

  it("won't estimate from a previous season that never listed its finale", () => {
    const unfinished = season([{ air_date: "2025-10-01" }, { air_date: "2025-10-08" }]);
    expect(expectedFinale("2026-10-07", unfinished)).toBeNull();
  });

  it("won't copy a full drop's run, which is no run at all", () => {
    const fullDrop = season([{ air_date: "2025-10-01" }, { air_date: "2025-10-01" }]);
    expect(expectedFinale("2026-10-07", fullDrop)).toBeNull();
  });

  // The Rings of Power: season 2 ran weekly over five weeks, eight episodes.
  const eightWeekly = season([
    { air_date: "2024-08-29" },
    { air_date: "2024-08-29" },
    { air_date: "2024-08-29" },
    { air_date: "2024-09-05" },
    { air_date: "2024-09-12" },
    { air_date: "2024-09-19" },
    { air_date: "2024-09-26" },
    { air_date: "2024-10-03", episode_type: "finale" },
  ]);

  it("takes the last date when the new season is fully dated but has no finale marker", () => {
    // Season 3: four at once, then two a week - done in two weeks, not five.
    const current = season(
      ["11", "11", "11", "11", "18", "18", "25", "25"].map((d) => ({ air_date: `2026-11-${d}` })),
    );
    expect(expectedFinale("2026-11-11", eightWeekly, current)).toBe("2026-11-25");
  });

  it("copies the old run when the new season has listed fewer episodes", () => {
    const current = season([{ air_date: "2026-11-11" }, { air_date: "2026-11-18" }]);
    expect(expectedFinale("2026-11-11", eightWeekly, current)).toBe("2026-12-16");
  });

  it("never estimates earlier than an episode already dated", () => {
    const current = season([
      { air_date: "2026-11-11" },
      { air_date: "2027-01-06" },
      { air_date: null },
    ]);
    expect(expectedFinale("2026-11-11", eightWeekly, current)).toBe("2027-01-06");
  });

  it("needs a premiere and a previous season to work from", () => {
    expect(expectedFinale(null, lastSeason)).toBeNull();
    expect(expectedFinale("2026-10-07", null)).toBeNull();
  });
});
