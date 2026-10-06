import type { ReactNode } from "react";

import { CancelHowTo, type Cancellation } from "./CancelHowTo";
import { useLibrary } from "../hooks/useLibrary";
import { useLibraryDetails } from "../hooks/useLibraryDetails";
import { useLevels } from "../hooks/useSettings";
import { useRotationPlan } from "../hooks/useRotationPlan";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { useWatchlist } from "../hooks/useWatchlist";
import { comingSoonStats } from "../lib/comingSoon";
import { cumulativeCosts } from "../lib/costChart";
import { pathsForward } from "../lib/insights";
import { formatDollars } from "../lib/money";
import {
  comingLevel,
  ownedHoursLevel,
  ownedTitlesLevel,
  spendLevel,
  type Level as LevelValue,
} from "../lib/levels";
import { formatHours, libraryStats } from "../lib/stats";
import { monthlyCents } from "../lib/subscriptions";

/**
 * The top of Insights: four figures at a glance, then the paths forward -
 * the steps that would save money or that the plan needs next, best first.
 * Everything is worked out from the same plan and prices as the rest of
 * the app (useRotationPlan), so the numbers here match Renewals, Coming
 * Soon's Cost tab and the chart below.
 */
export function InsightsSummary() {
  const rotation = useRotationPlan();
  const { plan, priceOf, plansFor, payingNow, alwaysOn, providers, hoursPerMonth, today } =
    rotation;
  const mine = useSubscriptions();
  const { titles, serviceInfo } = useWatchlist();
  const entries = useLibrary();
  const owned = entries.filter((e) => e.shelf === "owned");
  const wanted = entries.filter((e) => e.shelf === "wanted");
  const details = useLibraryDetails([...owned, ...wanted].map((e) => e.id));

  const nameOf = (key: string) =>
    providers.find((p) => p.slug === key)?.name ?? serviceInfo.get(key)?.name ?? key;

  // At a glance, coloured by the user's own thresholds (Settings).
  const monthMinutes = hoursPerMonth * 60;
  const [levels] = useLevels();
  const { points } = cumulativeCosts(plan, priceOf, payingNow, alwaysOn);
  const end = points.at(-1);
  const saved = end ? end.keep - end.plan : 0;
  const coming = comingSoonStats([...titles.values()], new Set(mine.map((s) => s.slug)), today);
  const comingMinutes = coming.months.reduce((n, m) => n + m.minutes, 0);
  const ownedStats = libraryStats(
    owned.map((e) => details.byId.get(e.id)?.totalRuntime).filter((r) => r !== undefined),
    hoursPerMonth,
  );

  // Paths forward.
  const cancellationOf = (slug: string) =>
    providers.find((p) => p.slug === slug)?.cancellation ?? null;
  const wishlistOn = (slug: string) =>
    wanted
      .filter((e) => details.byId.get(e.id)?.availableOn.some((p) => p.slug === slug))
      .map((e) => e.title);
  const steps = pathsForward({
    today,
    plan,
    subscriptions: mine,
    monthlyCost: (sub) => monthlyCents(sub, plansFor(sub.slug)),
    publishedMonthly: (slug) => {
      const sub = mine.find((s) => s.slug === slug);
      const plans = plansFor(slug);
      const chosen =
        sub && "planId" in sub.choice
          ? plans.find((p) => "planId" in sub.choice && p.id === sub.choice.planId)
          : undefined;
      return (chosen ?? plans.find((p) => p.isDefault))?.monthlyCents ?? null;
    },
    nameOf,
    wishlistOn,
    cancellationOf,
  });

  return (
    <>
      <ul className="glance" aria-label="At a glance">
        <Tile
          figure={formatDollars(payingNow + alwaysOn)}
          unit="/month"
          level={spendLevel(payingNow + alwaysOn, levels)}
          why={{
            bad: `More than ${formatDollars(levels.spendHighCents)} a month`,
            warn: "Still paying for streaming",
          }}
          label={`on ${mine.length} ${mine.length === 1 ? "service" : "services"} now`}
        />
        <Tile
          figure={formatDollars(Math.max(saved, 0))}
          label={
            end
              ? `the plan saves over ${end.index} ${end.index === 1 ? "month" : "months"}`
              : "to save: add to your watchlist"
          }
        />
        <Tile
          figure={`${coming.months.length > 0 ? "~" : ""}${formatHours(comingMinutes)}`}
          level={comingLevel(comingMinutes, monthMinutes)}
          why={{
            good: "A month or more of your viewing on its way: a paid month will be well used",
          }}
          label={`coming on your watchlist, ${titles.size} ${titles.size === 1 ? "title" : "titles"}`}
        />
        <Tile
          figure={`${ownedStats.estimated ? "~" : ""}${formatHours(ownedStats.minutes)}`}
          level={ownedHoursLevel(ownedStats.minutes, monthMinutes, levels)}
          why={{
            good: `${levels.ownedGoodMonths}+ months of your viewing`,
            warn: `Over halfway to ${levels.ownedGoodMonths} months of your viewing`,
          }}
          label={
            <>
              owned on disc,{" "}
              <Level
                level={ownedTitlesLevel(owned.length, levels)}
                why={{
                  good: `More than ${levels.ownedGoodTitles} titles`,
                  warn: `Approaching ${levels.ownedGoodTitles} titles`,
                }}
              >
                {owned.length} {owned.length === 1 ? "title" : "titles"}
              </Level>
            </>
          }
        />
      </ul>

      <section className="panel paths" aria-labelledby="paths-title">
        <h2 id="paths-title" className="panel__title">
          Paths forward
        </h2>
        {steps.length === 0 ? (
          <p className="panel__lede">
            Nothing to change: what you pay for matches your plan. Add titles to your watchlist, or
            tell us your services below, and suggestions appear here.
          </p>
        ) : (
          <>
            <p className="panel__lede">
              What would save money, biggest first, then what your plan needs next. Each shows its
              working.
            </p>
            <ol className="paths__list">
              {steps.map((s) => (
                <li key={s.id} className="paths__item">
                  <div>
                    <p className="paths__title">{s.title}</p>
                    <p className="paths__detail">{s.detail}</p>
                    {cancellationOf(s.service) && (
                      <CancelHowTo
                        name={nameOf(s.service)}
                        cancellation={cancellationOf(s.service) as Cancellation}
                      />
                    )}
                  </div>
                  {s.savesCents !== null && (
                    <p className="paths__saves">
                      saves <strong>{formatDollars(s.savesCents)}</strong>
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </>
  );
}

type Why = Partial<Record<"good" | "warn" | "bad", string>>;

/**
 * A single headline number, its unit, and what it counts. The figure takes
 * its level's colour (levels.ts), with the reason as hover text and for
 * screen readers - colour is never the only way to tell.
 */
function Tile({
  figure,
  unit,
  label,
  level = null,
  why = {},
}: {
  figure: string;
  unit?: string;
  label: ReactNode;
  level?: LevelValue;
  why?: Why;
}) {
  return (
    <li className="glance__tile">
      <p className="glance__figure">
        <Level level={level} why={why}>
          {figure}
        </Level>
        {unit && <span className="glance__unit">{unit}</span>}
      </p>
      <p className="glance__label">{label}</p>
    </li>
  );
}

/** Text in a level's colour, saying the level in words too. */
function Level({ level, why, children }: { level: LevelValue; why: Why; children: ReactNode }) {
  const reason = level ? why[level] : undefined;
  return (
    <span className="level" data-level={level ?? undefined} title={reason}>
      {children}
      {reason && <span className="sr-only"> ({reason})</span>}
    </span>
  );
}
