import { skipToken, useQuery } from "@apollo/client/react";
import { useState } from "react";

import { CatalogTile } from "../components/CatalogTile";
import { Panel } from "../components/Panel";
import { TitleDialog } from "../components/TitleDialog";
import { graphql } from "../generated";
import type { WatchlistDetailsQuery } from "../generated/graphql";
import { useLibrary } from "../hooks/useLibrary";
import { useStoredNumber } from "../hooks/useStoredNumber";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { listTitles } from "../lib/replaces";
import { localToday, readyLine, seasonLine, when } from "../lib/seasons";
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
        id
        slug
        name
        logoUrl(size: SMALL)
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
          id
          slug
          name
          logoUrl(size: SMALL)
        }
      }
      ... on Series {
        nextSeason {
          seasonNumber
          premieresOn
          fullyOutOn
          expectedFullyOutOn
          isFullDrop
        }
      }
    }
  }
`);

type Detail = NonNullable<WatchlistDetailsQuery["mediaItems"][number]>;

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

  // Sorted so reordering the shelf doesn't change the variables and refetch.
  const ids = entries.map((e) => e.id).sort();
  const { data, previousData, loading } = useQuery(
    WATCHLIST_DETAILS,
    ids.length > 0 ? { variables: { ids } } : skipToken,
  );
  const byId = new Map<string, Detail>();
  for (const item of (data ?? previousData)?.mediaItems ?? []) if (item) byId.set(item.id, item);

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
          availableOn: detail?.availableOn ?? [],
          nextSeason: detail?.__typename === "Series" ? detail.nextSeason : null,
        }}
        note={arrival ? `Arrives ${when(arrival, today)}` : null}
        onOpen={() => setOpenId(entry.id)}
      />
    );
  };

  // Name and logo for a row: tracked services by slug, the rest by id.
  const serviceFor = (key: string) =>
    loaded
      .flatMap((t) => [
        ...[...t.detail.availableOn, ...t.detail.upcoming.map((u) => u.provider)].map((p) => ({
          key: p.slug,
          name: p.name,
          logoUrl: p.logoUrl,
        })),
        ...t.detail.otherServices.map((o) => ({ key: o.id, name: o.name, logoUrl: o.logoUrl })),
      ])
      .find((p) => p.key === key);

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

      {services.length > 0 && (
        <Panel id="watch-services" className="watch-services" title="Where to watch it">
          <p className="watch-services__lede">
            Each service with your watchlist titles on it or coming to it, and when they're all out
            - the day a month of that service covers everything. Greyed services are ones you don't
            pay for.
          </p>
          <ul className="watch-services__list">
            {services.map((s) => {
              const provider = serviceFor(s.key);
              const months = s.minutes / 60 / hoursPerMonth;
              return (
                <li key={s.key} className="watch-services__row" data-active={s.subscribed}>
                  <span className="watch-services__badge">
                    {provider?.logoUrl ? (
                      <img className="watch-services__logo" src={provider.logoUrl} alt="" />
                    ) : (
                      <span className="watch-services__logo" aria-hidden="true" />
                    )}
                    <span className="watch-services__count" aria-hidden="true">
                      {s.titles.length}
                    </span>
                  </span>
                  <div className="watch-services__head">
                    <p className="watch-services__name">
                      {provider?.name ?? s.key}
                      {s.subscribed && <span className="watch-services__tag">Subscribed</span>}
                    </p>
                    {/* The badge shows the count; this says it aloud. */}
                    <p className="watch-services__figures">
                      <span className="sr-only">
                        {s.titles.length} {s.titles.length === 1 ? "title" : "titles"}
                        {s.minutes > 0 ? ", " : ""}
                      </span>
                      {s.minutes > 0 && (
                        <>
                          {s.estimated ? "about " : ""}
                          {formatHours(s.minutes)} · {formatMonths(months)}
                        </>
                      )}
                    </p>
                  </div>
                  <p className="watch-services__ready" data-state={s.ready.state}>
                    {readyLine(s.ready, today)}
                  </p>
                  {/* Soonest first, so the list reads as a timeline. */}
                  <ul className="watch-services__titles">
                    {s.titles.map((t) => (
                      <li key={t.id}>
                        {/* Mouse shortcut to the dialog; keyboard users have
                            the poster below. */}
                        <span className="opens-dialog" onClick={() => setOpenId(t.id)}>
                          {t.title}
                        </span>
                        <span className="watch-services__when">
                          {t.arrivesOn
                            ? `Arrives ${when(t.arrivesOn, today)}`
                            : t.ready.state === "now" || !t.nextSeason
                              ? "Out now"
                              : seasonLine(t.nextSeason, today)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          {unhosted.length > 0 && (
            <p className="watch-services__unhosted">
              <strong>No service announced yet:</strong> {listTitles(unhosted)}.
            </p>
          )}
          {total.missing > 0 && (
            <p className="watch-services__note">
              {total.missing} {total.missing === 1 ? "title has" : "titles have"} no runtime data
              yet and {total.missing === 1 ? "isn't" : "aren't"} counted in the hours.
            </p>
          )}
        </Panel>
      )}

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
