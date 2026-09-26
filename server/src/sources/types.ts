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

/** Requested image dimension, mirroring the GraphQL ImageSize enum. */
export type ImageSize = "SMALL" | "MEDIUM" | "LARGE" | "ORIGINAL";

export interface ProviderRecord {
  id: string;
  slug: string;
  name: string;
  /** Upstream-relative path. Turned into a URL by the source, not stored as one. */
  logoPath: string | null;
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
   * Slugs of the configured services streaming each title on subscription
   * today. Batched; an empty list for a title on none of them or unknown.
   */
  getAvailability(ids: readonly string[]): Promise<string[][]>;


  /** Whole-series watch time. Batched; null for films and unknown ids. */
  getSeriesRuntimes(ids: readonly string[]): Promise<(RuntimeRecord | null)[]>;

  /**
   * Free-text title search across films and series, best match first.
   * Not batched: there is no N+1 shape here, one query string per request.
   */
  searchMedia(query: string, first: number): Promise<MediaRecord[]>;


  /** Upstream path -> absolute URL. Each source has its own CDN conventions. */
  imageUrl(path: string | null, size: ImageSize): string | null;
  /** Video record -> watchable URL. Composed, never stored. */
  videoUrl(video: VideoRecord): string;
  /** Video record -> embeddable player URL, or null if the host has none. */
  videoEmbedUrl(video: VideoRecord): string | null;

}
