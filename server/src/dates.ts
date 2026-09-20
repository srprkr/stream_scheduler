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