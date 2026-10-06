/**
 * Traffic-light levels for the Insights figures. The thresholds are one
 * object: LEVELS holds the defaults, and the Settings page saves the user's
 * own (useLevels). "Approaching" a mark means past `approaching` of the way
 * to it - halfway by default.
 */
export type Level = "good" | "warn" | "bad" | null;

export interface Levels {
  spendHighCents: number;
  ownedGoodMonths: number;
  ownedGoodTitles: number;
  approaching: number;
}

/** The defaults; the user's own come from useLevels (Settings page). */
export const LEVELS: Levels = {
  /** Monthly spend: anything at all is worth watching; past this is a lot. */
  spendHighCents: 2000,
  /** Owned viewing: this many months of it is a healthy library. */
  ownedGoodMonths: 3,
  /** Owned titles: more than this is a healthy library. */
  ownedGoodTitles: 15,
  /** Where "approaching" starts, as a share of the mark. */
  approaching: 0.5,
};

/** Spend: red past the high mark, orange for anything above nothing. */
export function spendLevel(cents: number, levels = LEVELS): Level {
  if (cents > levels.spendHighCents) return "bad";
  if (cents > 0) return "warn";
  return null;
}

/**
 * Hours still coming on the watchlist, against a month of the user's
 * viewing: green while it's under half a month, orange past half, red once
 * it's a month or more - more arriving than a month of watching gets through.
 */
export function comingLevel(minutes: number, minutesPerMonth: number, levels = LEVELS): Level {
  if (minutes <= 0 || minutesPerMonth <= 0) return null;
  const share = minutes / minutesPerMonth;
  if (share >= 1) return "bad";
  if (share >= levels.approaching) return "warn";
  return "good";
}

/** Higher is better: green at the mark, orange past halfway to it. */
export function towardsLevel(value: number, mark: number, levels = LEVELS): Level {
  if (value >= mark) return "good";
  if (value >= mark * levels.approaching) return "warn";
  return null;
}

/** Owned viewing, in months of the user's pace. */
export function ownedHoursLevel(minutes: number, minutesPerMonth: number, levels = LEVELS): Level {
  if (minutesPerMonth <= 0) return null;
  return towardsLevel(minutes / minutesPerMonth, levels.ownedGoodMonths, levels);
}

/** Owned titles: green past the mark ("more than 15"), orange approaching. */
export function ownedTitlesLevel(count: number, levels = LEVELS): Level {
  if (count > levels.ownedGoodTitles) return "good";
  if (count >= levels.ownedGoodTitles * levels.approaching) return "warn";
  return null;
}
