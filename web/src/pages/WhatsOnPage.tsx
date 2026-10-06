import { skipToken, useQuery } from "@apollo/client/react";
import { useState } from "react";

import { BrowseFilters } from "../components/BrowseFilters";
import { CatalogTile } from "../components/CatalogTile";
import { FilterInput } from "../components/FilterInput";
import { WatchlistMini } from "../components/WatchlistMini";
import { TitleDialog } from "../components/TitleDialog";
import { graphql } from "../generated";
import type { CatalogQuery, CatalogSort } from "../generated/graphql";
import { useDebounced } from "../hooks/useDebounced";
import { useLibrary } from "../hooks/useLibrary";
import { useBrowseFilters, type Kind } from "../hooks/useBrowseFilters";
import { mergeCatalog, selectedLists } from "../lib/catalog";

const CATALOG = graphql(`
  query Catalog($providerSlugs: [String!]!, $kind: MediaKind!, $sort: CatalogSort, $after: String) {
    catalog(providerSlugs: $providerSlugs, kind: $kind, sort: $sort, after: $after) {
      nextCursor
      items {
        __typename
        id
        title
        posterUrl(size: MEDIUM)
        onDisc
        availableOn {
          ...ServiceLogo
        }
        ... on Series {
          nextSeason {
            ...SeasonScheduleFields
          }
        }
      }
    }
  }
`);

/** Same fields as the catalogue, so both lists render with one tile. */
const SEARCH_MINE = graphql(`
  query SearchMyServices($query: String!, $providerSlugs: [String!]!) {
    searchMedia(query: $query, first: 20, providerSlugs: $providerSlugs) {
      __typename
      id
      title
      posterUrl(size: MEDIUM)
      onDisc
      availableOn {
        ...ServiceLogo
      }
      ... on Series {
        nextSeason {
          ...SeasonScheduleFields
        }
      }
    }
  }
`);

/** Shorter than this matches too much to be useful, and still costs a request. */
const MIN_LENGTH = 2;

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "POPULAR", label: "Popular" },
  { value: "TOP_RATED", label: "Top rated" },
  { value: "NEWEST", label: "Newest" },
];

type Item = CatalogQuery["catalog"]["items"][number];

/**
 * Everything streaming now on the selected services, in one grid, and a
 * search across them. The filters are shared with Coming Soon.
 *
 * Upstream lists series and films separately, so with both types selected
 * the page asks for each and interleaves them; Load more fetches the next
 * page of each.
 */
export function WhatsOnPage() {
  const filters = useBrowseFilters();
  const { slugs, kinds } = filters;
  const hasWatchlist = useLibrary().some((e) => e.shelf === "watchlist");
  const [sort, setSort] = useState<CatalogSort>("POPULAR");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const term = useDebounced(text.trim(), 300);
  const searching = term.length >= MIN_LENGTH;
  const providerSlugs = [...slugs].sort();

  // One query per type, each skipped when its type is off (or a search is
  // showing instead). Same document, so each keeps its own cached pages.
  const variables = (kind: Kind) =>
    providerSlugs.length > 0 && kinds.includes(kind) && !searching
      ? { variables: { providerSlugs, kind, sort } }
      : skipToken;
  const seriesQuery = useQuery(CATALOG, variables("SERIES"));
  const filmsQuery = useQuery(CATALOG, variables("MOVIE"));
  // Only the selected types count, whatever the queries still hold: a
  // skipped query keeps its last result in Apollo 4 (see lib/catalog.ts).
  const active = selectedLists(kinds, searching, { SERIES: seriesQuery, MOVIE: filmsQuery });
  const queries = [active.SERIES, active.MOVIE].filter((q) => q !== undefined);
  const { items, more } = mergeCatalog<Item>({
    SERIES: active.SERIES?.data?.catalog,
    MOVIE: active.MOVIE?.data?.catalog,
  });
  const lists = queries.filter((q) => q.data);
  const loading = !filters.ready || (queries.some((q) => q.loading) && items.length === 0);
  const error = queries.find((q) => q.error)?.error;

  // Searching replaces the catalogue in the grid; clearing the box brings
  // the catalogue back, with every page already loaded still in the cache.
  const search = useQuery(
    SEARCH_MINE,
    searching && providerSlugs.length > 0
      ? { variables: { query: term, providerSlugs } }
      : skipToken,
  );
  const results = ((search.data ?? search.previousData)?.searchMedia ?? []).filter((r) =>
    kinds.includes(r.__typename === "Movie" ? "MOVIE" : "SERIES"),
  );

  // The watchlist leads the grid, top right and two tiles wide, as the
  // watchlist stats do on Coming Soon: add a title below with + Watchlist
  // and it appears here at once. Left out while the watchlist is empty, so
  // the tiles start top left.
  const watchlist = hasWatchlist && (
    <li className="grid__lead">
      <WatchlistMini onOpen={setOpenId} />
    </li>
  );

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      await Promise.all(
        lists.map((q) => {
          const after = q.data?.catalog.nextCursor;
          return after ? q.fetchMore({ variables: { after } }) : null;
        }),
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const nothingSelected = filters.ready && (providerSlugs.length === 0 || kinds.length === 0);
  const scope = filters.allServices
    ? "every service"
    : filters.allSubscribed
      ? "your services"
      : `${providerSlugs.length} ${providerSlugs.length === 1 ? "service" : "services"}`;

  return (
    <>
      <header className="masthead">
        <h1>What's On</h1>
        <p>
          Streaming now on {scope}.
          {filters.mySlugs.length === 0 &&
            " Tell us which services you pay for in Insights, and All Subscribed narrows to them."}
        </p>
      </header>

      <div className="catalog__controls">
        <FilterInput value={text} onChange={setText} label="Search these services" />
        <BrowseFilters filters={filters} />
        <label className="catalog__sort">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as CatalogSort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {nothingSelected ? (
        <p className="state">Pick at least one service and a type to see what's on.</p>
      ) : searching ? (
        <>
          <p className="state state--count" role="status">
            {search.loading && !search.data
              ? "Searching…"
              : `${results.length} ${results.length === 1 ? "result" : "results"} for “${term}” on ${scope}`}
          </p>
          <ul className="shelf__grid">
            {watchlist}
            {results.map((item) => (
              <CatalogTile key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
            ))}
          </ul>
        </>
      ) : (
        <>
          {loading && <p className="state">Loading what's on…</p>}
          {error && <p className="state state--error">{error.message}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="state">Nothing here yet for this combination.</p>
          )}
          <ul className="shelf__grid">
            {watchlist}
            {items.map((item) => (
              <CatalogTile key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
            ))}
          </ul>
          {more && (
            <button className="catalog__more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
