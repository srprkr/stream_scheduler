import type {
  CatalogSource,
  ImageSize,
  MediaRecord,
  ProviderRecord,
  ReleaseQuery,
  ReleaseRecord,
  VideoRecord,
} from "../types.js";
import { addDays, isoDate } from "../../dates.js";
import type { TmdbClient } from "./client.js";
import type {
  TmdbMovieDetail,
  TmdbMovieListItem,
  TmdbMultiItem,
  TmdbPage,
  TmdbReleaseDates,
  TmdbSeasonDetail,
  TmdbTvDetail,
  TmdbTvListItem,
  TmdbVideo,
} from "./types.js";

const WATCH_REGION = "US";

/**
 * A streaming service, plus the two different TMDB handles needed to find its
 * content.
 *
 * `networkId` finds a service's own originals, including ones that have not
 * aired yet and so appear under no watch provider. `watchProviderIds` finds
 * what is actually streamable there now. A service needs both, and the second
 * is a list because TMDB splits one consumer-facing service across tiers -
 * Paramount+ has Essential and Premium. Reseller entries ("Paramount+ Amazon
 * Channel") are deliberately excluded; they are the same catalogue and would
 * double-count.
 */
interface ProviderConfig extends ProviderRecord {
  networkId: number | null;
    /** Lower-case names a TMDB release-date note uses for this service. */
  noteAliases: string[];
  watchProviderIds: number[];
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "provider:netflix",
    slug: "netflix",
    name: "Netflix",
    logoPath: "/rK1KljqmbvO9HQa1PBFLILWah72.png",
    networkId: 213,
    noteAliases: ["netflix"],
    watchProviderIds: [8],
  },
  {
    id: "provider:peacock",
    slug: "peacock",
    name: "Peacock",
    logoPath: "/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png",
    noteAliases: ["peacock"],
    networkId: 3353,
    watchProviderIds: [386],
  },
  // Verified against the TMDB API; each is a one-line addition when wanted.
  // Every provider added multiplies the cold-feed request count, so enable
  // them alongside a background cache refresh rather than before one.
  //
  //   hulu       network 453   providers [15]         logo /44uAnmSqvA4yBOdbPWN8YgQHjWm.png
  //   prime      network 1024  providers [9]          logo /gMZdpavHmxFNnLpMHwVxfqeux2g.png
  //   appletv    network 2552  providers [350]        logo /9icYBfYFcwgCbky5VdGUIKJ4C5i.png
  //   disney     network 2739  providers [337]        logo /5eZ872CghnHFLB1j8grszbrx0dx.png
  //   hbomax     network 49    providers [1899]       logo /skypuy7SXuugIQeYg0IglmzoKaS.png
  //   paramount  network 4330  providers [2303, 2616] logo /4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png
  //
  // Note: network 49 is HBO, the cable network, not Max. It finds HBO
  // originals but misses Max-only titles. Good enough, not exact.
];

const PROVIDERS: ProviderRecord[] = PROVIDER_CONFIGS.map(
  ({ id, slug, name, logoPath }) => ({ id, slug, name, logoPath }),
);

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
/** TMDB release type for a digital release, streaming premieres included. */
const DIGITAL_RELEASE = 4;

const WINDOW_DAYS = 90;
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
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

type SeasonAnalysis = ReturnType<typeof analyseSeason>;

/**
 * One season as a release. Shared by the feed and getRelease so the two
 * cannot disagree about what an unscheduled season looks like.
 */
function seasonRelease(
  slug: string,
  seriesId: number | string,
  seasonNumber: number,
  analysis: SeasonAnalysis | null,
  listedDate: string | null | undefined,
): ReleaseRecord | null {
  const availableFrom = analysis?.firstAirDate ?? listedDate;
  if (!availableFrom) return null;
  return {
    id: `release:${slug}:tv:${seriesId}:s${seasonNumber}`,
    mediaId: `tv:${seriesId}`,
    providerSlug: slug,
    availableFrom,
    bingeableFrom: analysis?.bingeableFrom ?? null,
    isFullDrop: analysis?.isFullDrop ?? null,
    episodeCount: analysis?.episodeCount ?? null,
    watchTimeMinutes: analysis?.watchTimeMinutes ?? null,
    seasonNumber,
  };
}

/** A film arriving on one service. A film is always a full drop. */
function movieRelease(
  slug: string,
  movieId: number | string,
  date: string,
  runtime: number | null = null,
): ReleaseRecord {
  return {
    id: `release:${slug}:movie:${movieId}`,
    mediaId: `movie:${movieId}`,
    providerSlug: slug,
    availableFrom: date,
    bingeableFrom: date,
    isFullDrop: true,
    episodeCount: null,
    watchTimeMinutes: runtime,
    seasonNumber: null,
  };
}

/**
 * Streaming premieres hidden in a film's release dates: US Digital entries
 * whose note names a configured service. The note is user-entered free text
 * ("HBO Max", "Max", "Hulu / Netflix"), so it is split on "/" and "," and each
 * part matched exactly against the service's aliases. A blank note is a
 * rent-or-buy release and matches nothing.
 */
export function streamingPremieres(
  dates: TmdbReleaseDates,
  configs: readonly { slug: string; noteAliases: readonly string[] }[],
): { slug: string; date: string }[] {
  const local = dates.results.find((c) => c.iso_3166_1 === WATCH_REGION);
  const premieres: { slug: string; date: string }[] = [];
  for (const d of local?.release_dates ?? []) {
    if (d.type !== DIGITAL_RELEASE) continue;
    const parts = d.note.toLowerCase().split(/[\/,]/).map((p) => p.trim());
    for (const config of configs) {
      if (parts.some((p) => config.noteAliases.includes(p))) {
        premieres.push({ slug: config.slug, date: d.release_date.slice(0, 10) });
      }
    }
  }
  return premieres;
}

/**
 * A film as a MediaRecord. Takes the list shape so search results and full
 * details share one mapping; detail-only fields are optional and come back
 * null when the caller only had a list item.
 */
function movieRecord(
  movie: TmdbMovieListItem & Partial<Pick<TmdbMovieDetail, "runtime" | "videos">>,
): MediaRecord {
  return {
    id: `movie:${movie.id}`,
    kind: "MOVIE",
    title: movie.title,
    overview: movie.overview || null,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    trailer: pickTrailer(movie.videos?.results),
    runtimeMinutes: movie.runtime ?? null,
    seasonCount: null,
  };
}

/** A series as a MediaRecord. Same list-or-detail contract as movieRecord. */
function seriesRecord(
  series: TmdbTvListItem & Partial<Pick<TmdbTvDetail, "number_of_seasons" | "videos">>,
): MediaRecord {
  return {
    id: `tv:${series.id}`,
    kind: "SERIES",
    title: series.name,
    overview: series.overview || null,
    posterPath: series.poster_path,
    backdropPath: series.backdrop_path,
    trailer: pickTrailer(series.videos?.results),
    runtimeMinutes: null,
    seasonCount: series.number_of_seasons ?? null,
  };
}

/**
 * Collapses a season's episode dates into the two facts the product needs:
 * when the season is fully watchable, and whether it lands all at once.
 *
 * Netflix mostly full-drops, but not always - a weekly season can span two
 * months, and treating its premiere as the binge date is what would tell a
 * user to unpause eight weeks early.
 */
export function analyseSeason(season: TmdbSeasonDetail): {
  firstAirDate: string | null;
  bingeableFrom: string | null;
  isFullDrop: boolean | null;
  episodeCount: number;
  watchTimeMinutes: number | null;
} {
  const dates = season.episodes
    .map((e) => e.air_date)
    .filter((d): d is string => Boolean(d))
    .sort();

  const runtimes = season.episodes
    .map((e) => e.runtime)
    .filter((r): r is number => typeof r === "number" && r > 0);
  // Partial runtime data would understate the season, so it is all or nothing.
  const watchTimeMinutes =
    runtimes.length === season.episodes.length && runtimes.length > 0
      ? runtimes.reduce((a, b) => a + b, 0)
      : null;

  if (dates.length === 0) {
    return {
      firstAirDate: null,
      bingeableFrom: null,
      isFullDrop: null,
      episodeCount: season.episodes.length,
      watchTimeMinutes,
    };
  }
  // Two distinct dates prove a weekly season even with gaps; one date proves
  // nothing while other episodes are undated.
  const complete = dates.length === season.episodes.length;
  const weekly = new Set(dates).size > 1;
  return {
    firstAirDate: dates[0] as string,
    bingeableFrom: complete ? (dates[dates.length - 1] as string) : null,
    isFullDrop: weekly ? false : complete ? true : null,
    episodeCount: season.episodes.length,
    watchTimeMinutes,
  };
}

/**
 * Picks one preview from TMDB's unordered list: official YouTube trailers
 * first, then teasers. Doing this server-side is why the schema exposes a
 * single `trailer` rather than a list for the client to sort through.
 */
export function pickTrailer(videos: TmdbVideo[] | undefined): VideoRecord | null {
  if (!videos?.length) return null;
  const youtube = videos.filter((v) => v.site === "YouTube");
  const best =
    youtube.find((v) => v.type === "Trailer" && v.official) ??
    youtube.find((v) => v.type === "Trailer") ??
    youtube.find((v) => v.type === "Teaser");
  if (!best) return null;
  return {
    id: `video:${best.id}`,
    name: best.name,
    site: best.site,
    key: best.key,
    type: best.type,
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

  async getProviders(
    slugs: readonly string[],
  ): Promise<(ProviderRecord | null)[]> {
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
  private async upcomingSeasons(
    configs: ProviderConfig[],
  ): Promise<ReleaseRecord[]> {
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
        ?.detail.seasons?.find((x) => x.season_number === w.seasonNumber)
        ?.air_date;

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
  private async upcomingFilms(
    configs: ProviderConfig[],
  ): Promise<ReleaseRecord[]> {
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