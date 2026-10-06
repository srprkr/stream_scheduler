import { useQuery } from "@apollo/client/react";

import { graphql } from "../generated";
import { planRotation, type PlanService } from "../lib/planner";
import { localToday } from "../lib/seasons";
import { monthlyCents, monthlySpend } from "../lib/subscriptions";
import { stillToCome, watchlistByService } from "../lib/watchlist";
import { useHoursPerMonth, useMaxWaitMonths } from "./useSettings";
import { useSubscriptions } from "./useSubscriptions";
import { useWatchlist } from "./useWatchlist";

// The same plan fields as MyServices selects: plans are cached inside their
// provider (apollo.ts), so a narrower list would overwrite that one and send
// each page back to the network for the fields it lost.
const PLAN_SERVICES = graphql(`
  query PlanServices {
    providers {
      ...ServiceLogo
      cancellation {
        url
        steps
        keepsAccessUntilPeriodEnd
        cancelHoursBefore
        pause
        refunds
        gotchas
        checkedOn
      }
      plans {
        id
        leaveOutByDefault
        name
        monthlyCents
        hasAds
        isDefault
        note
        yearlyCents
      }
    }
  }
`);

/**
 * The rotation plan (planner.ts) from everything the user has told the app:
 * their watchlist, their hours a month, how long they'll wait, and what
 * each service costs - their own plan where they pay for one, the default
 * plan where they don't. Renewals and Coming Soon's Cost view both read it,
 * so their advice can't disagree.
 */
export function useRotationPlan() {
  const today = localToday();
  const { titles } = useWatchlist();
  const mine = useSubscriptions();
  const providers = useQuery(PLAN_SERVICES).data?.providers ?? [];
  const [hoursPerMonth] = useHoursPerMonth();
  const [maxWaitMonths, setMaxWaitMonths] = useMaxWaitMonths();

  // Each service's titles with when they're ready there, and how long they
  // take: a coming season's hours, or the whole of what's out now.
  const subscribed = new Set(mine.map((s) => s.slug));
  const { services } = watchlistByService([...titles.values()], subscribed, today);

  // Services the user keeps whatever happens ("always keep", like Prime
  // with shipping) are paid for every month already. Their titles are
  // watchable any time, so they're taken out of the rotation entirely -
  // including from other services that carry them - and listed apart.
  const alwaysOnSlugs = mine.filter((s) => s.leftOut).map((s) => s.slug);
  const kept = services.filter((s) => alwaysOnSlugs.includes(s.key));
  const free = new Set(kept.flatMap((s) => s.titles.map((t) => t.id)));
  const anyTime = kept.map((s) => ({
    key: s.key,
    titles: s.titles.map((t) => ({ title: t.title, ready: t.ready })),
  }));

  const planServices: PlanService[] = services
    .filter((s) => !alwaysOnSlugs.includes(s.key))
    .map((s) => ({
      ...s,
      titles: s.titles.filter((t) => !free.has(t.id)),
    }))
    .filter((s) => s.titles.length > 0)
    .map((s) => ({
      key: s.key,
      titles: s.titles.map((st) => {
        const t = titles.get(st.id);
        const runtime = t && stillToCome(t, today) ? t.comingRuntime : (t?.runtime ?? null);
        return {
          id: st.id,
          title: st.title,
          minutes: runtime?.minutes ?? null,
          startsOn: t?.nextSeason?.premieresOn ?? null,
          readyOn:
            st.ready.state === "now" ? today : st.ready.state === "on" ? st.ready.date : null,
        };
      }),
    }));

  const plansFor = (slug: string) => providers.find((p) => p.slug === slug)?.plans ?? [];
  // What a plan month on a service adds. Nothing for one the user keeps
  // whatever happens ("always keep", like Prime with shipping): it's
  // paid for anyway, so a month of it in the plan costs nothing extra.
  const priceOf = (key: string) => {
    const sub = mine.find((s) => s.slug === key);
    if (sub?.leftOut) return 0;
    if (sub) return monthlyCents(sub, plansFor(key));
    return plansFor(key).find((p) => p.isDefault)?.monthlyCents ?? null;
  };
  const spend = monthlySpend(mine, plansFor);
  const planFor = (waitMonths: number) =>
    planRotation(planServices, {
      today,
      minutesPerMonth: hoursPerMonth * 60,
      maxWaitDays: waitMonths * 30,
    });

  return {
    plan: planFor(maxWaitMonths),
    planFor,
    priceOf,
    plansFor,
    providers,
    payingNow: spend.cents,
    /** Monthly cost of the services kept whatever happens, and their slugs. */
    alwaysOn: spend.leftOutCents,
    alwaysOnSlugs,
    /** Watchlist titles on always-kept services: free to watch any month. */
    anyTime,
    hoursPerMonth,
    maxWaitMonths,
    setMaxWaitMonths,
    today,
  };
}
