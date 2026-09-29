import { formatDate } from "./format";

/** The fields of a SeasonSchedule a sentence needs. Dates are YYYY-MM-DD. */
export interface SeasonSchedule {
  seasonNumber: number;
  premieresOn?: string | null;
  fullyOutOn?: string | null;
  /** An estimate from the previous season's run; shown only as a month. */
  expectedFullyOutOn?: string | null;
  isFullDrop?: boolean | null;
}

/**
 * Today's date where the viewer is, as YYYY-MM-DD. en-CA formats dates that
 * way; the browser supplies the timezone. The same calendar question the
 * server answers for daysUntilRelease.
 */
export function localToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The year only when it isn't this year: "Oct 7", but "Mar 2, 2027". */
export function when(iso: string, today: string): string {
  return formatDate(iso, iso.slice(0, 4) !== today.slice(0, 4));
}

/**
 * An estimate, said as loosely as it deserves: "April", or "April 2027" when
 * the year changes. Never a day - that would promise precision it hasn't got.
 */
export function roughly(iso: string, today: string): string {
  const month = new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" }).format(
    new Date(iso),
  );
  return iso.slice(0, 4) === today.slice(0, 4) ? month : `${month} ${iso.slice(0, 4)}`;
}

/**
 * One line on where a series' next season stands - the question a paused
 * subscription waits on. Unknown dates are said to be unknown, never guessed.
 */
export function seasonLine(season: SeasonSchedule, today: string): string {
  const n = `Season ${season.seasonNumber}`;
  const { premieresOn, fullyOutOn, expectedFullyOutOn, isFullDrop } = season;
  // Said when the real finale date isn't known yet.
  const noFinale = expectedFullyOutOn
    ? `finale estimated for ${roughly(expectedFullyOutOn, today)}`
    : "finale date not announced";

  if (!premieresOn) return `${n} announced · no date yet`;

  if (premieresOn > today) {
    if (isFullDrop) return `${n} arrives ${when(premieresOn, today)} · all episodes at once`;
    if (fullyOutOn) {
      return `${n} premieres ${when(premieresOn, today)} · fully out ${when(fullyOutOn, today)}`;
    }
    return `${n} premieres ${when(premieresOn, today)} · ${noFinale}`;
  }

  if (!fullyOutOn) return `${n} airing now · ${noFinale}`;
  if (fullyOutOn > today) return `${n} airing weekly · finale ${when(fullyOutOn, today)}`;
  return `${n} fully out since ${when(fullyOutOn, today)}`;
}

/**
 * When a title can be watched start to finish - what a paused subscription
 * waits for. "now" when there is no new season, or it's fully out; a date
 * when the finale (or a full drop) is dated or estimated; "unknown" while
 * the season has no date, or airs weekly with no finale in sight.
 */
export type Readiness =
  { state: "now" } | { state: "on"; date: string; estimated: boolean } | { state: "unknown" };

export function readiness(season: SeasonSchedule | null | undefined, today: string): Readiness {
  if (!season) return { state: "now" };
  const { premieresOn, fullyOutOn, expectedFullyOutOn, isFullDrop } = season;
  const done = isFullDrop && !fullyOutOn ? premieresOn : fullyOutOn;
  if (done) return done <= today ? { state: "now" } : { state: "on", date: done, estimated: false };
  if (expectedFullyOutOn) return { state: "on", date: expectedFullyOutOn, estimated: true };
  return { state: "unknown" };
}

/**
 * The readiness of several titles together: the latest of them, since the
 * point is to watch them all in one stretch. Unknown if any one is unknown -
 * the date after which nothing more is coming can't be named then - and
 * estimated if the latest date is.
 */
export function readyTogether(each: readonly Readiness[]): Readiness {
  let latest: Readiness = { state: "now" };
  for (const r of each) {
    if (r.state === "unknown") return r;
    if (r.state === "on" && (latest.state !== "on" || r.date > latest.date)) latest = r;
  }
  return latest;
}

/** "Out now", "All out Nov 25", "All out around December", "Dates to come". */
export function readyLine(ready: Readiness, today: string): string {
  if (ready.state === "now") return "Out now";
  if (ready.state === "unknown") return "Dates to come";
  return ready.estimated
    ? `All out around ${roughly(ready.date, today)}`
    : `All out ${when(ready.date, today)}`;
}
