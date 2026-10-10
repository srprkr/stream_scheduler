import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";

import { CatalogTile } from "./CatalogTile";
import { TitleDialog } from "./TitleDialog";

import { removedLabel, useKeptOnScreen } from "../hooks/useKeptOnScreen";
import { useLibrary } from "../hooks/useLibrary";
import { useLibraryDetails } from "../hooks/useLibraryDetails";
import { useRotationPlan } from "../hooks/useRotationPlan";
import { DISC_PLAN_MONTHS, planDiscs, windowSaving } from "../lib/discPlan";
import { formatDollars } from "../lib/money";
import { listTitles } from "../lib/replaces";
import { when } from "../lib/seasons";
import { formatHours, libraryStats } from "../lib/stats";

/**
 * What carries the user through the months the rotation plan streams little
 * or nothing. Two figures, each against the same gaps: the runtime of the
 * library they already own, and - for something new to watch - what the
 * wishlist would add, with a buying order. When the wishlist can't fill the
 * gaps, it says by how much and points to the longest-lasting discs: series.
 */
export function DiscPlan() {
  const { plan, hoursPerMonth, today, priceOf, payingNow, billing } = useRotationPlan();
  const entries = useLibrary();
  const owned = entries.filter((e) => e.shelf === "owned");
  const wanted = entries.filter((e) => e.shelf === "wanted");
  // The same ids as Insights' figures ask for, so one request serves both.
  const details = useLibraryDetails([...owned, ...wanted].map((e) => e.id));

  const result = planDiscs({
    plan,
    today,
    minutesPerMonth: hoursPerMonth * 60,
    wanted: wanted.map((e) => ({
      id: e.id,
      title: e.title,
      kind: e.kind,
      minutes: details.byId.get(e.id)?.totalRuntime?.minutes ?? null,
    })),
  });
  const { gaps, gapMinutes, picks, shortMinutes, unknown } = result;
  const paused = gaps.filter((g) => g.paused).length;
  const light = gaps.length - paused;
  const covered = gapMinutes - shortMinutes;
  // What the user owns, against the same gaps - a figure of its own, not
  // taken off the wishlist's: the wishlist is for something new to watch.
  const ownedStats = libraryStats(
    owned.map((e) => details.byId.get(e.id)?.totalRuntime),
    hoursPerMonth,
  );
  const ownedLabel = `${ownedStats.estimated ? "~" : ""}${formatHours(ownedStats.minutes)}`;
  const ownedShort = Math.max(0, gapMinutes - ownedStats.minutes);
  // The disc budget: buying discs only pays off while they cost less than
  // pausing saves over the same months.
  // Yearly plans count on their renewal date, as on the cost chart.
  const saving = windowSaving(plan, today, priceOf, billing.monthly, billing.yearly);

  // The wishlist as tiles: the plan's picks in buying order, then the rest.
  const [openId, setOpenId] = useState<string | null>(null);
  const pickOf = new Map(picks.map((p) => [p.id, p]));
  // A disc marked owned - or dropped - stays, greyed, until the page is
  // left: pressing Own here takes it off the wishlist, and it shouldn't
  // vanish before the user sees what they did.
  const tiles = useKeptOnScreen([
    ...picks.flatMap((p) => wanted.filter((e) => e.id === p.id)),
    ...wanted.filter((e) => !pickOf.has(e.id)),
  ]);

  return (
    <section className="panel disc-plan" aria-labelledby="disc-plan-title">
      <h2 id="disc-plan-title" className="panel__title">
        Content to own for your paused months
      </h2>

      {/* The wishlist as tiles on the left, in buying order, and the figures
          beside them at a readable width (CSS). Stacked on a narrow screen,
          text first. */}
      <div className="disc-plan__body">
        <div className="disc-plan__text">
          {gaps.length === 0 ? (
            <p className="panel__lede">
              Your plan streams a full month of viewing every month for the next {DISC_PLAN_MONTHS}:
              nothing to fill.
            </p>
          ) : details.loading && owned.length + wanted.length > 0 ? (
            // Until runtimes arrive every disc counts zero, which would read as
            // a library and wishlist that fill nothing.
            <p className="panel__lede">Adding up your discs…</p>
          ) : (
            <>
              <p className="panel__lede">
                The next <Figure>{DISC_PLAN_MONTHS}</Figure> months leave{" "}
                <Figure>{formatHours(gapMinutes)}</Figure> of your viewing unstreamed:{" "}
                {paused > 0 && (
                  <>
                    <Figure>{paused}</Figure> pause {paused === 1 ? "month" : "months"}
                  </>
                )}
                {paused > 0 && light > 0 && " and "}
                {light > 0 && (
                  <>
                    <Figure>{light}</Figure> light {light === 1 ? "month" : "months"}
                  </>
                )}
                .{" "}
                {owned.length === 0 ? (
                  "You don't own any discs yet."
                ) : ownedShort === 0 ? (
                  <>
                    {/* Green: what they own already carries them through. */}
                    Your <Figure good>{ownedLabel}</Figure> of library runtime covers it.
                  </>
                ) : (
                  <>
                    Your <Figure>{ownedLabel}</Figure> of library runtime covers that much of it -{" "}
                    <Figure>{formatHours(ownedShort)}</Figure> short.
                  </>
                )}
              </p>

              {/* Something new to watch: the wishlist, judged on its own. */}
              <p className={shortMinutes > 0 ? "disc-plan__short" : "disc-plan__wishlist"}>
                If you want something new to watch,{" "}
                {wanted.length === 0 ? (
                  "wishlist a few discs. "
                ) : shortMinutes === 0 ? (
                  "your wishlist covers it - buy each before the month it's needed."
                ) : (
                  <>
                    your wishlist covers <Figure>{formatHours(covered)}</Figure> of it -{" "}
                    <Figure>{formatHours(shortMinutes)}</Figure> short.{" "}
                  </>
                )}
                {shortMinutes > 0 && (
                  <>
                    Series last longest: wishlist a few from <Link to="/whats-on">What's On</Link>,
                    with On disc and Series picked.
                  </>
                )}
              </p>

              {/* The ceiling on what the wishlisted discs are worth buying for. */}
              <p className="disc-plan__budget">
                {payingNow === 0 ? (
                  "Tell us what you pay for in Your services below, and this shows what you can spend on discs and still come out ahead."
                ) : saving.cents > 0 ? (
                  <>
                    Keep what you spend on discs lower than{" "}
                    <Figure>{formatDollars(saving.cents)}</Figure>: which is money saved from
                    pausing subscriptions for the next <Figure>{DISC_PLAN_MONTHS}</Figure> months.
                    {saving.unpriced > 0 &&
                      ` (${saving.unpriced} plan ${saving.unpriced === 1 ? "month has" : "months have"} no price yet and ${saving.unpriced === 1 ? "isn't" : "aren't"} counted.)`}
                  </>
                ) : (
                  `Your plan doesn't save anything over the next ${DISC_PLAN_MONTHS} months, so discs bought now are an extra cost.`
                )}
              </p>
            </>
          )}

          <p className="panel__note">
            {unknown.length > 0 && `No runtime yet for ${listTitles(unknown)}, so not counted. `}
            {ownedStats.missing > 0 &&
              `${ownedStats.missing} owned ${ownedStats.missing === 1 ? "title has" : "titles have"} no runtime yet, so ${ownedStats.missing === 1 ? "isn't" : "aren't"} counted. `}
            Library runtime counts everything you own, watched or not. A month's viewing is your{" "}
            {hoursPerMonth} hours, from Settings.
          </p>
        </div>

        {tiles.length > 0 && !details.loading && (
          <ul
            className="shelf__grid disc-plan__tiles"
            aria-label="Your wishlist, in buying order"
            // As many columns as there are tiles, up to four: the text then
            // sits right beside them, not across a gap.
            style={{ "--tile-cols": Math.min(tiles.length, 4) } as CSSProperties}
          >
            {tiles.map(({ item: e, removed }) => {
              const pick = pickOf.get(e.id);
              const detail = details.byId.get(e.id);
              const minutes = detail?.totalRuntime?.minutes;
              const hours = minutes === undefined ? "" : ` · ${formatHours(minutes)}`;
              return (
                <CatalogTile
                  key={e.id}
                  item={{
                    __typename: e.kind,
                    id: e.id,
                    title: e.title,
                    posterUrl: e.posterUrl,
                    availableOn: detail?.availableOn,
                    score: detail?.score,
                    // Wishlisted discs are on disc by definition.
                    onDisc: true,
                  }}
                  // Own, to mark it bought - which takes it off the plan - and
                  // the star, to drop it from the wishlist.
                  inLibrary
                  removed={removed ? removedLabel(entries.find((x) => x.id === e.id)) : null}
                  note={
                    removed
                      ? null
                      : pick
                        ? `${pick.by <= today ? "Buy now" : `Buy by ${when(pick.by, today)}`}${hours}`
                        : `Not needed yet${hours}`
                  }
                  onOpen={() => setOpenId(e.id)}
                />
              );
            })}
          </ul>
        )}
      </div>

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}

/** A number the sentence turns on: a size up, and green when it's good news. */
function Figure({ good = false, children }: { good?: boolean; children: ReactNode }) {
  return (
    <strong className={`disc-plan__figure${good ? " disc-plan__figure--good" : ""}`}>
      {children}
    </strong>
  );
}
