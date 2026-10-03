import type { Readiness } from "./seasons";
import {
  titleReadiness,
  watchlistByService,
  stillToCome,
  type ServiceLoad,
  type WatchlistTitle,
} from "./watchlist";

/** The watchlist titles that become watchable start to finish in one month. */
export interface MonthHours {
  /** YYYY-MM. */
  month: string;
  /** Summed watch time of the titles that have one. */
  minutes: number;
  /** True if a date or a runtime behind the figure is an estimate. */
  estimated: boolean;
  /** Alphabetical. */
  titles: string[];
  /** Titles counted here but without a runtime, so missing from the hours. */
  untimed: number;
}

export interface ComingSoonStats {
  /** Soonest first; only months with something in them. */
  months: MonthHours[];
  /** Coming titles with no date yet, alphabetical. */
  undated: string[];
  /** The coming titles by service, with each service's coming hours. */
  services: ServiceLoad[];
}

/**
 * Coming Soon's numbers, from the watchlist only - never the whole catalogue
 * arriving on a service. Each title counts in the month it can be watched
 * start to finish: a film's arrival, a full drop's day, a weekly season's
 * finale. That's the month a paused subscription is waiting for.
 *
 * Hours are what's still to come (a series' coming season, not its back
 * catalogue), and usually estimated for seasons that haven't aired.
 */
export function comingSoonStats(
  titles: readonly WatchlistTitle[],
  subscribed: ReadonlySet<string>,
  today: string,
): ComingSoonStats {
  const coming = titles.filter((t) => stillToCome(t, today));
  const byMonth = new Map<string, MonthHours>();
  const undated: string[] = [];

  for (const t of coming) {
    const ready = titleReadiness(t, today);
    if (ready.state !== "on") {
      // "now" can't happen for a coming title; "unknown" has no month.
      undated.push(t.title);
      continue;
    }
    const month = ready.date.slice(0, 7);
    const load = byMonth.get(month) ?? {
      month,
      minutes: 0,
      estimated: false,
      titles: [],
      untimed: 0,
    };
    load.titles.push(t.title);
    load.estimated ||= ready.estimated;
    if (t.comingRuntime) {
      load.minutes += t.comingRuntime.minutes;
      load.estimated ||= t.comingRuntime.estimated;
    } else {
      load.untimed++;
    }
    byMonth.set(month, load);
  }

  const byTitle = (a: string, b: string) => a.localeCompare(b);
  const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const m of months) m.titles.sort(byTitle);

  // The per-service view counts the coming hours too, not the back catalogue.
  const { services } = watchlistByService(
    coming.map((t) => ({ ...t, runtime: t.comingRuntime ?? null })),
    subscribed,
    today,
  );
  return { months, undated: undated.sort(byTitle), services };
}

/** "2026-11" -> "November", or "November 2027" outside this year. */
export function monthName(month: string, today: string): string {
  const name = new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" }).format(
    new Date(`${month}-01`),
  );
  return month.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${month.slice(0, 4)}`;
}
