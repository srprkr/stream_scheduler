import type { ReactNode } from "react";

import { CancelHowTo, type Cancellation } from "./CancelHowTo";
import { useLibrary } from "../hooks/useLibrary";
import { useLibraryDetails } from "../hooks/useLibraryDetails";
import { useLevels } from "../hooks/useSettings";
import { usePathsDone } from "../hooks/usePathsDone";
import { useRotationPlan } from "../hooks/useRotationPlan";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { useWatchlist } from "../hooks/useWatchlist";
import { comingSoonStats } from "../lib/comingSoon";
import { cumulativeCosts } from "../lib/costChart";
import { pathsForward, splitDone, type Insight } from "../lib/insights";
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
  const { plan, priceOf, plansFor, payingNow, alwaysOn, providers, nameOf, hoursPerMonth, today } =
    rotation;
  const mine = useSubscriptions();
  const [doneKeys, setDoneKeys] = usePathsDone();
  const { titles } = useWatchlist();
  const entries = useLibrary();
  const owned = entries.filter((e) => e.shelf === "owned");
  const wanted = entries.filter((e) => e.shelf === "wanted");
  const details = useLibraryDetails([...owned, ...wanted].map((e) => e.id));

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
    publishedMonthly: rotation.publishedMonthly,
    nameOf,
    wishlistOn,
    cancellationOf,
  });

  // The checklist: ticks are kept in this browser, tied to each step's date.
  const doneSet = new Set(doneKeys);
  const checklist = splitDone(steps, doneSet);
  const toggle = (key: string) => {
    const next = new Set(doneSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Only keys for steps still on the list: old ones would pile up forever.
    const current = new Set(steps.map((s) => s.key));
    setDoneKeys([...next].filter((k) => current.has(k)));
  };

  // The service's logo just before its name in a step's title: "Cancel
  // [logo] Netflix now", "Turn off [logo] Peacock's yearly renewal now".
  // Decorative - the name beside it already says which service.
  const withLogo = (title: string, service: string) => {
    const name = nameOf(service);
    const logoUrl = rotation.logoOf(service);
    const at = title.indexOf(name);
    if (!logoUrl || at < 0) return title;
    return (
      <>
        {title.slice(0, at)}
        <img className="paths__logo" src={logoUrl} alt="" />
        {title.slice(at)}
      </>
    );
  };

  const step = (s: Insight, isDone: boolean) => (
    <li key={s.key} className="paths__item" data-done={isDone}>
      <div>
        <label className="paths__check">
          <input type="checkbox" checked={isDone} onChange={() => toggle(s.key)} />
          <span className="paths__title">{withLogo(s.title, s.service)}</span>
        </label>
        {/* Once done, the working and the how-to step aside. */}
        {!isDone && <p className="paths__detail">{s.detail}</p>}
        {!isDone && cancellationOf(s.service) && (
          <CancelHowTo
            name={nameOf(s.service)}
            cancellation={cancellationOf(s.service) as Cancellation}
          />
        )}
      </div>
      {s.savesCents !== null && (
        <p className="paths__saves">
          {isDone ? "saved" : "saves"} <strong>{formatDollars(s.savesCents)}</strong>
        </p>
      )}
    </li>
  );

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
              Getting off yearly plans first, then what would save money, biggest first, then what
              your plan needs next. Tick each off as you do it.
            </p>
            <p className="paths__progress" role="status">
              {checklist.done.length} of {steps.length} done
              {checklist.savedCents > 0 && (
                <>
                  {" "}
                  · <strong>{formatDollars(checklist.savedCents)}</strong> saved
                </>
              )}
            </p>
            <ul className="paths__list">{checklist.todo.map((s) => step(s, false))}</ul>
            {checklist.done.length > 0 && (
              <>
                <h3 className="paths__done-title">Done</h3>
                <ul className="paths__list paths__list--done">
                  {checklist.done.map((s) => step(s, true))}
                </ul>
              </>
            )}
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
