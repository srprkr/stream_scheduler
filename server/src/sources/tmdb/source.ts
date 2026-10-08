import type {
  CatalogFilters,
  CatalogPageRecord,
  CatalogQuery,
  CatalogSort,
  CatalogSource,
  DiscCatalogQuery,
  DiscReleaseRecord,
  ImageSize,
  AvailabilityRecord,
  MediaRecord,
  ProviderRecord,
  ReleaseQuery,
  ReleaseRecord,
  RuntimeRecord,
  SeasonScheduleRecord,
  VideoRecord,
} from "../types.js";
import { addDays, isoDate } from "../../dates.js";
import type { TmdbClient } from "./client.js";
import { seriesOnDisc } from "./discs.js";
import {
  WATCH_REGION,
  PROVIDER_CONFIGS,
  PROVIDERS,
  subscriptionServices,
  otherServices,
  type ProviderConfig,
} from "./services.js";
import {
  DIGITAL_RELEASE,
  PHYSICAL_RELEASE,
  streamingPremieres,
  filmOnDisc,
  usDiscRelease,
} from "./films.js";
import {
  analyseSeason,
  seriesRuntime,
  seasonWatchTime,
  expectedFinale,
  nextSeasonNumber,
  type SeasonAnalysis,
} from "./seasons.js";
import { seasonRelease, movieRelease, movieRecord, seriesRecord } from "./mapping.js";
import type {
  TmdbMovieDetail,
  TmdbMovieListItem,
  TmdbMultiItem,
  TmdbPage,
  TmdbReleaseDates,
  TmdbSeasonDetail,
  TmdbTvDetail,
  TmdbTvListItem,
  TmdbWatchProviders,
} from "./types.js";

/** TMDB serves fixed width buckets; ImageSize maps onto the nearest one. */
const IMAGE_WIDTHS: Record<ImageSize, string> = {
  SMALL: "w154",
  MEDIUM: "w342",
  LARGE: "w780",
  ORIGINAL: "original",
};

/**
 * Ceiling on candidate film pages. The window held 14 when this was set, and
 * Netflix premieres were spread across pages 1-12, so stopping early drops
 * real releases rather than just the long tail.
 */
const FILM_PAGES = 20;

const WINDOW_DAYS = 90;

/**
 * Candidate pages of coming disc releases. About 30 films a quarter when
 * this was set - two pages - so five leaves room for a busy one.
 */
const DISC_PAGES = 5;

/**
 * Fewer votes than this and a film is too obscure to list among films out on
 * disc: unfiltered, the list runs past 20,000, deep into titles nobody knows.
 */
const DISC_VOTE_FLOOR = 50;

/** Candidate series pages scanned for season premieres. 20 per page. */
const SERIES_PAGES = 1;

/** Ceiling on simultaneous upstream requests, so a cold feed cannot burst. */
const CONCURRENCY = 8;

/** Promise.all with a ceiling on in-flight work. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

/** TMDB's TV genre ids for talk shows and news. */
const TALK_GENRE = 10767;

const NEWS_GENRE = 10763;

/**
 * Votes a title needs before its score counts. Without a floor, "top rated"
 * and "8 or more" are lists of obscure titles with a handful of ten-star
 * votes, and "oldest" opens on century-old shorts nobody has seen.
 */
const TOP_RATED_VOTES = 1000;
const SCORE_VOTES = 50;

/**
 * The discover parameters for an order plus the score and year filters.
 * Collected by name, so a parameter two rules both set - a vote floor, a
 * latest date - is sent once, at the stricter value.
 *
 * `dated` is the first-release date field; `newest` the one "newest" sorts
 * on, which for films out on disc is their disc date instead - a date the
 * caller already caps at today, hence `newestCapped`.
 */
function discoverOrder(
  query: { sort: CatalogSort } & CatalogFilters,
  dated: string,
  today: string,
  {
    newest = dated,
    newestCapped = false,
    voteFloor = 0,
  }: { newest?: string; newestCapped?: boolean; voteFloor?: number } = {},
): string {
  let votes = voteFloor;
  let sort: string;
  const latest = new Map<string, string>();
  switch (query.sort) {
    case "POPULAR":
      sort = "popularity.desc";
      break;
    case "TOP_RATED":
      sort = "vote_average.desc";
      votes = Math.max(votes, TOP_RATED_VOTES);
      break;
    case "NEWEST":
      sort = `${newest}.desc`;
      // Titles can be listed before they are released.
      if (!newestCapped) latest.set(newest, today);
      break;
    case "OLDEST":
      sort = `${dated}.asc`;
      votes = Math.max(votes, SCORE_VOTES);
      break;
  }
  if (query.minScore !== null) votes = Math.max(votes, SCORE_VOTES);
  if (query.toYear !== null) {
    const end = `${query.toYear}-12-31`;
    const already = latest.get(dated);
    latest.set(dated, already && already < end ? already : end);
  }

  const params = [`sort_by=${sort}`];
  if (votes > 0) params.push(`vote_count.gte=${votes}`);
  if (query.minScore !== null) params.push(`vote_average.gte=${query.minScore}`);
  if (query.fromYear !== null) params.push(`${dated}.gte=${query.fromYear}-01-01`);
  for (const [field, date] of latest) params.push(`${field}.lte=${date}`);
  return params.join("&");
}

/** TMDB serves at most 500 pages of any discover query. */
const MAX_DISCOVER_PAGE = 500;

function catalogPage(items: MediaRecord[], totalPages: number, page: number): CatalogPageRecord {
  return {
    items: items.map((item) => ({ ...item, summary: true })),
    nextPage: page < Math.min(totalPages, MAX_DISCOVER_PAGE) ? page + 1 : null,
  };
}

/**
 * TMDB-backed CatalogSource.
 *
 * Two different questions are being asked of one API, because TMDB answers
 * them differently:
 *   - SERIES: genuinely upcoming season drops, new and returning alike.
 *   - FILMS: streaming premieres recorded as US Digital release dates whose
 *     note names the service - originals and older films moving over alike.
 */
export class TmdbSource implements CatalogSource {
  readonly name = "tmdb";

  constructor(
    private readonly client: Pick<TmdbClient, "get">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listProviders(): Promise<ProviderRecord[]> {
    return PROVIDERS;
  }

  async getProviders(slugs: readonly string[]): Promise<(ProviderRecord | null)[]> {
    return slugs.map((s) => PROVIDERS.find((p) => p.slug === s) ?? null);
  }

  /**
   * Season premieres landing in the window, for new and returning series,
   * across every configured provider.
   *
   * Filtering on `first_air_date` would only find series that have never
   * aired, missing every returning season - and a returning season is the
   * stronger reason to resume a paused subscription. So this filters on
   * `air_date` (any episode airing soon), then keeps only seasons whose own
   * air_date falls in the window. That second step drops shows that are
   * merely mid-season, which would otherwise flood the feed.
   */
  private async upcomingSeasons(configs: ProviderConfig[]): Promise<ReleaseRecord[]> {
    const today = isoDate(this.now());
    const end = isoDate(addDays(this.now(), WINDOW_DAYS));

    const withNetwork = configs.filter((c) => c.networkId !== null);

    // One discover call per provider per page.
    const pages = await mapLimit(
      withNetwork.flatMap((config) =>
        Array.from({ length: SERIES_PAGES }, (_, i) => ({ config, page: i + 1 })),
      ),
      CONCURRENCY,
      async ({ config, page }) => {
        try {
          const body = await this.client.get<TmdbPage<TmdbTvListItem>>(
            `/discover/tv?with_networks=${config.networkId}` +
              `&air_date.gte=${today}&air_date.lte=${end}` +
              `&sort_by=popularity.desc&page=${page}`,
          );
          return { slug: config.slug, results: body.results };
        } catch {
          return { slug: config.slug, results: [] as TmdbTvListItem[] };
        }
      },
    );

    // A title can be carried by two services; first provider seen wins, so the
    // same season never appears twice in one feed.
    const seen = new Set<number>();
    const candidates: { slug: string; item: TmdbTvListItem }[] = [];
    for (const { slug, results } of pages) {
      for (const item of results) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        candidates.push({ slug, item });
      }
    }

    const details = await mapLimit(candidates, CONCURRENCY, async (c) => {
      try {
        return {
          slug: c.slug,
          detail: await this.client.get<TmdbTvDetail>(`/tv/${c.item.id}`),
        };
      } catch {
        return null;
      }
    });

    // Seasons whose listed air_date lands in the window. Episode-level detail
    // is fetched only for these, not for every season of every candidate.
    const wanted: { slug: string; seriesId: number; seasonNumber: number }[] = [];
    for (const entry of details) {
      if (!entry) continue;
      for (const season of entry.detail.seasons ?? []) {
        // Season 0 is TMDB's bucket for specials, not a real season drop.
        if (season.season_number === 0) continue;
        if (!season.air_date) continue;
        if (season.air_date < today || season.air_date > end) continue;
        wanted.push({
          slug: entry.slug,
          seriesId: entry.detail.id,
          seasonNumber: season.season_number,
        });
      }
    }

    const seasonDetails = await mapLimit(wanted, CONCURRENCY, async (w) => {
      try {
        return await this.client.get<TmdbSeasonDetail>(
          `/tv/${w.seriesId}/season/${w.seasonNumber}`,
        );
      } catch {
        return null;
      }
    });

    const releases: ReleaseRecord[] = [];
    for (const [i, w] of wanted.entries()) {
      const season = seasonDetails[i];
      const analysis = season ? analyseSeason(season) : null;

      // Episode dates are the better source: they disagree with
      // seasons[].air_date often enough to matter. Fall back to the listed
      // date when the season endpoint gave us nothing.
      const listed = details
        .find((d) => d?.detail.id === w.seriesId)
        ?.detail.seasons?.find((x) => x.season_number === w.seasonNumber)?.air_date;

      const release = seasonRelease(w.slug, w.seriesId, w.seasonNumber, analysis, listed);
      if (release) releases.push(release);
    }
    return releases;
  }

  /**
   * Films arriving on a configured service in the window, originals and
   * older films moving over alike.
   *
   * TMDB has no structured "arrives on Netflix" field for films. What it has
   * is a US Digital release date whose free-text note names the service, and
   * that note lives only on each film's release_dates. Discover cannot filter
   * on it, so every candidate costs one request - but a single scan serves
   * every provider, so the cost does not grow as services are added.
   */
  private async upcomingFilms(configs: ProviderConfig[]): Promise<ReleaseRecord[]> {
    const today = isoDate(this.now());
    const end = isoDate(addDays(this.now(), WINDOW_DAYS));
    const discover = (page: number) =>
      this.client.get<TmdbPage<TmdbMovieListItem>>(
        `/discover/movie?with_release_type=${DIGITAL_RELEASE}&region=${WATCH_REGION}` +
          `&release_date.gte=${today}&release_date.lte=${end}` +
          `&sort_by=popularity.desc&page=${page}`,
      );

    // Page 1 says how many pages exist; the rest are fetched together.
    let first: TmdbPage<TmdbMovieListItem>;
    try {
      first = await discover(1);
    } catch {
      return [];
    }
    const remaining = Array.from(
      { length: Math.max(0, Math.min(first.total_pages, FILM_PAGES) - 1) },
      (_, i) => i + 2,
    );
    const rest = await mapLimit(remaining, CONCURRENCY, async (page) => {
      try {
        return (await discover(page)).results;
      } catch {
        return [];
      }
    });
    const candidates = [first.results, ...rest].flat();

    const dated = await mapLimit(candidates, CONCURRENCY, async (m) => {
      try {
        return {
          id: m.id,
          dates: await this.client.get<TmdbReleaseDates>(`/movie/${m.id}/release_dates`),
        };
      } catch {
        return null;
      }
    });

    // Popularity can shift between page fetches, so a film may appear twice.
    const seen = new Set<string>();
    const releases: ReleaseRecord[] = [];
    for (const entry of dated) {
      if (!entry) continue;
      for (const { slug, date } of streamingPremieres(entry.dates, configs)) {
        if (date < today || date > end) continue;
        const release = movieRelease(slug, entry.id, date);
        if (seen.has(release.id)) continue;
        seen.add(release.id);
        releases.push(release);
      }
    }
    return releases;
  }

  async listReleases(query: ReleaseQuery): Promise<ReleaseRecord[]> {
    // Narrowing by provider narrows what is FETCHED, not just what is
    // returned. Filtering after the fact would make a one-service view cost
    // as much as the full feed.
    const configs = query.providerSlug
      ? PROVIDER_CONFIGS.filter((c) => c.slug === query.providerSlug)
      : PROVIDER_CONFIGS;
    if (configs.length === 0) return [];

    const [seasons, movies] = await Promise.all([
      this.upcomingSeasons(configs),
      this.upcomingFilms(configs),
    ]);
    const from = query.from ?? isoDate(this.now());
    return [...seasons, ...movies]
      .filter((r) => r.availableFrom >= from)
      .filter((r) => !query.to || r.availableFrom <= query.to)
      .sort((a, b) => a.availableFrom.localeCompare(b.availableFrom))
      .slice(0, query.first);
  }

  async getRelease(id: string): Promise<ReleaseRecord | null> {
    // id shape: release:<slug>:movie:<tmdbId> or release:<slug>:tv:<tmdbId>:s<n>
    const [prefix, slug, kind, tmdbId, seasonPart] = id.split(":");
    if (prefix !== "release" || !slug || !kind || !tmdbId) return null;

    try {
      if (kind === "movie") {
        const d = await this.client.get<TmdbMovieDetail>(
          `/movie/${tmdbId}?append_to_response=release_dates`,
        );
        const config = PROVIDER_CONFIGS.find((c) => c.slug === slug);
        if (!config || !d.release_dates) return null;
        // The most recent arrival on this service, if it has had several.
        const date = streamingPremieres(d.release_dates, [config])
          .map((p) => p.date)
          .sort()
          .at(-1);
        // TMDB reports 0 minutes for films it has no runtime for yet.
        return date ? movieRelease(slug, tmdbId, date, d.runtime || null) : null;
      }

      if (kind === "tv") {
        const d = await this.client.get<TmdbTvDetail>(`/tv/${tmdbId}`);
        const wanted = Number(seasonPart?.replace(/^s/, ""));
        const season = (d.seasons ?? []).find((x) => x.season_number === wanted);
        if (!season) return null;

        let analysis: SeasonAnalysis | null = null;
        try {
          analysis = analyseSeason(
            await this.client.get<TmdbSeasonDetail>(`/tv/${tmdbId}/season/${wanted}`),
          );
        } catch {
          analysis = null;
        }
        return seasonRelease(slug, tmdbId, wanted, analysis, season.air_date);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * One request per id. TMDB has no batch endpoint, so DataLoader's win here
   * is deduplication and per-request caching rather than a single round trip;
   * append_to_response folds detail+videos into one call instead of two.
   */
  async getMedia(ids: readonly string[]): Promise<(MediaRecord | null)[]> {
    return mapLimit(ids, CONCURRENCY, (id) => this.getOneMedia(id));
  }

  private async getOneMedia(id: string): Promise<MediaRecord | null> {
    const [kind, tmdbId] = id.split(":");
    if (!tmdbId) return null;

    try {
      if (kind === "tv") {
        return seriesRecord(
          await this.client.get<TmdbTvDetail>(`/tv/${tmdbId}?append_to_response=videos`),
        );
      }
      if (kind === "movie") {
        return movieRecord(
          await this.client.get<TmdbMovieDetail>(`/movie/${tmdbId}?append_to_response=videos`),
        );
      }

      return null;
    } catch {
      // A title that 404s upstream is a missing record, not a server error.
      return null;
    }
  }

  /**
   * One discover request per page. Every chosen service's provider ids are
   * OR-ed into one query, so four services cost what one does. Sorting the
   * ids keeps the URL - and so the cache key - the same whichever order the
   * services were ticked in.
   */
  async listCatalog(query: CatalogQuery): Promise<CatalogPageRecord> {
    const providerIds = PROVIDER_CONFIGS.filter((c) => query.providerSlugs.includes(c.slug))
      .flatMap((c) => c.watchProviderIds)
      .sort((a, b) => a - b);
    if (providerIds.length === 0) return { items: [], nextPage: null };

    const dated = query.kind === "MOVIE" ? "primary_release_date" : "first_air_date";
    const order = discoverOrder(query, dated, isoDate(this.now()));
    const filters =
      `with_watch_providers=${providerIds.join("|")}&watch_region=${WATCH_REGION}` +
      `&with_watch_monetization_types=flatrate&${order}&page=${query.page}`;
    // Nightly talk and news shows top "popular" every day, and are nothing
    // anyone plans a subscription around.
    const notDaily = `without_genres=${[TALK_GENRE, NEWS_GENRE].join("|")}`;

    if (query.kind === "MOVIE") {
      const body = await this.client.get<TmdbPage<TmdbMovieListItem>>(`/discover/movie?${filters}`);
      return catalogPage(
        body.results.map((m) => movieRecord(m)),
        body.total_pages,
        query.page,
      );
    }
    const body = await this.client.get<TmdbPage<TmdbTvListItem>>(
      `/discover/tv?${filters}&${notDaily}`,
    );
    return catalogPage(body.results.map(seriesRecord), body.total_pages, query.page);
  }

  /**
   * One discover request a page. With a region and release type set, TMDB
   * filters and sorts on that country's dates of that type - here, US disc
   * releases - and every tracked service's provider ids are excluded in the
   * same request, so nothing is looked up per film.
   */
  async listDiscCatalog(query: DiscCatalogQuery): Promise<CatalogPageRecord> {
    const today = isoDate(this.now());
    const tracked = PROVIDER_CONFIGS.flatMap((c) => c.watchProviderIds).sort((a, b) => a - b);
    // Years are first releases; "newest" is newest out on disc, not newest
    // in cinemas, and release_date - the disc date - is capped below.
    const order = discoverOrder(query, "primary_release_date", today, {
      newest: "release_date",
      newestCapped: true,
      voteFloor: DISC_VOTE_FLOOR,
    });
    const body = await this.client.get<TmdbPage<TmdbMovieListItem>>(
      `/discover/movie?region=${WATCH_REGION}&with_release_type=${PHYSICAL_RELEASE}` +
        `&release_date.lte=${today}&watch_region=${WATCH_REGION}` +
        `&without_watch_providers=${tracked.join("|")}&${order}&page=${query.page}`,
    );
    // The list's dates are disc dates here, so no first-release year.
    return catalogPage(
      body.results.map((m) => movieRecord(m, false)),
      body.total_pages,
      query.page,
    );
  }

  /**
   * Discover finds the films with a US disc date in the window, a page or two
   * of them; then each film's release dates - the URL getOnDisc reads, so
   * cached for the dialog - say which date that is.
   */
  async listDiscReleases(first: number): Promise<DiscReleaseRecord[]> {
    const today = isoDate(this.now());
    const end = isoDate(addDays(this.now(), WINDOW_DAYS));
    const discover = (page: number) =>
      this.client.get<TmdbPage<TmdbMovieListItem>>(
        `/discover/movie?region=${WATCH_REGION}&with_release_type=${PHYSICAL_RELEASE}` +
          `&release_date.gte=${today}&release_date.lte=${end}` +
          `&sort_by=popularity.desc&page=${page}`,
      );

    let firstPage: TmdbPage<TmdbMovieListItem>;
    try {
      firstPage = await discover(1);
    } catch {
      return [];
    }
    const remaining = Array.from(
      { length: Math.max(0, Math.min(firstPage.total_pages, DISC_PAGES) - 1) },
      (_, i) => i + 2,
    );
    const rest = await mapLimit(remaining, CONCURRENCY, async (page) => {
      try {
        return (await discover(page)).results;
      } catch {
        return [];
      }
    });
    // Popularity can shift between page fetches, so a film may appear twice.
    const candidates = [
      ...new Map([firstPage.results, ...rest].flat().map((m) => [m.id, m])).values(),
    ];

    const dated = await mapLimit(candidates, CONCURRENCY, async (m) => {
      try {
        const dates = await this.client.get<TmdbReleaseDates>(`/movie/${m.id}/release_dates`);
        return { id: m.id, date: usDiscRelease(dates, today, end) };
      } catch {
        return null;
      }
    });

    return dated
      .flatMap((d) =>
        d?.date
          ? [{ id: `disc:movie:${d.id}`, mediaId: `movie:${d.id}`, availableFrom: d.date }]
          : [],
      )
      .sort((a, b) => a.availableFrom.localeCompare(b.availableFrom))
      .slice(0, first);
  }

  /**
   * One request to /search/multi rather than /search/movie + /search/tv:
   * TMDB ranks the combined list itself, and merging two separately ranked
   * lists has no correct answer. One page (20 results) is the ceiling.
   *
   * Records are thin: the search endpoint carries no videos or runtimes, so
   * trailer, runtimeMinutes and seasonCount are null here even when the title
   * has them. The resolver layer decides what to do about that.
   */
  async searchMedia(query: string, first: number): Promise<MediaRecord[]> {
    const q = query.trim();
    if (!q) return [];

    const page = await this.client.get<TmdbPage<TmdbMultiItem>>(
      `/search/multi?query=${encodeURIComponent(q)}&include_adult=false`,
    );

    return page.results
      .flatMap((item): MediaRecord[] => {
        switch (item.media_type) {
          case "movie":
            return [{ ...movieRecord(item), summary: true }];
          case "tv":
            return [{ ...seriesRecord(item), summary: true }];

          default:
            return [];
        }
      })
      .slice(0, first);
  }

  /** One request per title; the id's kind is TMDB's path segment. */
  async getAvailability(ids: readonly string[]): Promise<AvailabilityRecord[]> {
    const none: AvailabilityRecord = { slugs: [], others: [] };
    return mapLimit(ids, CONCURRENCY, async (id) => {
      const [kind, tmdbId] = id.split(":");
      if ((kind !== "movie" && kind !== "tv") || !tmdbId) return none;
      try {
        const availability = await this.client.get<TmdbWatchProviders>(
          `/${kind}/${tmdbId}/watch/providers`,
        );
        return {
          slugs: subscriptionServices(availability, PROVIDER_CONFIGS),
          others: otherServices(availability, PROVIDER_CONFIGS),
        };
      } catch {
        return none;
      }
    });
  }

  /**
   * Films: their release dates, the same URL the Coming Soon film scan
   * fetches. Series: their detail, the same URL the feed and next-season
   * lookups fetch. So this is usually answered from the cache.
   */
  async getOnDisc(ids: readonly string[]): Promise<boolean[]> {
    return mapLimit(ids, CONCURRENCY, async (id) => {
      const [kind, tmdbId] = id.split(":");
      if (!tmdbId) return false;
      try {
        if (kind === "movie") {
          return filmOnDisc(
            await this.client.get<TmdbReleaseDates>(`/movie/${tmdbId}/release_dates`),
          );
        }
        if (kind === "tv") {
          const detail = await this.client.get<TmdbTvDetail>(`/tv/${tmdbId}`);
          return seriesOnDisc(
            detail.id,
            (detail.networks ?? []).map((n) => n.id),
          );
        }
        return false;
      } catch {
        return false;
      }
    });
  }

  /**
   * One request for the series, then one per season. TMDB's series-level
   * episode_run_time is empty for most shows, so the only reliable total is
   * the sum of every episode. The Office is ten requests - once, then cached.
   * Two series at a time, each fetching its seasons in parallel, keeps the
   * burst near CONCURRENCY rather than its square.
   */
  async getSeriesRuntimes(ids: readonly string[]): Promise<(RuntimeRecord | null)[]> {
    return mapLimit(ids, 2, (id) => this.getOneSeriesRuntime(id));
  }

  private async getOneSeriesRuntime(id: string): Promise<RuntimeRecord | null> {
    const [kind, tmdbId] = id.split(":");
    if (kind !== "tv" || !tmdbId) return null;
    try {
      const detail = await this.client.get<TmdbTvDetail>(`/tv/${tmdbId}`);
      const numbers = (detail.seasons ?? []).map((s) => s.season_number).filter((n) => n > 0);
      const seasons = await mapLimit(numbers, CONCURRENCY / 2, (n) =>
        this.client.get<TmdbSeasonDetail>(`/tv/${tmdbId}/season/${n}`),
      );
      return seriesRuntime(seasons, isoDate(this.now()));
    } catch {
      return null;
    }
  }

  /** The same release-dates URL the feed's film scan reads, so usually cached. */
  async getFilmArrivals(ids: readonly string[]): Promise<ReleaseRecord[][]> {
    return mapLimit(ids, CONCURRENCY, async (id) => {
      const [kind, tmdbId] = id.split(":");
      if (kind !== "movie" || !tmdbId) return [];
      try {
        const dates = await this.client.get<TmdbReleaseDates>(`/movie/${tmdbId}/release_dates`);
        return streamingPremieres(dates, PROVIDER_CONFIGS)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((p) => movieRelease(p.slug, tmdbId, p.date));
      } catch {
        return [];
      }
    });
  }

  /** The series detail the feed and next-season lookups fetch, so usually cached. */
  async getSeriesServices(ids: readonly string[]): Promise<string[][]> {
    return mapLimit(ids, CONCURRENCY, async (id) => {
      const [kind, tmdbId] = id.split(":");
      if (kind !== "tv" || !tmdbId) return [];
      try {
        const detail = await this.client.get<TmdbTvDetail>(`/tv/${tmdbId}`);
        const networks = new Set((detail.networks ?? []).map((n) => n.id));
        return PROVIDER_CONFIGS.filter(
          (c) => c.networkId !== null && networks.has(c.networkId),
        ).map((c) => c.slug);
      } catch {
        return [];
      }
    });
  }

  /**
   * The series detail (the same URL the Coming Soon feed fetches, so often
   * already cached), then the one season it points to. Its episode dates go
   * through analyseSeason, so an unscheduled finale is null here exactly as
   * it is on a Release.
   */
  async getNextSeasons(ids: readonly string[]): Promise<(SeasonScheduleRecord | null)[]> {
    return mapLimit(ids, CONCURRENCY, async (id) => {
      const [kind, tmdbId] = id.split(":");
      if (kind !== "tv" || !tmdbId) return null;
      try {
        const detail = await this.client.get<TmdbTvDetail>(`/tv/${tmdbId}`);
        const seasonNumber = nextSeasonNumber(detail);
        if (seasonNumber === null) return null;
        const listed = detail.seasons?.find((x) => x.season_number === seasonNumber);
        const season = await this.client.get<TmdbSeasonDetail>(
          `/tv/${tmdbId}/season/${seasonNumber}`,
        );
        const analysis = analyseSeason(season);
        const premieresOn = analysis.firstAirDate ?? listed?.air_date ?? null;

        // Estimate only what is actually unknown: a weekly (or not yet known)
        // season with no finale date. One more request, for the season before.
        const needsEstimate =
          analysis.bingeableFrom === null && analysis.isFullDrop !== true && seasonNumber > 1;
        const previous = needsEstimate
          ? await this.client
              .get<TmdbSeasonDetail>(`/tv/${tmdbId}/season/${seasonNumber - 1}`)
              .catch(() => null)
          : null;

        return {
          mediaId: id,
          seasonNumber,
          premieresOn,
          fullyOutOn: analysis.bingeableFrom,
          expectedFullyOutOn: expectedFinale(premieresOn, previous, season),
          isFullDrop: analysis.isFullDrop,
          // Zero listed episodes means "not announced", not "no episodes".
          episodeCount: analysis.episodeCount || null,
        };
      } catch {
        return null;
      }
    });
  }

  /** The season and the one before it: URLs the next-season lookup fetches. */
  async getSeasonRuntimes(keys: readonly string[]): Promise<(RuntimeRecord | null)[]> {
    return mapLimit(keys, CONCURRENCY, async (key) => {
      const [mediaId, number] = key.split("#");
      const [kind, tmdbId] = (mediaId ?? "").split(":");
      const n = Number(number);
      if (kind !== "tv" || !tmdbId || !Number.isInteger(n)) return null;
      try {
        const season = await this.client.get<TmdbSeasonDetail>(`/tv/${tmdbId}/season/${n}`);
        const previous =
          n > 1
            ? await this.client
                .get<TmdbSeasonDetail>(`/tv/${tmdbId}/season/${n - 1}`)
                .catch(() => null)
            : null;
        return seasonWatchTime(season, previous);
      } catch {
        return null;
      }
    });
  }

  imageUrl(path: string | null, size: ImageSize): string | null {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${IMAGE_WIDTHS[size]}${path}`;
  }

  videoUrl(video: VideoRecord): string {
    return `https://www.youtube.com/watch?v=${video.key}`;
  }
  videoEmbedUrl(video: VideoRecord): string | null {
    if (video.site !== "YouTube") return null;
    return `https://www.youtube-nocookie.com/embed/${video.key}`;
  }
}
