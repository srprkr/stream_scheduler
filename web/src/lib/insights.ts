import { formatDollars } from "./money";
import type { Plan } from "./planner";
import { listTitles } from "./replaces";
import { upcomingRenewal } from "./renewals";
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
  /**
   * What a checklist tick is tied to: the step and the date it's about - the
   * renewal to cancel before, the plan month to subscribe for. So a step
   * ticked off comes back unticked when it's needed again for a new date.
   */
  key: string;
  kind: "pause" | "switch-to-monthly" | "resubscribe";
  /** The service it's about, so the page can show how to cancel it. */
  service: string;
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
  /** How cancelling works for a service, from the app's checked records. */
  cancellationOf: (slug: string) => CancelTerms | null;
}

/** The parts of a service's cancellation record the advice reads. */
export interface CancelTerms {
  keepsAccessUntilPeriodEnd: boolean;
  cancelHoursBefore?: number | null;
  refunds: string;
}

/** "You keep it until Oct 14, then it stops." - or as near as is known. */
function keepLine(terms: CancelTerms | null, until: string | null, today: string): string {
  if (!terms?.keepsAccessUntilPeriodEnd) return "";
  const early =
    terms.cancelHoursBefore && until
      ? ` Do it at least ${Math.round(terms.cancelHoursBefore / 24)} day before.`
      : "";
  return until
    ? ` You keep it until ${when(until, today)}, then it simply doesn't renew.${early}`
    : " You keep what you've paid for, then it simply doesn't renew.";
}

/**
 * The paths forward, best first: money-saving steps by how much they save,
 * then dated steps (resubscribing for a plan month) soonest first.
 *
 * Every service the app tracks keeps a cancelled plan running to the end of
 * the period paid for, so the advice is to cancel - not pause - and when to
 * subscribe, to cancel that same day.
 *
 * - Cancel now: a service the user pays for monthly that the plan doesn't use
 *   this month. Worth its price for every month until its next turn - or
 *   for the whole horizon if it has none. Services kept whatever happens
 *   ("always keep", like Prime with shipping) and yearly plans
 *   (which can't be paused mid-term) are left alone. If wishlist titles on
 *   disc are what's on it, buying those is the way to let it go.
 * - Turn off a yearly renewal: always, and first. It costs nothing - the
 *   year runs out as paid for - and frees the user to pay monthly, only when
 *   the plan needs the service. The sums say whether that's cheaper.
 * - Subscribe: a service the user doesn't pay for that has a month in the
 *   plan. Not a saving, a step: when, for what, and to cancel the same day.
 */
export function pathsForward(input: InsightInput): Insight[] {
  const { today, plan, subscriptions, monthlyCost, publishedMonthly, nameOf, wishlistOn } = input;
  const thisMonth = plan.months.find((m) => m.start <= today && today < m.end) ?? plan.months[0];
  const insights: Insight[] = [];

  for (const sub of subscriptions) {
    const name = nameOf(sub.slug);
    const turns = plan.months.filter((m) => m.service === sub.slug);

    const terms = input.cancellationOf(sub.slug);

    // Yearly plans first, always: turning off the renewal costs nothing -
    // the year already paid for runs out as normal - and after that the
    // plan pays month by month, only when it needs the service.
    if (sub.billing?.cycle === "annual") {
      if (sub.leftOut) continue;
      const yearly = sub.billing.cents;
      const monthly = publishedMonthly(sub.slug);
      const renews = upcomingRenewal(sub.billing, today);
      const n = turns.length;
      const needed = monthly ? n * monthly : null;
      const sums =
        yearly !== null && needed !== null && monthly
          ? n === 0
            ? ` Your plan doesn't need it in the year ahead: that's ${formatDollars(yearly)} you'd stop paying.`
            : needed < yearly
              ? ` After that, monthly in just the ${n} ${n === 1 ? "month" : "months"} your plan needs it: ${n} × ${formatDollars(monthly)} = ${formatDollars(needed)}, against ${formatDollars(yearly)} for another year.`
              : ` Your plan needs it ${n} ${n === 1 ? "month" : "months"} of the year, so this year the yearly price is cheaper - but with renewal off, it's your choice at the end, not automatic.`
          : "";
      insights.push({
        id: `switch-to-monthly:${sub.slug}`,
        key: `switch-to-monthly:${sub.slug}@${renews}`,
        kind: "switch-to-monthly",
        service: sub.slug,
        title: `Turn off ${name}'s yearly renewal now`,
        detail:
          `Nothing is lost:${keepLine(terms, renews, today) || ` it renews ${when(renews, today)}.`}${sums}` +
          (terms ? ` ${terms.refunds}` : ""),
        savesCents: yearly !== null && needed !== null && needed < yearly ? yearly - needed : null,
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
    const renews = sub.billing ? upcomingRenewal(sub.billing, today) : null;
    insights.push({
      id: `pause:${sub.slug}`,
      key: `pause:${sub.slug}@${renews ?? "unset"}`,
      kind: "pause",
      service: sub.slug,
      title: `Cancel ${name} now`,
      detail: `${why}${keepLine(terms, renews, today)}${buy} ${formatDollars(price)} a month × ${idle} ${idle === 1 ? "month" : "months"}.`,
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
    // Cancel on the day you subscribe: the month runs out as paid for and
    // can't renew by accident.
    const terms = input.cancellationOf(m.service);
    const sameDay = terms?.keepsAccessUntilPeriodEnd
      ? "and cancel the same day: you keep the whole month, and it can't renew by accident."
      : "then cancel before it renews.";
    insights.push({
      id: `resubscribe:${m.service}`,
      key: `resubscribe:${m.service}@${m.start}`,
      kind: "resubscribe",
      service: m.service,
      title: `Subscribe to ${name} on or after ${when(m.start, today)}`,
      detail: `For ${listTitles(m.watched.map((w) => w.title))} - ${sameDay}`,
      savesCents: null,
      date: m.start,
    });
  }

  // Yearly plans lead - getting off them is the priority - then savings,
  // biggest first, then dated steps, soonest first.
  return insights.sort(
    (a, b) =>
      Number(b.kind === "switch-to-monthly") - Number(a.kind === "switch-to-monthly") ||
      (b.savesCents ?? -1) - (a.savesCents ?? -1) ||
      (a.date ?? "9999").localeCompare(b.date ?? "9999"),
  );
}

/**
 * The checklist's two halves: what's still to do, in the order given, and
 * what's been ticked off - with the money the ticked steps saved.
 */
export function splitDone(
  steps: readonly Insight[],
  done: ReadonlySet<string>,
): { todo: Insight[]; done: Insight[]; savedCents: number } {
  const finished = steps.filter((s) => done.has(s.key));
  return {
    todo: steps.filter((s) => !done.has(s.key)),
    done: finished,
    savedCents: finished.reduce((n, s) => n + (s.savesCents ?? 0), 0),
  };
}
