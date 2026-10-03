import { readiness, readyTogether, type Readiness, type SeasonSchedule } from "./seasons";
import type { Runtime } from "./stats";

/** A watchlisted title and the services that stream it today. */
export interface WatchlistTitle {
  id: string;
  title: string;
  /** Null when upstream has no runtime for it. */
  runtime: Runtime | null;
  /**
   * What's still to come, for planning: a series' coming season (usually
   * estimated), or a film's runtime. Null when unknown.
   */
  comingRuntime?: Runtime | null;
  /** Tracked services. */
  availableOn: readonly { slug: string }[];
  /** Services the app doesn't track, which the user can't mark as theirs. */
  otherServices?: readonly { id: string }[];
  /** Series only: the season still to come or still airing, if any. */
  nextSeason?: SeasonSchedule | null;
  /**
   * Tracked services it's still to arrive on: a film's streaming premiere,
   * or a new series before it premieres. Often its only services so far.
   */
  upcoming?: readonly { slug: string; availableFrom: string; bingeableFrom?: string | null }[];
  /**
   * Series only: the tracked services its network makes it for - where a
   * season will land even before it has a date.
   */
  madeFor?: readonly { slug: string }[];
}

/** One title under a service, with when it can be watched through. */
export interface ServiceTitle {
  id: string;
  title: string;
  nextSeason: SeasonSchedule | null;
  /** A film's arrival on this service, when it isn't there yet. */
  arrivesOn: string | null;
  ready: Readiness;
}

/** What one service would be paid for: the watchlist titles it streams. */
export interface ServiceLoad {
  /** A tracked service's slug, or an untracked one's id. */
  key: string;
  tracked: boolean;
  /** Soonest watchable first; alphabetical among equals. */
  titles: ServiceTitle[];
  /** When everything here is out: the day unpausing covers it all. */
  ready: Readiness;
  /** Summed runtime of the titles that have one. */
  minutes: number;
  /** True if any counted runtime was estimated. */
  estimated: boolean;
  subscribed: boolean;
}

export interface WatchlistSummary {
  /** Services the user pays for first, then the busiest services first. */
  services: ServiceLoad[];
  /** Titles on no service and not announced for one, alphabetical. */
  unhosted: string[];
}

/**
 * The watchlist rolled up by service: what each one streams, when each title
 * can be watched through, and when all of them can - the date unpausing that
 * service covers everything on it. A title on two services counts toward
 * both - either would do - so the per-service hours don't add up to the
 * watchlist's total, and aren't meant to.
 *
 * Services already paid for lead, since what's on them costs nothing extra;
 * the rest are ordered by how many titles they'd unlock. Untracked services
 * are listed too - the user should know a title is on Crunchyroll - but the
 * app can't know whether they pay for one, so they're never "subscribed".
 */
export function watchlistByService(
  titles: readonly WatchlistTitle[],
  subscribed: ReadonlySet<string>,
  today: string,
): WatchlistSummary {
  const byKey = new Map<string, ServiceLoad>();
  const unhosted: string[] = [];

  for (const title of titles) {
    const { runtime, availableOn, otherServices = [], upcoming = [] } = title;
    const nextSeason = title.nextSeason ?? null;
    const base = { id: title.id, title: title.title, nextSeason };
    // A series' readiness is its next season, on any of its services. A film
    // arriving somewhere is ready there on its arrival date.
    const here = { ...base, arrivesOn: null, ready: readiness(nextSeason, today) };
    const arriving = (slug: string) => {
      const arrival = upcoming.find((u) => u.slug === slug);
      if (!arrival || nextSeason) return here;
      const date = arrival.bingeableFrom ?? arrival.availableFrom;
      return { ...base, arrivesOn: date, ready: { state: "on", date, estimated: false } as const };
    };
    const onNow = new Set(availableOn.map((a) => a.slug));
    const services = [
      ...availableOn.map(({ slug }) => ({ key: slug, tracked: true, entry: here })),
      ...upcoming
        .filter((u) => !onNow.has(u.slug))
        .map(({ slug }) => ({ key: slug, tracked: true, entry: arriving(slug) })),
      // The network's service, for a series nothing else places yet: its
      // next season's readiness, often undated, under the service it's for.
      ...(title.madeFor ?? []).map(({ slug }) => ({ key: slug, tracked: true, entry: here })),
      ...otherServices.map(({ id }) => ({ key: id, tracked: false, entry: here })),
    ];
    // Several arrivals on one service count once.
    const seen = new Set<string>();
    if (services.length === 0) unhosted.push(title.title);
    for (const { key, tracked, entry } of services) {
      if (seen.has(key)) continue;
      seen.add(key);
      const load = byKey.get(key) ?? {
        key,
        tracked,
        titles: [],
        ready: { state: "now" } as Readiness,
        minutes: 0,
        estimated: false,
        subscribed: tracked && subscribed.has(key),
      };
      load.titles.push(entry);
      if (runtime) {
        load.minutes += runtime.minutes;
        load.estimated ||= runtime.estimated;
      }
      byKey.set(key, load);
    }
  }

  const byTitle = (a: string, b: string) => a.localeCompare(b);
  const services = [...byKey.values()];
  for (const load of services) {
    load.titles.sort(
      (a, b) => readyOrder(a.ready) - readyOrder(b.ready) || byTitle(a.title, b.title),
    );
    load.ready = readyTogether(load.titles.map((t) => t.ready));
  }
  services.sort(
    (a, b) =>
      Number(b.subscribed) - Number(a.subscribed) ||
      b.titles.length - a.titles.length ||
      b.minutes - a.minutes,
  );
  return { services, unhosted: unhosted.sort(byTitle) };
}

/** Sort key: out now, then dated (soonest first), then undated. */
export function readyOrder(ready: Readiness): number {
  if (ready.state === "now") return 0;
  if (ready.state === "unknown") return Infinity;
  return Date.parse(ready.date);
}

/**
 * When a title can be watched through, wherever it streams: its next season
 * for a series, its soonest arrival for a film that isn't on a service yet.
 */
export function titleReadiness(title: WatchlistTitle, today: string): Readiness {
  if (title.nextSeason) return readiness(title.nextSeason, today);
  if (streamsNow(title)) return { state: "now" };
  const arrival = soonestArrival(title);
  return arrival ? { state: "on", date: arrival, estimated: false } : { state: "unknown" };
}

/** A film's first arrival date on any tracked service, if one is coming. */
export function soonestArrival(title: WatchlistTitle): string | null {
  const dates = (title.upcoming ?? []).map((u) => u.bingeableFrom ?? u.availableFrom).sort();
  return dates[0] ?? null;
}

/**
 * Which half of the watchlist page a title belongs in. "now" once it has
 * premiered: a film that has arrived, a season that has started - even one
 * still airing weekly - or a show with nothing more coming. "coming" until
 * then, or while there's no date. (When a title is *completely* out is a
 * separate question - see stillToCome - for the stats and the plan.)
 */
export function watchlistGroup(title: WatchlistTitle, today: string): "now" | "coming" {
  if (title.nextSeason) {
    const premiere = title.nextSeason.premieresOn;
    return premiere && premiere <= today ? "now" : "coming";
  }
  return streamsNow(title) ? "now" : "coming";
}

/**
 * Whether a title has something still to finish: a film not yet arrived, a
 * season not yet premiered or still airing. What the Coming Soon stats count
 * and the plan waits for - a weekly season is all out at its finale, not
 * its premiere.
 */
export function stillToCome(title: WatchlistTitle, today: string): boolean {
  return titleReadiness(title, today).state !== "now";
}

function streamsNow(title: WatchlistTitle): boolean {
  // madeFor doesn't count: it's where a series will be, not where it is.
  return title.availableOn.length > 0 || (title.otherServices ?? []).length > 0;
}
