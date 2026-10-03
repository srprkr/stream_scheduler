import { useQuery } from "@apollo/client/react";

import { graphql } from "../generated";
import { planRotation, type PlanService } from "../lib/planner";
import { localToday } from "../lib/seasons";
import { DEFAULT_HOURS_PER_MONTH, HOURS_PER_MONTH_KEY } from "../lib/stats";
import { monthlyCents, monthlySpend } from "../lib/subscriptions";
import { stillToCome, watchlistByService } from "../lib/watchlist";
import { useStoredNumber } from "./useStored";
import { useSubscriptions } from "./useSubscriptions";
import { useWatchlist } from "./useWatchlist";

// The same plan fields as MyServices selects: plans are cached inside their
// provider (apollo.ts), so a narrower list would overwrite that one and send
// each page back to the network for the fields it lost.
const PLAN_SERVICES = graphql(`
  query PlanServices {
    providers {
      ...ServiceLogo
      plans {
        id
        leaveOutByDefault
        name
        monthlyCents
        hasAds
        isDefault
        note
      }
    }
  }
`);

export const MAX_WAIT_KEY = "stream-scheduler:max-wait-months";
/** The feed's 90-day window: as far ahead as release dates are known. */
export const DEFAULT_MAX_WAIT_MONTHS = 3;

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
  const [hoursPerMonth] = useStoredNumber(HOURS_PER_MONTH_KEY, DEFAULT_HOURS_PER_MONTH);
  const [maxWaitMonths, setMaxWaitMonths] = useStoredNumber(MAX_WAIT_KEY, DEFAULT_MAX_WAIT_MONTHS);

  // Each service's titles with when they're ready there, and how long they
  // take: a coming season's hours, or the whole of what's out now.
  const subscribed = new Set(mine.map((s) => s.slug));
  const { services } = watchlistByService([...titles.values()], subscribed, today);
  const planServices: PlanService[] = services.map((s) => ({
    key: s.key,
    titles: s.titles.map((st) => {
      const t = titles.get(st.id);
      const runtime = t && stillToCome(t, today) ? t.comingRuntime : (t?.runtime ?? null);
      return {
        id: st.id,
        title: st.title,
        minutes: runtime?.minutes ?? null,
        startsOn: t?.nextSeason?.premieresOn ?? null,
        readyOn: st.ready.state === "now" ? today : st.ready.state === "on" ? st.ready.date : null,
      };
    }),
  }));

  const plansFor = (slug: string) => providers.find((p) => p.slug === slug)?.plans ?? [];
  const priceOf = (key: string) => {
    const sub = mine.find((s) => s.slug === key);
    if (sub) return monthlyCents(sub, plansFor(key));
    return plansFor(key).find((p) => p.isDefault)?.monthlyCents ?? null;
  };
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
    payingNow: monthlySpend(mine, plansFor).cents,
    hoursPerMonth,
    maxWaitMonths,
    setMaxWaitMonths,
    today,
  };
}
