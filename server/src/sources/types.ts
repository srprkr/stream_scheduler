/**
 * The boundary between "where catalogue data comes from" and the GraphQL layer.
 *
 * Naming note: GraphQL's `Provider` is a streaming service (Netflix). A
 * `CatalogSource` is an upstream data feed (TMDB). They are different things
 * and calling both "provider" is how that distinction gets lost.
 *
 * Every method that fetches by id takes an ARRAY. That is not decoration - it
 * is what makes DataLoader batching possible without reworking this interface
 * later.
 */

export type MediaKind = "MOVIE" | "SERIES";

/** Catalogue order, mirroring the GraphQL CatalogSort enum. */
export type CatalogSort = "POPULAR" | "TOP_RATED" | "NEWEST";

/** Requested image dimension, mirroring the GraphQL ImageSize enum. */
export type ImageSize = "SMALL" | "MEDIUM" | "LARGE" | "ORIGINAL";

export interface ProviderRecord {
  id: string;
  slug: string;
  name: string;
  /** Upstream-relative path. Turned into a URL by the source, not stored as one. */
  logoPath: string | null;
}

/**
 * A subscription service the app doesn't track - Crunchyroll, AMC+ - named
 * so the user knows where else a title streams. No plans, no filtering.
 */
export interface OtherServiceRecord {
  id: string;
  name: string;
  logoPath: string | null;
}

/** Where a title streams on subscription today. */
export interface AvailabilityRecord {
  /** Tracked services, by slug. */
  slugs: string[];
  /** Everything else worth naming. */
  others: OtherServiceRecord[];
}

export interface VideoRecord {
  id: string;
  name: string;
  /** e.g. "YouTube" */
  site: string;
  /** Site-specific id; composed into a URL by the source. */
  key: string;
  /** "Trailer" | "Teaser" | "Clip" */
  type: string;
}

export interface MediaRecord {
  id: string;
  kind: MediaKind;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  trailer: VideoRecord | null;
  /** MOVIE only. */
  runtimeMinutes: number | null;
  /** SERIES only. */
  seasonCount: number | null;
  /**
   * True when built from a search result, which carries no detail-only
   * fields: trailer, runtimeMinutes and seasonCount are unknown, not null.
   */
  summary?: boolean;
}

/** A season being released now, or next. Dates are YYYY-MM-DD. */
export interface SeasonScheduleRecord {
  /** The series it belongs to, so its watch time can be looked up on demand. */
  mediaId: string;
  seasonNumber: number;
  /** First episode's date; in the past while a weekly season is airing. */
  premieresOn: string | null;
  /** Last episode's date; null until every episode is dated. */
  fullyOutOn: string | null;
  /**
   * A guess, not a date: premiere plus the previous season's run. Only set
   * while fullyOutOn is unknown, and never used in its place.
   */
  expectedFullyOutOn: string | null;
  isFullDrop: boolean | null;
  episodeCount: number | null;
}

export interface RuntimeRecord {
  minutes: number;
  /** True when some episodes had no runtime and were filled in. */
  estimated: boolean;
}

export interface ReleaseRecord {
  /** ISO-8601 calendar date, YYYY-MM-DD. */
  availableFrom: string;
  /** Date the full season is watchable. Null until every episode is dated. */
  bingeableFrom: string | null;

  /** Episodes in this season. Null for a film. */
  episodeCount: number | null;
  id: string;
  /** False when episodes arrive over time. Null when upstream cannot tell yet. */
  isFullDrop: boolean | null;
  mediaId: string;
  providerSlug: string;

  /** Which season is arriving. Null for movies. */
  seasonNumber: number | null;
  /** Summed episode runtimes, in minutes. Null when upstream has none. */
  watchTimeMinutes: number | null;
}

export interface ReleaseQuery {
  providerSlug?: string | undefined;
  /** Inclusive lower bound, YYYY-MM-DD. */
  from?: string | undefined;
  /** Inclusive upper bound, YYYY-MM-DD. */
  to?: string | undefined;
  first: number;
}

export interface CatalogQuery {
  providerSlugs: readonly string[];
  kind: MediaKind;
  sort: CatalogSort;
  /** 1-based. Cursors are the resolver's concern; sources deal in pages. */
  page: number;
}

export interface CatalogPageRecord {
  /** Summaries, like search results: detail fields load on demand. */
  items: MediaRecord[];
  nextPage: number | null;
}

export interface CatalogSource {
  /** Identifies the implementation in logs and errors, e.g. "fixture", "tmdb". */
  readonly name: string;

  listProviders(): Promise<ProviderRecord[]>;
  /** Batched: one call per tick, however many slugs the query touched. */
  getProviders(slugs: readonly string[]): Promise<(ProviderRecord | null)[]>;

  listReleases(query: ReleaseQuery): Promise<ReleaseRecord[]>;
  getRelease(id: string): Promise<ReleaseRecord | null>;

  /** Batched, for the same reason as getProviders. */
  getMedia(ids: readonly string[]): Promise<(MediaRecord | null)[]>;

  /**
   * The services streaming each title on subscription today: tracked ones by
   * slug, and the untracked rest. Batched; empty for unknown titles.
   */
  getAvailability(ids: readonly string[]): Promise<AvailabilityRecord[]>;

  /**
   * Each film's streaming premieres on the tracked services, past and
   * future, soonest first. Batched; empty for series and unknown ids. The
   * resolver keeps the ones still to come.
   */
  getFilmArrivals(ids: readonly string[]): Promise<ReleaseRecord[][]>;

  /**
   * The tracked services each series was made for - where a new season
   * lands, even before any watch provider lists the show. Batched; empty for
   * films, and for series from networks the app doesn't track.
   */
  getSeriesServices(ids: readonly string[]): Promise<string[][]>;

  /**
   * The season each series is releasing now or will release next. Batched;
   * null for films, finished shows, and shows with nothing announced.
   */
  getNextSeasons(ids: readonly string[]): Promise<(SeasonScheduleRecord | null)[]>;

  /**
   * Whether each title has been released on DVD or Blu-ray - whether a copy
   * can be owned. Batched; false for unknown ids.
   */
  getOnDisc(ids: readonly string[]): Promise<boolean[]>;

  /**
   * How long each coming season takes to watch, usually estimated - see
   * seasonWatchTime. Keys are `${mediaId}#${seasonNumber}`. Batched; null
   * when there is nothing to go on.
   */
  getSeasonRuntimes(keys: readonly string[]): Promise<(RuntimeRecord | null)[]>;

  /** Whole-series watch time. Batched; null for films and unknown ids. */
  getSeriesRuntimes(ids: readonly string[]): Promise<(RuntimeRecord | null)[]>;

  /**
   * Free-text title search across films and series, best match first.
   * Not batched: there is no N+1 shape here, one query string per request.
   */
  searchMedia(query: string, first: number): Promise<MediaRecord[]>;

  /** One page of everything the given services stream on subscription. */
  listCatalog(query: CatalogQuery): Promise<CatalogPageRecord>;

  /** Upstream path -> absolute URL. Each source has its own CDN conventions. */
  imageUrl(path: string | null, size: ImageSize): string | null;
  /** Video record -> watchable URL. Composed, never stored. */
  videoUrl(video: VideoRecord): string;
  /** Video record -> embeddable player URL, or null if the host has none. */
  videoEmbedUrl(video: VideoRecord): string | null;
}
