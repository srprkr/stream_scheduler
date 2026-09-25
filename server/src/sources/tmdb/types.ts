/** The subset of TMDB's response shapes this adapter actually reads. */

export interface TmdbPage<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

export interface TmdbTvListItem {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
}

export interface TmdbMovieListItem {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
}

/**
 * /search/multi mixes films, series and people in one list, discriminated by
 * `media_type`. Films carry `title`, series carry `name`; people are fetched
 * and then discarded.
 */
export type TmdbMultiItem =
  | (TmdbMovieListItem & { media_type: "movie" })
  | (TmdbTvListItem & { media_type: "tv" })
  | { media_type: "person"; id: number };


export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TmdbSeason {
  season_number: number;
  air_date: string | null;
  name: string;
}

export interface TmdbEpisode {
  episode_number: number;
  air_date: string | null;
  runtime: number | null;
}

export interface TmdbSeasonDetail {
  season_number: number;
  air_date: string | null;
  episodes: TmdbEpisode[];
}


export interface TmdbTvDetail extends TmdbTvListItem {
  number_of_seasons: number | null;
  seasons?: TmdbSeason[];
  videos?: { results: TmdbVideo[] };
}

export interface TmdbReleaseDate {
  /** 1 Premiere, 2 Limited, 3 Theatrical, 4 Digital, 5 Physical, 6 TV. */
  type: number;
  /** ISO timestamp, e.g. "2026-10-16T00:00:00.000Z". */
  release_date: string;
  /** Free text, user-entered. For type 4 it often names the service. */
  note: string;
}

export interface TmdbReleaseDates {
  results: { iso_3166_1: string; release_dates: TmdbReleaseDate[] }[];
}


export interface TmdbMovieDetail extends TmdbMovieListItem {
  runtime: number | null;
  release_dates?: TmdbReleaseDates;
  videos?: { results: TmdbVideo[] };
}