import { addDays } from "./renewals";

/** A watchlist title as the planner needs it, on one service. */
export interface PlanTitle {
  id: string;
  title: string;
  /** Watch time still to come; null when unknown, which fills no hours. */
  minutes: number | null;
  /** First episode, for a season that airs over time; null otherwise. */
  startsOn: string | null;
  /** When it's watchable start to finish here; null while undated. */
  readyOn: string | null;
}

export interface PlanService {
  /** A tracked service's slug, or an untracked one's id. */
  key: string;
  titles: PlanTitle[];
}

export interface PlanMonth {
  /** The month runs from `start` up to, not including, `end`. */
  start: string;
  end: string;
  /** The one service paid for this month; null when nothing is worth it. */
  service: string | null;
  /** Why this service: it had the most ready, or a title had waited too long. */
  reason: "most" | "waited" | null;
  watched: { id: string; title: string; minutes: number | null }[];
  minutes: number;
}

export interface Plan {
  months: PlanMonth[];
  /**
   * Titles the plan doesn't finish: undated ones, ones past the horizon,
   * and the unwatched tail of a series whose service has no further turn.
   */
  unplaced: { key: string; title: string; minutes: number | null }[];
}

/** Planning months are 30 days from today, not calendar months. */
const MONTH_DAYS = 30;

/**
 * One service a month: the user's watch time goes to a single service they
 * binge, while every other service stays paused and its titles pile up for
 * a later turn. Physical media is the point of the app, so a backlog
 * waiting on a paused service is fine - paying for two at once is not.
 *
 * Each month, a service is worth paying for when it has a month's viewing
 * ready (titles completely out, at the user's hours a month), or when
 * something on it has waited `maxWaitDays` since it came out. Of those, a
 * title that has waited too long goes first, then whichever service has
 * the most hours ready. A service with a season still airing is held back
 * until its finale - paying mid-season means paying again for the rest -
 * unless waiting has already run out.
 *
 * The month's hours are spent on that service's titles, oldest first; what
 * doesn't fit carries over to its next turn. That leftover alone never
 * buys a month - only a full month's worth or an unstarted title's wait
 * does - so a short tail waits for the service's next real turn. A title
 * on two services is watched once, on whichever comes up first.
 */
export function planRotation(
  services: readonly PlanService[],
  {
    today,
    minutesPerMonth,
    maxWaitDays,
    horizonMonths = 12,
  }: { today: string; minutesPerMonth: number; maxWaitDays: number; horizonMonths?: number },
): Plan {
  // What's left of each title, shared across services: null = unknown length.
  const left = new Map<string, number | null>();
  for (const s of services) for (const t of s.titles) left.set(t.id, t.minutes);
  const done = new Set<string>();
  const started = new Set<string>();
  const months: PlanMonth[] = [];

  for (let i = 0; i < horizonMonths; i++) {
    const start = addDays(today, i * MONTH_DAYS);
    const end = addDays(start, MONTH_DAYS);

    const options = services.flatMap((s) => {
      const pending = s.titles.filter((t) => !done.has(t.id));
      const ready = pending
        .filter((t) => t.readyOn !== null && t.readyOn <= start)
        .sort((a, b) => (a.readyOn as string).localeCompare(b.readyOn as string));
      if (ready.length === 0) return [];
      const hours = ready.reduce((n, t) => n + (left.get(t.id) ?? 0), 0);
      // Waiting starts when a title comes out, or today for one out already.
      // Only titles not yet started count: the tail of a half-watched series
      // rides along with its service's next turn rather than buying a month
      // on its own.
      const oldest = ready.find((t) => !started.has(t.id));
      const since =
        oldest && (oldest.readyOn as string) > today ? (oldest.readyOn as string) : today;
      const waited = oldest ? daysBetween(since, start) : 0;
      const due = oldest !== undefined && waited >= maxWaitDays;
      const airing = pending.some(
        (t) => t.startsOn !== null && t.startsOn <= start && (t.readyOn ?? "9999") > start,
      );
      const worth = hours >= minutesPerMonth || due;
      return worth && (!airing || due) ? [{ s, ready, hours, waited, due }] : [];
    });

    options.sort(
      (a, b) =>
        Number(b.due) - Number(a.due) ||
        (a.due ? b.waited - a.waited : 0) ||
        b.hours - a.hours ||
        a.s.key.localeCompare(b.s.key),
    );
    const pick = options[0];
    if (!pick) {
      months.push({ start, end, service: null, reason: null, watched: [], minutes: 0 });
    } else {
      let budget = minutesPerMonth;
      const watched: PlanMonth["watched"] = [];
      for (const t of pick.ready) {
        if (budget <= 0) break;
        const rest = left.get(t.id) ?? null;
        if (rest === null) {
          // Unknown length: watched in full, filling nothing we can count.
          watched.push({ id: t.id, title: t.title, minutes: null });
          done.add(t.id);
          continue;
        }
        const take = Math.min(rest, budget);
        budget -= take;
        started.add(t.id);
        watched.push({ id: t.id, title: t.title, minutes: take });
        left.set(t.id, rest - take);
        if (rest - take <= 0) done.add(t.id);
      }
      months.push({
        start,
        end,
        service: pick.s.key,
        reason: pick.due ? "waited" : "most",
        watched,
        minutes: minutesPerMonth - budget,
      });
    }

    // Stop once nothing dated is left to watch.
    const remaining = services.some((s) =>
      s.titles.some((t) => !done.has(t.id) && t.readyOn !== null),
    );
    if (!remaining) break;
  }

  // Trailing empty months say nothing; drop them.
  while (months.length > 0 && (months.at(-1) as PlanMonth).service === null) months.pop();

  const unplaced: Plan["unplaced"] = [];
  const seen = new Set<string>();
  for (const s of services) {
    for (const t of s.titles) {
      if (done.has(t.id) || seen.has(t.id)) continue;
      seen.add(t.id);
      unplaced.push({ key: s.key, title: t.title, minutes: left.get(t.id) ?? null });
    }
  }
  return { months, unplaced };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** What a plan costs, from each paid month's price. */
export function planCost(
  plan: Plan,
  priceOf: (key: string) => number | null,
): { cents: number; unpriced: number; paidMonths: number } {
  let cents = 0;
  let unpriced = 0;
  let paidMonths = 0;
  for (const m of plan.months) {
    if (!m.service) continue;
    paidMonths++;
    const price = priceOf(m.service);
    if (price === null) unpriced++;
    else cents += price;
  }
  return { cents, unpriced, paidMonths };
}

/** The plan month a date falls in, if the plan reaches it. */
export function monthOn(plan: Plan, date: string): PlanMonth | undefined {
  return plan.months.find((m) => m.start <= date && date < m.end);
}
