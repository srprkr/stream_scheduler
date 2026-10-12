import type { MediaKind } from "./sources/types.js";

/** The app's genres: one list for films and series alike. */
export type Genre =
  | "ACTION"
  | "ANIMATION"
  | "COMEDY"
  | "CRIME"
  | "DOCUMENTARY"
  | "DRAMA"
  | "FAMILY"
  | "HORROR"
  | "MUSIC"
  | "MYSTERY"
  | "REALITY"
  | "ROMANCE"
  | "SCIFI"
  | "WAR"
  | "WESTERN";

/**
 * Each genre as TMDB's ids, which differ between films and TV: TV folds
 * "Action" and "Adventure" into one, and "Science Fiction" and "Fantasy" into
 * another, while films split them. So one app genre can be several ids, and
 * none for a kind TMDB doesn't tag that way - there's no TV "Horror". Ids
 * checked against /genre/movie/list and /genre/tv/list, 2026-10-11.
 */
export const GENRE_IDS: Record<Genre, { MOVIE: number[]; SERIES: number[] }> = {
  ACTION: { MOVIE: [28, 12], SERIES: [10759] },
  ANIMATION: { MOVIE: [16], SERIES: [16] },
  COMEDY: { MOVIE: [35], SERIES: [35] },
  CRIME: { MOVIE: [80], SERIES: [80] },
  DOCUMENTARY: { MOVIE: [99], SERIES: [99] },
  DRAMA: { MOVIE: [18], SERIES: [18] },
  FAMILY: { MOVIE: [10751], SERIES: [10751, 10762] },
  HORROR: { MOVIE: [27], SERIES: [] },
  MUSIC: { MOVIE: [10402], SERIES: [] },
  MYSTERY: { MOVIE: [9648, 53], SERIES: [9648] },
  REALITY: { MOVIE: [], SERIES: [10764] },
  ROMANCE: { MOVIE: [10749], SERIES: [] },
  SCIFI: { MOVIE: [878, 14], SERIES: [10765] },
  WAR: { MOVIE: [10752, 36], SERIES: [10768] },
  WESTERN: { MOVIE: [37], SERIES: [37] },
};

/** A genre's TMDB ids for one kind; empty when TMDB has no such genre for it. */
export function genreIds(kind: MediaKind, genre: Genre): number[] {
  return GENRE_IDS[genre][kind];
}

/** The app genres a title's TMDB genre ids add up to. */
export function genresOf(kind: MediaKind, ids: readonly number[]): Genre[] {
  return (Object.keys(GENRE_IDS) as Genre[]).filter((g) =>
    GENRE_IDS[g][kind].some((id) => ids.includes(id)),
  );
}
