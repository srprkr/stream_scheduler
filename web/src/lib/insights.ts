import { formatDollars } from "./money";
import type { Plan } from "./planner";
import { listTitles } from "./replaces";
import { nextRenewal } from "./renewals";
import { when } from "./seasons";
import type { Subscription } from "./subscriptions";

/**
 * One suggestion on the Insights page: what to do, why, and what it's worth.
 * Every one comes from a rule over numbers the app already has - the plan,
 * the user's services and prices, their library - so each is exact and can
 * show its working. Nothing here guesses.
 */
export interface Insight {
  /** Stable, for React keys and tests: kind + service. */
  id: string;
  kind: "pause" | "switch-to-monthly" | "resubscribe";
  /** The action, said plainly: "Pause Hulu". */
  title: string;
  /** The evidence and the detail: when, for what, and how it's worked out. */
  detail: string;
  /** Money saved by acting, in cents, over the plan's horizon; null if none. */
  savesCents: number | null;
  /** When to act, for dated steps. */
  date: string | null;
}

export interface InsightInput {
  today: string;
  plan: Plan;
  subscriptions: readonly Subscription[];
  /** What the user's own subscription costs a month; null if unknown. */
  monthlyCost: (sub: Subscription) => number | null;
  /** A service's published monthly price for its default plan, if known. */
  publishedMonthly: (slug: string) => number | null;
  nameOf: (key: string) => string;
  /** Wishlist titles (wanted, on disc) each service streams, by slug. */
  wishlistOn: (slug: string) => readonly string[];
}

/**
 * The paths forward, best first: money-saving steps by how much they save,
 * then dated steps (resubscribing for a plan month) soonest first.
 *
 * - Pause: a service the user pays for monthly that the plan doesn't use
 *   this month. Worth its price for every month until its next turn - or
 *   for the whole horizon if it has none. Services kept whatever happens
 *   ("leave out of estimates", like Prime with shipping) and yearly plans
 *   (which can't be paused mid-term) are left alone. If wishlist titles on
 *   disc are what's on it, buying those is the way to let it go.
 * - Switch to monthly: a yearly plan the plan needs for fewer months than
 *   the year costs - the break-even, shown with its sums.
 * - Resubscribe: a service the user doesn't pay for that has a month in the
 *   plan. Not a saving, a step: when, for what, and to cancel after.
 */
export function pathsForward(input: InsightInput): Insight[] {
  const { today, plan, subscriptions, monthlyCost, publishedMonthly, nameOf, wishlistOn } = input;
  const thisMonth = plan.months.find((m) => m.start <= today && today < m.end) ?? plan.months[0];
  const insights: Insight[] = [];

  for (const sub of subscriptions) {
    const name = nameOf(sub.slug);
    const turns = plan.months.filter((m) => m.service === sub.slug);

    if (sub.billing?.cycle === "annual") {
      const yearly = sub.billing.cents;
      const monthly = publishedMonthly(sub.slug);
      if (yearly === null || !monthly || sub.leftOut) continue;
      const needed = turns.length * monthly;
      if (needed >= yearly) continue;
      const renews = nextRenewal(sub.billing, today);
      insights.push({
        id: `switch-to-monthly:${sub.slug}`,
        kind: "switch-to-monthly",
        title: `Switch ${name} to monthly when it renews`,
        detail:
          `Your plan needs ${name} for ${turns.length} ${turns.length === 1 ? "month" : "months"} ` +
          `of the year ahead: ${turns.length} × ${formatDollars(monthly)} = ${formatDollars(needed)}, ` +
          `against ${formatDollars(yearly)} for the year. It renews ${when(renews, today)}.`,
        savesCents: yearly - needed,
        date: renews,
      });
      continue;
    }

    if (sub.leftOut || thisMonth?.service === sub.slug) continue;
    const price = monthlyCost(sub);
    if (!price) continue;
    const next = turns.find((m) => m.start > today);
    const idle = next
      ? plan.months.indexOf(next) - plan.months.indexOf(thisMonth as (typeof plan.months)[number])
      : Math.max(plan.months.length, 3);
    const wishlist = wishlistOn(sub.slug);
    const why = next
      ? `Nothing in your plan needs it until ${when(next.start, today)}, for ${listTitles(next.watched.map((w) => w.title))}.`
      : `Nothing on your watchlist needs it.`;
    const buy =
      wishlist.length > 0
        ? ` What's left on it from your wishlist - ${listTitles(wishlist)} - is on disc: buy ${
            wishlist.length === 1 ? "it" : "those"
          } rather than keep paying.`
        : "";
    insights.push({
      id: `pause:${sub.slug}`,
      kind: "pause",
      title: `Pause ${name}`,
      detail: `${why}${buy} ${formatDollars(price)} a month × ${idle} ${idle === 1 ? "month" : "months"}.`,
      savesCents: price * idle,
      date: null,
    });
  }

  // Services the plan uses that the user doesn't pay for: when to sign up.
  const paying = new Set(subscriptions.map((s) => s.slug));
  const seen = new Set<string>();
  for (const m of plan.months) {
    if (!m.service || paying.has(m.service) || seen.has(m.service)) continue;
    if (m.service.startsWith("other:")) continue;
    seen.add(m.service);
    const name = nameOf(m.service);
    insights.push({
      id: `resubscribe:${m.service}`,
      kind: "resubscribe",
      title: `Subscribe to ${name} on ${when(m.start, today)}`,
      detail: `For ${listTitles(m.watched.map((w) => w.title))}, then cancel before it renews - your plan gives it one month.`,
      savesCents: null,
      date: m.start,
    });
  }

  return insights.sort(
    (a, b) =>
      (b.savesCents ?? -1) - (a.savesCents ?? -1) ||
      (a.date ?? "9999").localeCompare(b.date ?? "9999"),
  );
}
