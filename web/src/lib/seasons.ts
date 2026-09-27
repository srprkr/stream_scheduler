import { formatDate } from "./format";

/** The fields of a SeasonSchedule a sentence needs. Dates are YYYY-MM-DD. */
export interface SeasonSchedule {
  seasonNumber: number;
  premieresOn?: string | null;
  fullyOutOn?: string | null;
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
function when(iso: string, today: string): string {
  return formatDate(iso, iso.slice(0, 4) !== today.slice(0, 4));
}

/**
 * One line on where a series' next season stands - the question a paused
 * subscription waits on. Unknown dates are said to be unknown, never guessed.
 */
export function seasonLine(season: SeasonSchedule, today: string): string {
  const n = `Season ${season.seasonNumber}`;
  const { premieresOn, fullyOutOn, isFullDrop } = season;

  if (!premieresOn) return `${n} announced · no date yet`;

  if (premieresOn > today) {
    if (isFullDrop) return `${n} arrives ${when(premieresOn, today)} · all episodes at once`;
    if (fullyOutOn) {
      return `${n} premieres ${when(premieresOn, today)} · fully out ${when(fullyOutOn, today)}`;
    }
    return `${n} premieres ${when(premieresOn, today)} · finale date not announced`;
  }

  if (!fullyOutOn) return `${n} airing now · finale date not announced`;
  if (fullyOutOn > today) return `${n} airing weekly · finale ${when(fullyOutOn, today)}`;
  return `${n} fully out since ${when(fullyOutOn, today)}`;
}
