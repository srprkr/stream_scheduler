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
 */
export function cumulativeCosts(
  plan: Plan,
  priceOf: (key: string) => number | null,
  payingNow: number,
  alwaysOn = 0,
): { points: CostPoint[]; unpriced: number } {
  const points: CostPoint[] = [];
  let keep = 0;
  let planned = 0;
  let unpriced = 0;
  plan.months.forEach((m, i) => {
    points.push({ index: i, date: m.start, keep, plan: planned, service: m.service });
    keep += payingNow + alwaysOn;
    planned += alwaysOn;
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
