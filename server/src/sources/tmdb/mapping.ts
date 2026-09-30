import type { MediaRecord, ReleaseRecord, VideoRecord } from "../types.js";
import { type SeasonAnalysis } from "./seasons.js";
import type {
  TmdbMovieDetail,
  TmdbMovieListItem,
  TmdbTvDetail,
  TmdbTvListItem,
  TmdbVideo,
} from "./types.js";

/** TMDB records mapped onto the source-neutral records in ../types.ts. */

/**
 * One season as a release. Shared by the feed and getRelease so the two
 * cannot disagree about what an unscheduled season looks like.
 */
export function seasonRelease(
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
export function movieRelease(
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
 * A film as a MediaRecord. Takes the list shape so search results and full
 * details share one mapping; detail-only fields are optional and come back
 * null when the caller only had a list item.
 */
export function movieRecord(
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
export function seriesRecord(
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
