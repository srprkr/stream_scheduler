/** TMDB's user score, as the API sends it. */
export interface Score {
  average: number;
  votes: number;
}

/**
 * Fewer votes than this and the average says little - one fan's 10 - so no
 * score is shown at all.
 */
export const SHOW_SCORE_VOTES = 10;

/**
 * Votes a title needs to count for a minimum-score filter: the floor the
 * server sends TMDB, so search results are held to the same bar as the lists.
 */
export const FILTER_SCORE_VOTES = 50;

/** The score worth showing, or null: "7.8". */
export function scoreText(score: Score | null | undefined): string | null {
  if (!score || score.votes < SHOW_SCORE_VOTES) return null;
  return score.average.toFixed(1);
}

/** "12,345 votes" / "1 vote". */
export function votesText(votes: number): string {
  return `${votes.toLocaleString()} ${votes === 1 ? "vote" : "votes"}`;
}

/** What's On's score and decade filters. Null means any. */
export interface TitleFilters {
  minScore: number | null;
  fromYear: number | null;
  toYear: number | null;
}

/**
 * Whether a title passes the filters - for search results, which come
 * unfiltered; the lists are filtered by the server. A title with no year
 * or too few votes fails a filter on it, as it does upstream.
 */
export function passesFilters(
  item: { score?: Score | null; releaseYear?: number | null },
  { minScore, fromYear, toYear }: TitleFilters,
): boolean {
  if (minScore !== null) {
    const s = item.score;
    if (!s || s.votes < FILTER_SCORE_VOTES || s.average < minScore) return false;
  }
  const year = item.releaseYear ?? null;
  if (fromYear !== null && (year === null || year < fromYear)) return false;
  if (toYear !== null && (year === null || year > toYear)) return false;
  return true;
}
