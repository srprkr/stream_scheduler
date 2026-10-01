import { Link } from "react-router";

import { library } from "../hooks/useLibrary";
import { useWatchlist } from "../hooks/useWatchlist";
import { localToday, seasonLine, when } from "../lib/seasons";
import { readyOrder, soonestArrival, titleReadiness, watchlistGroup } from "../lib/watchlist";
import { Panel } from "./Panel";
import { ProviderLogos } from "./ProviderLogos";

/**
 * The watchlist in brief, beside Your services and Renewals on What's On:
 * add titles from the grid below with + Watchlist, take them off here, and
 * the renewal advice next to it follows along - all three read the same
 * store. What's out now first, then what's coming, soonest first.
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
    <Panel id="watchlist-mini" className="watchlist-mini" title="Your watchlist">
      {rows.length === 0 ? (
        <p className="panel__lede">
          Nothing yet. Use + Watchlist on a streaming-only title below, and Renewals will plan
          around it.
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
            const services = detail
              ? [...detail.availableOn, ...detail.upcoming.map((u) => u.provider)].filter(
                  (p, i, all) => all.findIndex((x) => x.slug === p.slug) === i,
                )
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
