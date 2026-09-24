const MS_PER_DAY = 86_400_000;

/**
 * The calendar date it currently is in `timezone`, as YYYY-MM-DD.
 * The en-CA locale formats dates as YYYY-MM-DD. Throws RangeError for an
 * unknown timezone.
 */

export function todayIn(timezone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Whole calendar days from "today in `timezone`" to `availableFrom`.
 *
 * Both sides are calendar dates parsed as UTC midnight, so their difference
 * is always an exact multiple of a day. Elapsed time never enters into it,
 * which is what keeps DST's 23- and 25-hour days out of the answer.
 */

export function daysUntil(
  availableFrom: string,
  timezone: string,
  now: Date,
): number {
  const today = Date.parse(todayIn(timezone, now));
  return (Date.parse(availableFrom) - today) / MS_PER_DAY
}

/**
 * A Date's calendar date in UTC, as YYYY-MM-DD. For server-side windows
 * ("the next 90 days") where no caller's timezone is involved. Anything a
 * user sees as "today" goes through todayIn instead.
 */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `days` calendar days after `base`, in UTC. Never mutates `base`. */
export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
