import type { useRotationPlan } from "../hooks/useRotationPlan";
import { formatDollars } from "../lib/money";
import { planCost } from "../lib/planner";

const CHOICES = [1, 2, 3, 4, 6] as const;

/**
 * How long the plan may leave something on the watchlist waiting, with what
 * each choice costs, so the trade-off is in plain sight: waiting longer lets
 * more pile up for one month's binge, and pays for fewer months.
 *
 * Three months is the default because release dates are only known that far
 * ahead; past it, the plan is guessing what else will arrive to batch with.
 */
export function MaxWait({ rotation }: { rotation: ReturnType<typeof useRotationPlan> }) {
  const { planFor, priceOf, maxWaitMonths, setMaxWaitMonths, payingNow } = rotation;
  const costs = CHOICES.map((m) => ({ months: m, ...planCost(planFor(m), priceOf) }));
  const current = planCost(rotation.plan, priceOf);
  const span = rotation.plan.months.length;

  return (
    <div className="max-wait">
      <label>
        Wait at most
        <select
          value={maxWaitMonths}
          onChange={(e) => setMaxWaitMonths(Number(e.target.value))}
          aria-describedby="max-wait-impact"
        >
          {costs.map((c) => (
            <option key={c.months} value={c.months}>
              {c.months} {c.months === 1 ? "month" : "months"} · {formatDollars(c.cents)}
              {c.unpriced > 0 ? "+" : ""}
            </option>
          ))}
        </select>
        for a title that's out
      </label>
      <p id="max-wait-impact" className="max-wait__impact">
        {span === 0
          ? "Nothing on your watchlist needs a month yet."
          : `The plan: ${formatDollars(current.cents)} for ${current.paidMonths} paid ${
              current.paidMonths === 1 ? "month" : "months"
            } over the next ${span}` +
            (payingNow > 0
              ? `, against ${formatDollars(payingNow * span)} keeping what you pay for now.`
              : ".")}
      </p>
    </div>
  );
}
