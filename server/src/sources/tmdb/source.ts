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
  TmdbPage,
  TmdbSeasonDetail,
  TmdbTvDetail,
  TmdbTvListItem,
  TmdbVideo,
} from "./types.js";

/** TMDB's own ids for Netflix. 213 is the network, 8 the watch provider. */
const NETFLIX_NETWORK_ID = 213;
const NETFLIX_PROVIDER_ID = 8;
const WATCH_REGION = "US";

const NETFLIX: ProviderRecord = {
  id: "provider:netflix",
  slug: "netflix",
  name: "Netflix",
  logoPath: "/rK1KljqmbvO9HQa1PBFLILWah72.png",
};

const PROVIDERS = [NETFLIX];

/** TMDB serves fixed width buckets; ImageSize maps onto the nearest one. */
const IMAGE_WIDTHS: Record<ImageSize, string> = {
  SMALL: "w154",
  MEDIUM: "w342",
  LARGE: "w780",
  ORIGINAL: "original",
};

const MOVIE_PAGES = 2; // 20 per page -> the "top 40 by popularity" backlog
/** How far ahead the feed looks. Sized to the pause/resume decision. */
const WINDOW_DAYS = 90;
/** Candidate series pages scanned for season premieres. 20 per page. */
const SERIES_PAGES = 2;
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
function analyseSeason(season: TmdbSeasonDetail): {
  firstAirDate: string | null;
  bingeableFrom: string | null;
  isFullDrop: boolean;
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
  return {
    firstAirDate: dates[0] as string,
    bingeableFrom: dates[dates.length - 1] as string,
    isFullDrop: new Set(dates).size === 1,
    episodeCount: season.episodes.length,
    watchTimeMinutes,
  };
}

/**
 * Picks one preview from TMDB's unordered list: official YouTube trailers
 * first, then teasers. Doing this server-side is why the schema exposes a
 * single `trailer` rather than a list for the client to sort through.
 */
function pickTrailer(videos: TmdbVideo[] | undefined): VideoRecord | null {
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
   * Season premieres landing in the window, for new and returning series.
   *
   * Filtering on `first_air_date` would only find series that have never
   * aired, missing every returning season - and a returning season is the
   * stronger reason to resume a paused subscription. So this filters on
   * `air_date` (any episode airing soon), then keeps only seasons whose own
   * air_date falls in the window. That second step drops shows that are
   * merely mid-season, which would otherwise flood the feed.
   */
  private async upcomingSeasons(): Promise<ReleaseRecord[]> {
    const today = isoDate(this.now());
    const end = isoDate(addDays(this.now(), WINDOW_DAYS));

    const pages = await Promise.all(
      Array.from({ length: SERIES_PAGES }, (_, i) =>
        this.client.get<TmdbPage<TmdbTvListItem>>(
          `/discover/tv?with_networks=${NETFLIX_NETWORK_ID}` +
            `&air_date.gte=${today}&air_date.lte=${end}` +
            `&sort_by=popularity.desc&page=${i + 1}`,
        ),
      ),
    );

    const candidates = pages.flatMap((p) => p.results);
    const details = await mapLimit(candidates, CONCURRENCY, async (c) => {
      try {
        return await this.client.get<TmdbTvDetail>(`/tv/${c.id}`);
      } catch {
        return null;
      }
    });

    // Seasons whose listed air_date lands in the window. Episode-level detail
    // is fetched only for these, not for every season of every candidate.
    const wanted: { seriesId: number; seasonNumber: number }[] = [];
    for (const detail of details) {
      if (!detail) continue;
      for (const season of detail.seasons ?? []) {
        // Season 0 is TMDB's bucket for specials, not a real season drop.
        if (season.season_number === 0) continue;
        if (!season.air_date) continue;
        if (season.air_date < today || season.air_date > end) continue;
        wanted.push({ seriesId: detail.id, seasonNumber: season.season_number });
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
        .find((d) => d?.id === w.seriesId)
        ?.seasons?.find((x) => x.season_number === w.seasonNumber)?.air_date;
      const availableFrom = analysis?.firstAirDate ?? listed;
      if (!availableFrom) continue;

      releases.push({
        id: `release:netflix:tv:${w.seriesId}:s${w.seasonNumber}`,
        mediaId: `tv:${w.seriesId}`,
        providerSlug: "netflix",
        availableFrom,
        bingeableFrom: analysis?.bingeableFrom ?? availableFrom,
        isFullDrop: analysis?.isFullDrop ?? true,
        episodeCount: analysis?.episodeCount ?? null,
        watchTimeMinutes: analysis?.watchTimeMinutes ?? null,
        seasonNumber: w.seasonNumber,
      });
    }
    return releases;
  }

  private async availableMovies(): Promise<ReleaseRecord[]> {
    const pages = await Promise.all(
      Array.from({ length: MOVIE_PAGES }, (_, i) =>
        this.client.get<TmdbPage<TmdbMovieListItem>>(
          `/discover/movie?with_watch_providers=${NETFLIX_PROVIDER_ID}` +
            `&watch_region=${WATCH_REGION}&with_watch_monetization_types=flatrate` +
            `&sort_by=popularity.desc&page=${i + 1}`,
        ),
      ),
    );
    return pages
      .flatMap((p) => p.results)
      .filter((m) => m.release_date)
      .map((m) => ({
        id: `release:netflix:movie:${m.id}`,
        episodeCount: null,
        mediaId: `movie:${m.id}`,
        providerSlug: "netflix",
        availableFrom: m.release_date,
        bingeableFrom: m.release_date,
        isFullDrop: true,
        seasonNumber: null,
        watchTimeMinutes: null,
      }));
  }

  async listReleases(query: ReleaseQuery): Promise<ReleaseRecord[]> {
    const [seasons, movies] = await Promise.all([
      this.upcomingSeasons(),
      this.availableMovies(),
    ]);
    const from = query.from ?? isoDate(this.now());
    return [...seasons, ...movies]
      .filter(
        (r) => !query.providerSlug || r.providerSlug === query.providerSlug,
      )
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
          bingeableFrom: analysis?.bingeableFrom ?? availableFrom,
          isFullDrop: analysis?.isFullDrop ?? true,
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

  imageUrl(path: string | null, size: ImageSize): string | null {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${IMAGE_WIDTHS[size]}${path}`;
  }

  videoUrl(video: VideoRecord): string {
    return `https://www.youtube.com/watch?v=${video.key}`;
  }
}