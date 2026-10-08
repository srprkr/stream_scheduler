import { scoreText, votesText, type Score } from "../lib/score";

/**
 * A title's TMDB score on a tile: "★ 7.8", with the vote count on hover and
 * read out in full. Nothing at all when too few have voted to trust it.
 */
export function ScoreBadge({ score }: { score: Score | null | undefined }) {
  const text = scoreText(score);
  if (!text || !score) return null;
  const full = `TMDB score ${text} out of 10, from ${votesText(score.votes)}`;
  return (
    <span className="score" title={full} aria-label={full} role="img">
      <span className="score__star" aria-hidden="true">
        ★
      </span>{" "}
      {text}
    </span>
  );
}

/** The same, as a fact in a title's dialog: "★ 7.8 / 10 · 12,345 votes on TMDB". */
export function ScoreFact({ score }: { score: Score | null | undefined }) {
  const text = scoreText(score);
  if (!text || !score) return null;
  return (
    <div>
      <dt>Score</dt>
      <dd>
        <span className="score__star" aria-hidden="true">
          ★
        </span>{" "}
        {text} / 10 · {votesText(score.votes)} on TMDB
      </dd>
    </div>
  );
}
