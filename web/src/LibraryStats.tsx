import { skipToken, useQuery } from "@apollo/client/react";

import { graphql } from "./generated";
import { formatHours, formatMonths, libraryStats } from "./stats";
import { useStoredNumber } from "./useStoredNumber";

/**
 * One request for the whole shelf: mediaItems batches every id through the
 * server's loaders, where one query per title would be one round trip each.
 */
const LIBRARY_RUNTIME = graphql(`
  query LibraryRuntime($ids: [ID!]!) {
    mediaItems(ids: $ids) {
      id
      totalRuntime {
        minutes
        estimated
      }
    }
  }
`);

/** A starting point the user is asked to change, not a claim about them. */
const DEFAULT_HOURS_PER_MONTH = 20;

export function LibraryStats({ ownedIds }: { ownedIds: readonly string[] }) {
  const [hoursPerMonth, setHoursPerMonth] = useStoredNumber(
    "stream-scheduler:hours-per-month",
    DEFAULT_HOURS_PER_MONTH,
  );
  const { data, loading } = useQuery(
    LIBRARY_RUNTIME,
    ownedIds.length > 0 ? { variables: { ids: [...ownedIds] } } : skipToken,
  );

  if (ownedIds.length === 0) return null;
  if (loading && !data) return <p className="stats stats--loading">Adding up your library…</p>;

  const stats = libraryStats(
    (data?.mediaItems ?? []).map((m) => m?.totalRuntime),
    hoursPerMonth,
  );
  const approx = stats.estimated ? "about " : "";

  return (
    <section className="stats" aria-label="Library watch time">
      <p className="stats__total">
        <span className="stats__figure">
          {approx}
          {formatHours(stats.minutes)}
        </span>{" "}
        of content owned
      </p>
      <p className="stats__months">
        At{" "}
        <input
          className="stats__input"
          type="number"
          min={1}
          max={300}
          value={hoursPerMonth}
          aria-label="Hours you watch per month"
          onChange={(e) => {
            const next = Number(e.target.value);
            if (next > 0) setHoursPerMonth(next);
          }}
        />{" "}
        hours a month, that's <strong>{formatMonths(stats.months)}</strong> of
        viewing, watching everything once.
      </p>
      {stats.missing > 0 && (
        <p className="stats__note">
          {stats.missing} {stats.missing === 1 ? "title has" : "titles have"} no
          runtime data yet and {stats.missing === 1 ? "isn't" : "aren't"} counted.
        </p>
      )}
    </section>
  );
}
