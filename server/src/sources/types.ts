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
}

export interface ReleaseRecord {
  /** ISO-8601 calendar date, YYYY-MM-DD. */
  availableFrom: string;
  id: string;
  mediaId: string;
  providerSlug: string;
  /** Which season is arriving. Null for movies. */
  seasonNumber: number | null;
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

  /** Upstream path -> absolute URL. Each source has its own CDN conventions. */
  imageUrl(path: string | null, size: ImageSize): string | null;
  /** Video record -> watchable URL. Composed, never stored. */
  videoUrl(video: VideoRecord): string;
}
