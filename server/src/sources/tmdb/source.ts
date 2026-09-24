import type {
  CatalogSource,
  ImageSize,
  MediaRecord,
  ProviderRecord,
  ReleaseQuery,
  ReleaseRecord,
  VideoRecord,
} from "../types.js";
import type { TmdbClient } from "./client.js";
import type {
  TmdbMovieDetail,
  TmdbMovieListItem,
  TmdbMultiItem,
  TmdbPage,
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
  watchProviderIds: number[];
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "provider:netflix",
    slug: "netflix",
    name: "Netflix",
    logoPath: "/rK1KljqmbvO9HQa1PBFLILWah72.png",
    networkId: 213,
    watchProviderIds: [8],
  },
  {
    id: "provider:peacock",
    slug: "peacock",
    name: "Peacock",
    logoPath: "/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png",
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

const MOVIE_PAGES = 1; // 20 per page -> the "top 40 by popularity" backlog
/** How far ahead the feed looks. Sized to the pause/resume decision. */
const WINDOW_DAYS = 90;
/** Candidate series pages scanned for season premieres. 20 per page. */
const SERIES_PAGES = 1;
/** Ceiling on simultaneous upstream requests, so a cold feed cannot burst. */
const CONCURRENCY = 8;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

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
      isFullDrop: true,
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
 *   - MOVIES: TMDB does not publish future streaming dates, so these are
 *     what is on Netflix *now*, ranked by popularity, with availableFrom set
 *     to the title's release date. They land in the past by design.
 */
export class TmdbSource implements CatalogSource {
  readonly name = "tmdb";

  constructor(
    private readonly client: TmdbClient,
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
      const availableFrom = analysis?.firstAirDate ?? listed;
      if (!availableFrom) continue;

      releases.push({
        id: `release:${w.slug}:tv:${w.seriesId}:s${w.seasonNumber}`,
        mediaId: `tv:${w.seriesId}`,
        providerSlug: w.slug,
        availableFrom,
        bingeableFrom: analysis?.bingeableFrom ?? null,
        isFullDrop: analysis?.isFullDrop ?? null,
        episodeCount: analysis?.episodeCount ?? null,
        watchTimeMinutes: analysis?.watchTimeMinutes ?? null,
        seasonNumber: w.seasonNumber,
      });
    }
    return releases;
  }


  private async availableMovies(
    configs: ProviderConfig[],
  ): Promise<ReleaseRecord[]> {
    const jobs = configs.flatMap((config) =>
      Array.from({ length: MOVIE_PAGES }, (_, i) => ({ config, page: i + 1 })),
    );

    const pages = await mapLimit(jobs, CONCURRENCY, async ({ config, page }) => {
      try {
        // Tier ids are OR-ed: "on this service at all", not "on this tier".
        const body = await this.client.get<TmdbPage<TmdbMovieListItem>>(
          `/discover/movie?with_watch_providers=${config.watchProviderIds.join("|")}` +
            `&watch_region=${WATCH_REGION}&with_watch_monetization_types=flatrate` +
            `&sort_by=popularity.desc&page=${page}`,
        );
        return { slug: config.slug, results: body.results };
      } catch {
        return { slug: config.slug, results: [] as TmdbMovieListItem[] };
      }
    });

    const seen = new Set<number>();
    const releases: ReleaseRecord[] = [];
    for (const { slug, results } of pages) {
      for (const m of results) {
        if (!m.release_date) continue;
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        releases.push({
          id: `release:${slug}:movie:${m.id}`,
          mediaId: `movie:${m.id}`,
          providerSlug: slug,
          availableFrom: m.release_date,
          bingeableFrom: m.release_date,
          isFullDrop: true,
          episodeCount: null,
          watchTimeMinutes: null,
          seasonNumber: null,
        });
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
      this.availableMovies(configs),
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
        const d = await this.client.get<TmdbMovieDetail>(`/movie/${tmdbId}`);
        if (!d.release_date) return null;
        return {
          id,
          episodeCount: null,          
          mediaId: `movie:${tmdbId}`,
          providerSlug: slug,
          availableFrom: d.release_date,
          bingeableFrom: d.release_date,
          isFullDrop: true,
          seasonNumber: null,
          watchTimeMinutes: d.runtime,
        };
      }

      if (kind === "tv") {
        const d = await this.client.get<TmdbTvDetail>(`/tv/${tmdbId}`);
        const wanted = Number(seasonPart?.replace(/^s/, ""));
        const season = (d.seasons ?? []).find((x) => x.season_number === wanted);
        let analysis: ReturnType<typeof analyseSeason> | null = null;
        if (season) {
          try {
            analysis = analyseSeason(
              await this.client.get<TmdbSeasonDetail>(
                `/tv/${tmdbId}/season/${season.season_number}`,
              ),
            );
          } catch {
            analysis = null;
          }
        }

        const availableFrom =
          analysis?.firstAirDate ?? season?.air_date ?? d.first_air_date;

        if (!availableFrom) return null;
        return {
          episodeCount: analysis?.episodeCount ?? null,
          id,
          mediaId: `tv:${tmdbId}`,
          providerSlug: slug,
          availableFrom,
          bingeableFrom: analysis?.bingeableFrom ?? null,
          isFullDrop: analysis?.isFullDrop ?? null,
          seasonNumber: season?.season_number ?? null,
          watchTimeMinutes: analysis?.watchTimeMinutes ?? null,
        };
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
        const d = await this.client.get<TmdbTvDetail>(
          `/tv/${tmdbId}?append_to_response=videos`,
        );
        return {
          id,
          kind: "SERIES",
          title: d.name,
          overview: d.overview || null,
          posterPath: d.poster_path,
          backdropPath: d.backdrop_path,
          trailer: pickTrailer(d.videos?.results),
          runtimeMinutes: null,
          seasonCount: d.number_of_seasons,
        };
      }
      if (kind === "movie") {
        const d = await this.client.get<TmdbMovieDetail>(
          `/movie/${tmdbId}?append_to_response=videos`,
        );
        return {
          id,
          kind: "MOVIE",
          title: d.title,
          overview: d.overview || null,
          posterPath: d.poster_path,
          backdropPath: d.backdrop_path,
          trailer: pickTrailer(d.videos?.results),
          runtimeMinutes: d.runtime,
          seasonCount: null,
        };
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
            return [{
              id: `movie:${item.id}`,
              kind: "MOVIE",
              title: item.title,
              overview: item.overview || null,
              posterPath: item.poster_path,
              backdropPath: item.backdrop_path,
              trailer: null,
              runtimeMinutes: null,
              seasonCount: null,
            }];
          case "tv":
            return [{
              id: `tv:${item.id}`,
              kind: "SERIES",
              title: item.name,
              overview: item.overview || null,
              posterPath: item.poster_path,
              backdropPath: item.backdrop_path,
              trailer: null,
              runtimeMinutes: null,
              seasonCount: null,
            }];
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