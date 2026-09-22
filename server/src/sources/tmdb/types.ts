/** The subset of TMDB's response shapes this adapter actually reads. */

export interface TmdbPage<T> {
  page: number;
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

export interface TmdbTvDetail extends TmdbTvListItem {
  number_of_seasons: number | null;
  seasons?: TmdbSeason[];
  videos?: { results: TmdbVideo[] };
}

export interface TmdbMovieDetail extends TmdbMovieListItem {
  runtime: number | null;
  videos?: { results: TmdbVideo[] };
}