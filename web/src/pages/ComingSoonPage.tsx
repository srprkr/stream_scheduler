import { BrowseFilters } from "../components/BrowseFilters";
import { ComingSoonStats } from "../components/ComingSoonStats";
import { ReleaseFeed } from "../components/ReleaseFeed";
import { useBrowseFilters } from "../hooks/useBrowseFilters";

export function ComingSoonPage() {
  const filters = useBrowseFilters();
  return (
    <>
      <header className="masthead">
        <h1>Coming Soon</h1>
        <p>
          Seasons and films arriving on different services in the next 90 days. Time your
          subscriptions around them.
        </p>
      </header>
      {/* The watchlist's numbers open the feed, among the tiles. */}
      <ReleaseFeed
        slugs={filters.slugs}
        ready={filters.ready}
        kinds={filters.kinds}
        // What's arriving on services only: a film to own on disc goes on
        // the wishlist, not here.
        filters={<BrowseFilters filters={filters} offerDisc={false} />}
        lead={<ComingSoonStats />}
      />
    </>
  );
}
