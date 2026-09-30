import { useState } from "react";

import { CatalogTile } from "../components/CatalogTile";
import { TitleDialog } from "../components/TitleDialog";
import { WatchServices, type ServiceInfo } from "../components/WatchServices";
import { graphql } from "../generated";
import { useLibrary } from "../hooks/useLibrary";
import { useDetailsById } from "../hooks/useLibraryDetails";
import { useStoredNumber } from "../hooks/useStored";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { localToday, when } from "../lib/seasons";
import {
  DEFAULT_HOURS_PER_MONTH,
  formatHours,
  formatMonths,
  HOURS_PER_MONTH_KEY,
  libraryStats,
} from "../lib/stats";
import {
  readyOrder,
  soonestArrival,
  titleReadiness,
  watchlistByService,
  watchlistGroup,
  type WatchlistTitle,
} from "../lib/watchlist";

/** The tile's fields, plus runtime for the hours. */
const WATCHLIST_DETAILS = graphql(`
  query WatchlistDetails($ids: [ID!]!) {
    mediaItems(ids: $ids) {
      __typename
      id
      onDisc
      totalRuntime {
        minutes
        estimated
      }
      availableOn {
        ...ServiceLogo
      }
      otherServices {
        id
        name
        logoUrl(size: SMALL)
      }
      upcoming {
        id
        availableFrom
        bingeableFrom
        provider {
          ...ServiceLogo
        }
      }
      ... on Series {
        nextSeason {
          ...SeasonScheduleFields
        }
      }
    }
  }
`);

/**
 * The streaming-only titles the user wants to watch, which services carry
 * them, and when each service's titles are all out: the list a paused
 * subscription is waiting on. Titles come from the library store, so they show at once;
 * where they stream and for how long fills in when the details arrive.
 */
export function WatchlistPage() {
  const entries = useLibrary().filter((e) => e.shelf === "watchlist");
  const subscribed = new Set(useSubscriptions().map((s) => s.slug));
  const [hoursPerMonth] = useStoredNumber(HOURS_PER_MONTH_KEY, DEFAULT_HOURS_PER_MONTH);
  const [openId, setOpenId] = useState<string | null>(null);
  const today = localToday();

  const { byId, loading } = useDetailsById(
    WATCHLIST_DETAILS,
    entries.map((e) => e.id),
  );

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
      </>
    );
  }

  // Only titles whose details have arrived feed the numbers, so a title
  // added a moment ago isn't counted as having no runtime.
  const loaded = entries.flatMap((e) => {
    const detail = byId.get(e.id);
    return detail ? [{ id: e.id, title: e.title, detail }] : [];
  });
  const total = libraryStats(
    loaded.map((t) => t.detail.totalRuntime),
    hoursPerMonth,
  );
  const titles = new Map<string, WatchlistTitle>(
    loaded.map(({ id, title, detail }) => [
      id,
      {
        id,
        title,
        runtime: detail.totalRuntime ?? null,
        availableOn: detail.availableOn,
        otherServices: detail.otherServices,
        upcoming: detail.upcoming.map((u) => ({
          slug: u.provider.slug,
          availableFrom: u.availableFrom,
          bingeableFrom: u.bingeableFrom,
        })),
        nextSeason: detail.__typename === "Series" ? detail.nextSeason : null,
      },
    ]),
  );
  const { services, unhosted } = watchlistByService([...titles.values()], subscribed, today);

  // The two halves of the grid. A title whose details haven't loaded waits
  // in Watch now rather than jumping sections; Coming soon runs soonest
  // first, Watch now keeps the shelf's newest-first order.
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

  const tile = (entry: (typeof entries)[number]) => {
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
          nextSeason: detail?.__typename === "Series" ? detail.nextSeason : null,
        }}
        note={arrival ? `Arrives ${when(arrival, today)}` : null}
        onOpen={() => setOpenId(entry.id)}
      />
    );
  };

  // Name and logo for each row of the box: tracked services by slug, the
  // rest by id - the keys watchlistByService rolls up under.
  const serviceInfo = new Map<string, ServiceInfo>();
  for (const { detail } of loaded) {
    for (const p of [...detail.availableOn, ...detail.upcoming.map((u) => u.provider)]) {
      serviceInfo.set(p.slug, { name: p.name, logoUrl: p.logoUrl });
    }
    for (const o of detail.otherServices)
      serviceInfo.set(o.id, { name: o.name, logoUrl: o.logoUrl });
  }

  return (
    <>
      <header className="masthead">
        <h1>Watchlist</h1>
        <p>
          {entries.length} {entries.length === 1 ? "title" : "titles"}
          {loaded.length > 0 && (
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

      {loading && loaded.length === 0 && <p className="state">Adding up your watchlist…</p>}

      <WatchServices
        services={services}
        unhosted={unhosted}
        missing={total.missing}
        hoursPerMonth={hoursPerMonth}
        today={today}
        serviceInfo={serviceInfo}
        onOpen={setOpenId}
      />

      {[
        { heading: "Watch now", list: watchNow },
        { heading: "Coming soon", list: comingSoon },
      ].map(
        ({ heading, list }) =>
          list.length > 0 && (
            <section key={heading} className="shelf">
              <h2 className="shelf__title">
                {heading} <span className="shelf__count">{list.length}</span>
              </h2>
              <ul className="shelf__grid">{list.map(tile)}</ul>
            </section>
          ),
      )}

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
