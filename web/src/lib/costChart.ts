import type { Plan } from "./planner";

/** One point on the chart: the running totals at the start of a plan month. */
export interface CostPoint {
  /** Months from today; point 0 is today, before anything is paid. */
  index: number;
  /** YYYY-MM-DD: the start of month `index`, or the plan's end for the last. */
  date: string;
  /** Running total, in cents, keeping every current subscription on. */
  keep: number;
  /** Running total, in cents, following the plan. */
  plan: number;
  /** The service the plan pays for in the month starting here, if any. */
  service: string | null;
}

/** A yearly plan's next renewal: the day its whole year's price is charged. */
export interface YearlyRenewal {
  renewsOn: string;
  cents: number;
  /** Kept whatever happens ("always keep"): renews on the plan too. */
  leftOut: boolean;
}

/**
 * The two running totals the Insights chart draws: paying for everything
 * the user subscribes to now, every month, against following the rotation
 * plan. Running totals rather than monthly bills - the plan's months are
 * either nothing or one service's price, which as a line is just a sawtooth;
 * as totals, the widening gap between the lines is the saving.
 *
 * Each month is paid at its start, so the total after month i includes it.
 * A plan month whose service has no known price adds nothing and is counted
 * in `unpriced`.
 *
 * `alwaysOn` is what the services the user keeps whatever happens cost a
 * month - ones marked "always keep (bundled or shared)", like Prime Video bundled
 * with shipping. It goes on both lines every month: it's spent either way,
 * so the gap between the lines doesn't move, but the totals are real.
 *
 * `yearly` are yearly plans, charged in full in the month they renew rather
 * than a twelfth each month - that's when the money goes. Keeping everything
 * pays every renewal; the plan pays only an always-kept one's, since the
 * plan's advice is to turn the others' auto-renew off. A renewal past the
 * plan's end is already paid for, and counts on neither line.
 */
export function cumulativeCosts(
  plan: Plan,
  priceOf: (key: string) => number | null,
  payingNow: number,
  alwaysOn = 0,
  yearly: readonly YearlyRenewal[] = [],
): { points: CostPoint[]; unpriced: number } {
  const points: CostPoint[] = [];
  let keep = 0;
  let planned = 0;
  let unpriced = 0;
  plan.months.forEach((m, i) => {
    points.push({ index: i, date: m.start, keep, plan: planned, service: m.service });
    keep += payingNow + alwaysOn;
    planned += alwaysOn;
    for (const y of yearly) {
      if (y.renewsOn < m.start || y.renewsOn >= m.end) continue;
      keep += y.cents;
      if (y.leftOut) planned += y.cents;
    }
    if (m.service) {
      const price = priceOf(m.service);
      if (price === null) unpriced++;
      else planned += price;
    }
  });
  const last = plan.months.at(-1);
  if (last) {
    points.push({ index: plan.months.length, date: last.end, keep, plan: planned, service: null });
  }
  return { points, unpriced };
}

/**
 * What keeping every current subscription costs over a plan's months, not
 * counting the always-kept ones (they're paid either way): the monthly bills
 * each month, and a yearly plan's whole price if it renews in that time.
 */
export function keepingCost(
  plan: Plan,
  monthly: number,
  yearly: readonly YearlyRenewal[] = [],
): number {
  let cents = 0;
  for (const m of plan.months) {
    cents += monthly;
    for (const y of yearly) {
      if (!y.leftOut && y.renewsOn >= m.start && y.renewsOn < m.end) cents += y.cents;
    }
  }
  return cents;
}

/**
 * What each month costs on each line, from the running totals: the steps
 * between them. One point per month, at its start - the per-month view.
 */
export function monthlyCosts(points: readonly CostPoint[]): CostPoint[] {
  return points.slice(0, -1).map((p, i) => {
    const next = points[i + 1] as CostPoint;
    return { ...p, keep: next.keep - p.keep, plan: next.plan - p.plan };
  });
}

/**
 * A running total as an SVG path of steps, not slopes: each month is paid in
 * one go at its start, so the line jumps there and runs flat until the next
 * payment. A paused month on the plan's line is a flat stretch - which is
 * the saving, and what a straight line between month totals smooths away.
 *
 * Point i holds the totals before month i is paid; the last point, after
 * the last month. So at month i's start the line rises to point i+1's total.
 */
export function stepPath(
  points: readonly CostPoint[],
  key: "keep" | "plan",
  x: (index: number) => number,
  y: (cents: number) => number,
): string {
  const first = points[0];
  if (!first) return "";
  let d = `M${x(first.index)},${y(first[key])}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as CostPoint;
    d += ` V${y(p[key])} H${x(p.index)}`;
  }
  return d;
}

/**
 * Round axis steps from zero past `max`: 0, $20, $40, $60 rather than 0,
 * $17.33, $34.66. About `count` ticks, on 1, 2 or 5 times a power of ten.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) as number;
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += step) ticks.push(t);
  return ticks;
}
