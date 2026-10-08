import { useState } from "react";

import { CatalogTile } from "../components/CatalogTile";
import { TitleDialog } from "../components/TitleDialog";
import { Renewals } from "../components/Renewals";
import { WatchServices } from "../components/WatchServices";
import { useHoursPerMonth } from "../hooks/useSettings";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { useWatchlist } from "../hooks/useWatchlist";
import { localToday, when } from "../lib/seasons";
import { formatHours, formatMonths, libraryStats } from "../lib/stats";
import {
  readyOrder,
  soonestArrival,
  titleReadiness,
  watchlistByService,
  watchlistGroup,
} from "../lib/watchlist";

/**
 * The streaming-only titles the user wants to watch, which services carry
 * them, and when each service's titles are all out: the list a paused
 * subscription is waiting on. Titles come from the library store, so they show at once;
 * where they stream and for how long fills in when the details arrive.
 */
export function WatchlistPage() {
  const { entries, byId, titles, serviceInfo, loading } = useWatchlist();
  const subscribed = new Set(useSubscriptions().map((s) => s.slug));
  const [hoursPerMonth] = useHoursPerMonth();
  const [openId, setOpenId] = useState<string | null>(null);
  const today = localToday();

  if (entries.length === 0) {
    return (
      <>
        <header className="masthead">
          <h1>Watchlist</h1>
          <p>
            Nothing here yet. Streaming-only titles have a + Watchlist button on What's On and
            Coming Soon: add the ones you want to watch, and this page works out which services
            you'd need, and for how long.
          </p>
        </header>
        {/* Renewals need only the services paid for - with nothing to watch,
            they're the advice that matters most: cancel, or turn off a
            yearly renewal. Renders nothing without subscriptions. */}
        <Renewals />
      </>
    );
  }

  const total = libraryStats(
    [...titles.values()].map((t) => t.runtime),
    hoursPerMonth,
  );
  const { services, unhosted } = watchlistByService([...titles.values()], subscribed, today);

  // The two halves of the grid. A title whose details haven't loaded waits
  // in Available now rather than jumping sections; Coming soon runs soonest
  // first, Available now keeps the shelf's newest-first order.
  const groupOf = (id: string) => {
    const t = titles.get(id);
    return t ? watchlistGroup(t, today) : "now";
  };
  const watchNow = entries.filter((e) => groupOf(e.id) === "now");
  const comingSoon = entries
    .filter((e) => groupOf(e.id) === "coming")
    .map((e) => {
      const t = titles.get(e.id);
      return { entry: e, order: t ? readyOrder(titleReadiness(t, today)) : Infinity };
    })
    .sort((a, b) => a.order - b.order)
    .map((x) => x.entry);

  const tile = (entry: (typeof entries)[number], coming: boolean) => {
    const detail = byId.get(entry.id);
    const t = titles.get(entry.id);
    // A film on its way says when, where a series says where its season is.
    const arrival = t && !t.nextSeason && t.availableOn.length === 0 ? soonestArrival(t) : null;
    return (
      <CatalogTile
        key={entry.id}
        item={{
          __typename: entry.kind,
          id: entry.id,
          title: entry.title,
          posterUrl: entry.posterUrl,
          // Until details load, the tile keeps its own Watchlist pill
          // rather than flickering through Own/Want.
          onDisc: detail?.onDisc ?? false,
          availableOn: detail?.availableOn,
          score: detail?.score,
          // The logos say where to watch it. Under Coming soon that's where
          // it's going too: a film announced for Netflix, or a series' own
          // service before it has a date. Under Available now, where it is - and
          // for a season that has just premiered, its own service, in case
          // the watch data hasn't caught up. Never a service it's only
          // coming to later, like a film out on Prime that reaches HBO Max
          // next year.
          comingTo: coming
            ? [
                ...(detail?.upcoming.map((u) => u.provider) ?? []),
                ...(detail?.__typename === "Series" ? detail.madeFor : []),
              ]
            : detail?.__typename === "Series" && detail.nextSeason
              ? detail.madeFor
              : [],
          nextSeason: detail?.__typename === "Series" ? detail.nextSeason : null,
        }}
        note={arrival ? `Arrives ${when(arrival, today)}` : null}
        onOpen={() => setOpenId(entry.id)}
      />
    );
  };

  return (
    <>
      <header className="masthead">
        <h1>Watchlist</h1>
        <p>
          {entries.length} {entries.length === 1 ? "title" : "titles"}
          {titles.size > 0 && (
            <>
              {" "}
              · {total.estimated ? "about " : ""}
              {formatHours(total.minutes)} of watching, or {formatMonths(total.months)} at{" "}
              {hoursPerMonth} hours a month
            </>
          )}
          .
        </p>
      </header>

      {loading && titles.size === 0 && <p className="state">Adding up your watchlist…</p>}

      {/* The decision that's due first: what to do about each renewal. The
          advice reads the watchlist, so it lives with it. */}
      <Renewals />

      {[
        { heading: "Available now", list: watchNow, coming: false },
        { heading: "Coming soon", list: comingSoon, coming: true },
      ].map(
        ({ heading, list, coming }) =>
          list.length > 0 && (
            <section key={heading} className="shelf">
              <h2 className="shelf__title">
                {heading} <span className="shelf__count">{list.length}</span>
              </h2>
              <ul className="shelf__grid">{list.map((e) => tile(e, coming))}</ul>
            </section>
          ),
      )}

      {/* The by-service breakdown last, as the detail behind the advice. */}
      <WatchServices
        services={services}
        unhosted={unhosted}
        missing={total.missing}
        hoursPerMonth={hoursPerMonth}
        today={today}
        serviceInfo={serviceInfo}
        onOpen={setOpenId}
      />

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
