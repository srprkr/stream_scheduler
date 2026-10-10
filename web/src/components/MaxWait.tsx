import type { useRotationPlan } from "../hooks/useRotationPlan";
import { MAX_WAIT } from "../hooks/useSettings";
import { formatDollars } from "../lib/money";
import { keepingCost } from "../lib/costChart";
import { planCost } from "../lib/planner";

/**
 * How long the plan may leave something on the watchlist waiting, with what
 * each choice costs, so the trade-off is in plain sight: waiting longer lets
 * more pile up for one month's binge, and pays for fewer months.
 *
 * Three months is the default because release dates are only known that far
 * ahead; past it, the plan is guessing what else will arrive to batch with.
 *
 * Each choice shows what it changes against the current one - "+$11.98",
 * "−$8.99" - not its own total, which would repeat the same figure down the
 * list whenever the choice makes no difference. When none does (nothing on
 * the watchlist is waiting long enough for it to matter), the list drops the
 * figures and says so.
 */
export function MaxWait({ rotation }: { rotation: ReturnType<typeof useRotationPlan> }) {
  const { planFor, priceOf, maxWaitMonths, setMaxWaitMonths, payingNow, billing } = rotation;
  const costs = MAX_WAIT.choices.map((m) => ({ months: m, ...planCost(planFor(m), priceOf) }));
  const current = planCost(rotation.plan, priceOf);
  const span = rotation.plan.months.length;
  const allSame = costs.every((c) => c.cents === current.cents && c.unpriced === current.unpriced);
  const change = (cents: number) =>
    cents === 0 ? "same cost" : `${cents > 0 ? "+" : "−"}${formatDollars(Math.abs(cents))}`;

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
              {c.months} {c.months === 1 ? "month" : "months"}
              {!allSame &&
                c.months !== maxWaitMonths &&
                ` · ${change(c.cents - current.cents)}${c.unpriced > 0 ? "+" : ""}`}
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
              ? `, against ${formatDollars(keepingCost(rotation.plan, billing.monthly, billing.yearly))} keeping what you pay for now.`
              : ".") +
            (allSame
              ? " How long you wait doesn't change that yet: nothing is waiting long enough."
              : "")}
      </p>
    </div>
  );
}
