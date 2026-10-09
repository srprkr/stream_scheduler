import type { Plan } from "./planner";
import { addDays } from "./renewals";

/** How far ahead the disc plan looks: far enough to buy ahead, near enough to trust. */
export const DISC_PLAN_MONTHS = 6;

/** Planning months are the rotation plan's: 30 days from today. */
const MONTH_DAYS = 30;

/** A wishlisted title as the disc plan needs it. */
export interface WantedTitle {
  id: string;
  title: string;
  kind: "Movie" | "Series";
  /** Whole watch time; null when TMDB has none, which fills no hours. */
  minutes: number | null;
}

/** A month in the window, and how much of the user's viewing it leaves unfilled. */
export interface Gap {
  start: string;
  /** What the rotation plan streams this month. */
  streamed: number;
  /** The rest of the month's viewing, for discs to fill. */
  minutes: number;
  /** Nothing streamed at all: a pause month. */
  paused: boolean;
}

/** One purchase: buy it before `by`, when the first gap it fills starts. */
export interface Pick {
  id: string;
  title: string;
  kind: WantedTitle["kind"];
  minutes: number;
  by: string;
  /** The gaps it fills some or all of, by start date. */
  fills: string[];
}

export interface DiscPlan {
  gaps: Gap[];
  /** Every gap's minutes, summed. */
  gapMinutes: number;
  /** Purchases in buying order; only those that fill something. */
  picks: Pick[];
  /** Wishlisted titles with no runtime: left out of the sums. */
  unknown: string[];
  /** The gap minutes the whole wishlist can't fill. */
  shortMinutes: number;
}

/**
 * Which wishlisted discs to buy, and by when, so the months the rotation
 * plan streams little or nothing still have a month's viewing. Each of the
 * next DISC_PLAN_MONTHS months has a gap: the user's hours a month, less
 * what the plan streams then - all of it in a pause month.
 *
 * Series go first, then the longest films: a box set fills the most
 * months per purchase. Each purchase fills the gaps in date order, so it's
 * needed by the first one it reaches. The library the user already owns is
 * a separate figure (DiscPlan): this is the plan for something new.
 */
export function planDiscs({
  plan,
  today,
  minutesPerMonth,
  wanted,
}: {
  plan: Plan;
  today: string;
  minutesPerMonth: number;
  wanted: readonly WantedTitle[];
}): DiscPlan {
  const gaps: Gap[] = Array.from({ length: DISC_PLAN_MONTHS }, (_, i) => {
    const start = addDays(today, i * MONTH_DAYS);
    const month = plan.months.find((m) => m.start === start);
    const streamed = month?.service ? month.minutes : 0;
    return {
      start,
      streamed,
      minutes: Math.max(0, minutesPerMonth - streamed),
      paused: !month?.service,
    };
  }).filter((g) => g.minutes > 0);
  const gapMinutes = gaps.reduce((n, g) => n + g.minutes, 0);

  const known = wanted.filter((w): w is WantedTitle & { minutes: number } => w.minutes !== null);
  const order = [...known].sort(
    (a, b) =>
      Number(b.kind === "Series") - Number(a.kind === "Series") ||
      b.minutes - a.minutes ||
      a.title.localeCompare(b.title),
  );

  // Pour each purchase into the gaps in date order.
  const left = gaps.map((g) => g.minutes);
  const picks: Pick[] = [];
  let g = 0;
  for (const w of order) {
    if (g >= gaps.length) break;
    let pour = w.minutes;
    const fills: string[] = [];
    while (pour > 0 && g < gaps.length) {
      const take = Math.min(pour, left[g] as number);
      left[g] = (left[g] as number) - take;
      pour -= take;
      fills.push((gaps[g] as Gap).start);
      if ((left[g] as number) === 0) g++;
    }
    picks.push({
      id: w.id,
      title: w.title,
      kind: w.kind,
      minutes: w.minutes,
      by: fills[0] as string,
      fills,
    });
  }

  return {
    gaps,
    gapMinutes,
    picks,
    unknown: wanted.filter((w) => w.minutes === null).map((w) => w.title),
    shortMinutes: left.reduce((n, m) => n + m, 0),
  };
}

/**
 * What following the plan saves over the disc plan's window, against
 * keeping every current subscription: the budget for discs that still comes
 * out ahead. Each month the plan pays for at most one service, or nothing;
 * months past the plan's end pause everything. A plan month with no known
 * price is left out of the saving and counted in `unpriced`. Services kept
 * whatever happens cost the same either way, so they don't enter into it.
 */
export function windowSaving(
  plan: Plan,
  today: string,
  priceOf: (key: string) => number | null,
  payingNow: number,
): { cents: number; unpriced: number } {
  let cents = 0;
  let unpriced = 0;
  for (let i = 0; i < DISC_PLAN_MONTHS; i++) {
    const start = addDays(today, i * MONTH_DAYS);
    const service = plan.months.find((m) => m.start === start)?.service ?? null;
    const price = service ? priceOf(service) : 0;
    if (price === null) {
      unpriced++;
      continue;
    }
    cents += payingNow - price;
  }
  return { cents, unpriced };
}
