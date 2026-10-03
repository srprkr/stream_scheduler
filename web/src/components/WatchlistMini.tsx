import { Link } from "react-router";

import { library } from "../hooks/useLibrary";
import { useWatchlist } from "../hooks/useWatchlist";
import { localToday, seasonLine, when } from "../lib/seasons";
import { readyOrder, soonestArrival, titleReadiness, watchlistGroup } from "../lib/watchlist";
import { Panel } from "./Panel";
import { ProviderLogos } from "./ProviderLogos";

/**
 * The watchlist in brief, among What's On's tiles: add titles from the grid
 * with + Watchlist, take them off here - both read the same store, so it
 * updates at once. What's out now first, then what's coming, soonest first.
 * What's On leaves it out while the watchlist is empty.
 */
export function WatchlistMini({ onOpen }: { onOpen: (id: string) => void }) {
  const today = localToday();
  const { entries, byId, titles } = useWatchlist();

  const rows = entries
    .map((entry) => {
      const t = titles.get(entry.id);
      const group = t ? watchlistGroup(t, today) : "now";
      const order = t && group === "coming" ? readyOrder(titleReadiness(t, today)) : 0;
      return { entry, t, group, order };
    })
    // Out now (order 0) keeps the shelf's newest-first order; coming follows.
    .sort((a, b) => a.order - b.order);

  return (
    <Panel
      id="watchlist-mini"
      className="watchlist-mini"
      title="Your watchlist"
      // A fixed slot among the tiles: folding it would leave an empty box.
      collapsible={false}
    >
      {rows.length === 0 ? (
        <p className="panel__lede">
          Nothing yet. Use + Watchlist on a streaming-only title, and it shows up here.
        </p>
      ) : (
        <ul className="watchlist-mini__list">
          {rows.map(({ entry, t, group }) => {
            const detail = byId.get(entry.id);
            const arrival =
              t && !t.nextSeason && t.availableOn.length === 0 ? soonestArrival(t) : null;
            const status = !t
              ? ""
              : arrival
                ? `Arrives ${when(arrival, today)}`
                : group === "now" || !t.nextSeason
                  ? "Out now"
                  : seasonLine(t.nextSeason, today);
            // Where it streams; for a title still coming, where it's going
            // too. A title out now shows where it's out - plus, for a season
            // just premiered, its own service while watch data catches up.
            const services = detail
              ? [
                  ...detail.availableOn,
                  ...(group === "coming"
                    ? [
                        ...detail.upcoming.map((u) => u.provider),
                        ...(detail.__typename === "Series" ? detail.madeFor : []),
                      ]
                    : detail.__typename === "Series" && detail.nextSeason
                      ? detail.madeFor
                      : []),
                ].filter((p, i, all) => all.findIndex((x) => x.slug === p.slug) === i)
              : [];
            return (
              <li key={entry.id} className="watchlist-mini__row">
                <ProviderLogos providers={services} />
                <div className="watchlist-mini__text">
                  {/* Mouse shortcut to the dialog; keyboard users reach it
                      from the title's tile or the Watchlist page. */}
                  <span className="opens-dialog" onClick={() => onOpen(entry.id)}>
                    {entry.title}
                  </span>
                  {status && <span className="watchlist-mini__status">{status}</span>}
                </div>
                <button
                  type="button"
                  className="watchlist-mini__remove"
                  aria-label={`Remove ${entry.title} from your watchlist`}
                  title="Remove from watchlist"
                  onClick={() => library.shelve(entry, null)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Link to="/watchlist" className="watchlist-mini__more">
        Open the Watchlist page
      </Link>
    </Panel>
  );
}
