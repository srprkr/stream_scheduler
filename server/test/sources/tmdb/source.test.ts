import { describe, expect, it } from "vitest";

import { TmdbSource } from "../../../src/sources/tmdb/source.js";
import type { CatalogFilters, CatalogSort } from "../../../src/sources/types.js";
import type {
  TmdbMovieListItem,
  TmdbMultiItem,
  TmdbPage,
} from "../../../src/sources/tmdb/types.js";

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

const NOW = () => new Date("2026-10-08T12:00:00Z");
const noFilters: CatalogFilters = { minScore: null, fromYear: null, toYear: null };
function films(ids: number[], totalPages = 1): TmdbPage<TmdbMovieListItem> {
  return {
    page: 1,
    total_pages: totalPages,
    total_results: ids.length,
    results: ids.map((id) => ({
      id,
      title: `Film ${id}`,
      overview: "",
      poster_path: null,
      backdrop_path: null,
      release_date: "2000-01-01",
    })),
  };
}
const usDiscs = (...dates: string[]) => ({
  results: [
    {
      iso_3166_1: "US",
      release_dates: dates.map((d) => ({ type: 5, release_date: `${d}T00:00:00.000Z`, note: "" })),
    },
  ],
});

describe("TmdbSource.listDiscCatalog", () => {
  it("asks for US disc releases with every tracked service excluded, in one request", async () => {
    const path =
      "/discover/movie?region=US&with_release_type=5&release_date.lte=2026-10-08&watch_region=US" +
      "&without_watch_providers=8|9|15|337|350|386|387|1796|1899|2100|2303|2616" +
      "&sort_by=popularity.desc&vote_count.gte=50&page=1";
    const client = fakeClient({ [path]: films([1, 2], 3) });
    const page = await new TmdbSource(client, NOW).listDiscCatalog({
      ...noFilters,
      sort: "POPULAR",
      page: 1,
    });
    expect(page.items.map((m) => m.id)).toEqual(["movie:1", "movie:2"]);
    expect(page.nextPage).toBe(2);
    expect(client.calls).toEqual([path]);
  });
});

describe("TmdbSource.listCatalog: sorts and filters", () => {
  const base =
    "/discover/movie?with_watch_providers=8|1796&watch_region=US&with_watch_monetization_types=flatrate&";
  const list = async (filters: Partial<typeof noFilters> & { sort: CatalogSort }, path: string) => {
    const client = fakeClient({ [`${base}${path}&page=1`]: films([1]) });
    await new TmdbSource(client, NOW).listCatalog({
      ...noFilters,
      ...filters,
      providerSlugs: ["netflix"],
      kind: "MOVIE",
      page: 1,
    });
    return client.calls;
  };

  it("sorts oldest first among titles with enough votes to be known", async () => {
    await list({ sort: "OLDEST" }, "sort_by=primary_release_date.asc&vote_count.gte=50");
  });

  it("filters by a minimum score with a vote floor, and by first-release years", async () => {
    await list(
      { sort: "POPULAR", minScore: 7, fromYear: 1990, toYear: 1999 },
      "sort_by=popularity.desc&vote_count.gte=50&vote_average.gte=7" +
        "&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31",
    );
  });

  it("keeps top rated's higher vote floor when a minimum score is set too", async () => {
    await list(
      { sort: "TOP_RATED", minScore: 8 },
      "sort_by=vote_average.desc&vote_count.gte=1000&vote_average.gte=8",
    );
  });

  it("sends one latest date for newest: the earlier of today and the last year", async () => {
    await list(
      { sort: "NEWEST", toYear: 2009 },
      "sort_by=primary_release_date.desc&primary_release_date.lte=2009-12-31",
    );
    await list(
      { sort: "NEWEST", toYear: 2029 },
      "sort_by=primary_release_date.desc&primary_release_date.lte=2026-10-08",
    );
  });
});

describe("TmdbSource.listDiscCatalog: sorts and filters", () => {
  it("sorts newest by disc date, filters years by first release, and caps disc dates once", async () => {
    const path =
      "/discover/movie?region=US&with_release_type=5&release_date.lte=2026-10-08&watch_region=US" +
      "&without_watch_providers=8|9|15|337|350|386|387|1796|1899|2100|2303|2616" +
      "&sort_by=release_date.desc&vote_count.gte=50" +
      "&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31&page=1";
    const client = fakeClient({ [path]: films([603]) });
    const page = await new TmdbSource(client, NOW).listDiscCatalog({
      sort: "NEWEST",
      page: 1,
      minScore: null,
      fromYear: 1990,
      toYear: 1999,
    });
    expect(client.calls).toEqual([path]);
    // The list's date is the disc date, so no first-release year.
    expect(page.items[0]?.releaseYear).toBeNull();
  });
});

describe("TmdbSource.listDiscReleases", () => {
  const discover = (page: number) =>
    "/discover/movie?region=US&with_release_type=5&release_date.gte=2026-10-08" +
    `&release_date.lte=2027-01-06&sort_by=popularity.desc&page=${page}`;

  it("dates each film by its disc release in the window, soonest first", async () => {
    const client = fakeClient({
      [discover(1)]: films([1, 2, 3], 2),
      // Film 2 again: popularity shifted between pages.
      [discover(2)]: films([2]),
      "/movie/1/release_dates": usDiscs("2026-12-01"),
      // A re-release: listed by discover under its first disc date.
      "/movie/2/release_dates": usDiscs("2000-03-07", "2026-10-20"),
      // Its disc date moved out of the window since discover's index was built.
      "/movie/3/release_dates": usDiscs("2027-03-01"),
    });
    const releases = await new TmdbSource(client, NOW).listDiscReleases(50);
    expect(releases).toEqual([
      { id: "disc:movie:2", mediaId: "movie:2", availableFrom: "2026-10-20" },
      { id: "disc:movie:1", mediaId: "movie:1", availableFrom: "2026-12-01" },
    ]);
    expect(client.calls.filter((c) => c === "/movie/2/release_dates")).toHaveLength(1);
  });
});
