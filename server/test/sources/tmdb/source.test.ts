import { describe, expect, it } from "vitest";

import {
  analyseSeason,
  expectedFinale,
  filmOnDisc,
  nextSeasonNumber,
  pickTrailer,
  seriesRuntime,
  streamingPremieres,
  subscriptionServices,
  TmdbSource,
} from "../../../src/sources/tmdb/source.js";
import type {
  TmdbEpisode,
  TmdbMultiItem,
  TmdbPage,
  TmdbReleaseDate,
  TmdbSeasonDetail,
  TmdbTvDetail,
  TmdbVideo,
} from "../../../src/sources/tmdb/types.js";
import { seriesOnDisc } from "../../../src/sources/tmdb/discs.js";

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

/**
 * Answers only the paths it was given and throws on anything else, so a test
 * fails loudly on an unexpected request instead of hanging on the network.
 */
function fakeClient(responses: Record<string, unknown>) {
  const calls: string[] = [];
  return {
    calls,
    async get<T>(path: string): Promise<T> {
      calls.push(path);
      if (!(path in responses)) throw new Error(`unexpected request: ${path}`);
      return responses[path] as T;
    },
  };
}

function page(results: TmdbMultiItem[]): TmdbPage<TmdbMultiItem> {
  return { page: 1, total_pages: 1, total_results: results.length, results };
}

function movieHit(id: number, title: string): TmdbMultiItem {
  return {
    media_type: "movie",
    id,
    title,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "2020-01-01",
  };
}

function tvHit(id: number, name: string): TmdbMultiItem {
  return {
    media_type: "tv",
    id,
    name,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2020-01-01",
  };
}

const personHit: TmdbMultiItem = { media_type: "person", id: 99 };

/** Takes the query already encoded, so each test states the exact URL. */
const searchPath = (encoded: string) => `/search/multi?query=${encoded}&include_adult=false`;

describe("TmdbSource.searchMedia", () => {
  it("keeps films and series, drops people, and returns thin records", async () => {
    const client = fakeClient({
      [searchPath("office")]: page([
        movieHit(1, "The Office Movie"),
        personHit,
        tvHit(2, "The Office"),
      ]),
    });
    const results = await new TmdbSource(client).searchMedia("office", 10);

    expect(results.map((r) => [r.id, r.kind, r.title])).toEqual([
      ["movie:1", "MOVIE", "The Office Movie"],
      ["tv:2", "SERIES", "The Office"],
    ]);
    expect(results.every((r) => r.summary === true)).toBe(true);
  });

  it("applies `first` after dropping people, not before", async () => {
    const client = fakeClient({
      [searchPath("x")]: page([
        personHit,
        movieHit(1, "A"),
        personHit,
        tvHit(2, "B"),
        movieHit(3, "C"),
      ]),
    });
    const results = await new TmdbSource(client).searchMedia("x", 2);
    expect(results.map((r) => r.id)).toEqual(["movie:1", "tv:2"]);
  });

  it("encodes the query", async () => {
    const client = fakeClient({ [searchPath("Law%20%26%20Order")]: page([]) });
    await expect(new TmdbSource(client).searchMedia("Law & Order", 10)).resolves.toEqual([]);
  });

  it("makes no request for a blank query", async () => {
    const client = fakeClient({});
    expect(await new TmdbSource(client).searchMedia("   ", 10)).toEqual([]);
    expect(client.calls).toEqual([]);
  });
});

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

describe("subscriptionServices", () => {
  const services = [
    { slug: "peacock", watchProviderIds: [386, 387] },
    { slug: "hbomax", watchProviderIds: [1899] },
  ];
  const offer = (provider_id: number) => ({ provider_id, provider_name: "" });

  it("names the configured services offering the title on subscription", () => {
    const found = subscriptionServices(
      { results: { US: { flatrate: [offer(1899), offer(2528)] } } },
      services,
    );
    expect(found).toEqual(["hbomax"]);
  });

  it("counts a service once when it is listed under two tiers", () => {
    const found = subscriptionServices(
      { results: { US: { flatrate: [offer(386), offer(387)] } } },
      services,
    );
    expect(found).toEqual(["peacock"]);
  });

  it("ignores rent, free-with-ads and other countries", () => {
    const found = subscriptionServices(
      {
        results: {
          US: { rent: [offer(1899)], ads: [offer(386)] },
          GB: { flatrate: [offer(1899)] },
        },
      },
      services,
    );
    expect(found).toEqual([]);
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

  it("needs a premiere and a previous season to work from", () => {
    expect(expectedFinale(null, lastSeason)).toBeNull();
    expect(expectedFinale("2026-10-07", null)).toBeNull();
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

describe("seriesOnDisc", () => {
  it("counts broadcast and cable shows as on disc", () => {
    expect(seriesOnDisc(456, [19])).toBe(true); // The Simpsons, FOX
    expect(seriesOnDisc(1399, [49])).toBe(true); // Game of Thrones, HBO
  });

  it("doesn't count streaming originals", () => {
    expect(seriesOnDisc(108978, [1024])).toBe(false); // Reacher, Prime Video
  });

  it("lets the exceptions list overrule the network", () => {
    expect(seriesOnDisc(65494, [213])).toBe(true); // The Crown, Netflix, on disc
  });
});
