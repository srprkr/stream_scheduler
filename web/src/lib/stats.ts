export interface Runtime {
  minutes: number;
  estimated: boolean;
}

export interface LibraryStats {
  /** Summed watch time of every title with a known runtime. */
  minutes: number;
  /** True if any counted title's runtime was estimated. */
  estimated: boolean;
  /** Titles left out because upstream has no runtime for them. */
  missing: number;
  /** How long the library lasts, watching everything once. */
  months: number;
}

/**
 * The two numbers the library page leads with. Titles without a runtime are
 * counted and reported, not guessed: a total that silently skips them would
 * overstate nothing but understate the library, and the user should know.
 */
export function libraryStats(
  runtimes: readonly (Runtime | null | undefined)[],
  hoursPerMonth: number,
): LibraryStats {
  let minutes = 0;
  let estimated = false;
  let missing = 0;
  for (const runtime of runtimes) {
    if (!runtime) {
      missing++;
      continue;
    }
    minutes += runtime.minutes;
    estimated ||= runtime.estimated;
  }
  const months = hoursPerMonth > 0 ? minutes / 60 / hoursPerMonth : 0;
  return { minutes, estimated, missing, months };
}

/** 4601 -> "76 h 41 m". */
export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} m` : `${h.toLocaleString()} h ${m} m`;
}

/** Precise when small, rounded when large, with years once it runs long. */
export function formatMonths(months: number): string {
  if (months < 1) return "less than a month";
  if (months < 10) return `${months.toFixed(1)} months`;
  const rounded = Math.round(months);
  return rounded >= 24
    ? `${rounded} months (about ${(months / 12).toFixed(1)} years)`
    : `${rounded} months`;
}
