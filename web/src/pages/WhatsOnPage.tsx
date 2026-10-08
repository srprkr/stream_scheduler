import { skipToken, useQuery } from "@apollo/client/react";
import { useState } from "react";

import { BrowseFilters } from "../components/BrowseFilters";
import { CatalogTile } from "../components/CatalogTile";
import { FilterInput } from "../components/FilterInput";
import { SearchScope } from "../components/SearchScope";
import { WatchlistMini } from "../components/WatchlistMini";
import { TitleDialog } from "../components/TitleDialog";
import { graphql } from "../generated";
import type { CatalogQuery, CatalogSort } from "../generated/graphql";
import { useDebounced } from "../hooks/useDebounced";
import { useLibrary } from "../hooks/useLibrary";
import { useBrowseFilters, useSearchScope, type Kind } from "../hooks/useBrowseFilters";
import { mergeCatalog, selectedLists } from "../lib/catalog";
import { passesFilters, type TitleFilters } from "../lib/score";

const CATALOG = graphql(`
  query Catalog(
    $providerSlugs: [String!]!
    $kind: MediaKind!
    $sort: CatalogSort
    $after: String
    $minScore: Float
    $fromYear: Int
    $toYear: Int
  ) {
    catalog(
      providerSlugs: $providerSlugs
      kind: $kind
      sort: $sort
      after: $after
      minScore: $minScore
      fromYear: $fromYear
      toYear: $toYear
    ) {
      nextCursor
      items {
        __typename
        id
        title
        posterUrl(size: MEDIUM)
        onDisc
        ...ScoreFields
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

/**
 * Films out on disc that no tracked service streams: the same fields as the
 * catalogue, so they render with the same tile.
 */
const DISC_CATALOG = graphql(`
  query DiscCatalog(
    $sort: CatalogSort
    $after: String
    $minScore: Float
    $fromYear: Int
    $toYear: Int
  ) {
    discCatalog(
      sort: $sort
      after: $after
      minScore: $minScore
      fromYear: $fromYear
      toYear: $toYear
    ) {
      nextCursor
      items {
        __typename
        id
        title
        posterUrl(size: MEDIUM)
        onDisc
        ...ScoreFields
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

/**
 * Search, Selected: the selected services, and films and series out on disc
 * if On disc is picked. Same fields as the catalogue, so both lists render
 * with one tile.
 */
const SEARCH_MINE = graphql(`
  query SearchMyServices($query: String!, $providerSlugs: [String!]!, $onDisc: Boolean!) {
    searchMedia(query: $query, first: 20, providerSlugs: $providerSlugs, onDisc: $onDisc) {
      __typename
      id
      title
      posterUrl(size: MEDIUM)
      onDisc
      ...ScoreFields
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

/** Search, Everywhere: every title, wherever it's watched - or nowhere. */
const SEARCH_ALL = graphql(`
  query SearchEverywhere($query: String!) {
    searchMedia(query: $query, first: 20) {
      __typename
      id
      title
      posterUrl(size: MEDIUM)
      onDisc
      ...ScoreFields
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
  { value: "OLDEST", label: "Oldest" },
];

/** Minimum TMDB score; "" is any. */
const SCORES = [
  { value: "", label: "Any score" },
  { value: "6", label: "6+" },
  { value: "7", label: "7+" },
  { value: "8", label: "8+" },
];

/** First released in; "" is any. Each is "from-to", either end open. */
const DECADES = [
  { value: "", label: "Any year" },
  ...[2020, 2010, 2000, 1990, 1980, 1970].map((d) => ({
    value: `${d}-${d + 9}`,
    label: `${d}s`,
  })),
  { value: "-1969", label: "Before 1970" },
];

/** A DECADES value as the filters' year range. */
function yearRange(value: string): { fromYear: number | null; toYear: number | null } {
  const [from, to] = value.split("-");
  return { fromYear: from ? Number(from) : null, toYear: to ? Number(to) : null };
}

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
  const { slugs, kinds, disc } = filters;
  const [searchScope, setSearchScope] = useSearchScope();
  const hasWatchlist = useLibrary().some((e) => e.shelf === "watchlist");
  const [sort, setSort] = useState<CatalogSort>("POPULAR");
  const [minScore, setMinScore] = useState("");
  const [decade, setDecade] = useState("");
  const titleFilters: TitleFilters = {
    minScore: minScore ? Number(minScore) : null,
    ...yearRange(decade),
  };
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
      ? { variables: { providerSlugs, kind, sort, ...titleFilters } }
      : skipToken;
  const seriesQuery = useQuery(CATALOG, variables("SERIES"));
  const filmsQuery = useQuery(CATALOG, variables("MOVIE"));
  // Films out on disc: films only, since TMDB has no disc data for series.
  const discOn = disc && kinds.includes("MOVIE") && !searching;
  const discQuery = useQuery(
    DISC_CATALOG,
    discOn ? { variables: { sort, ...titleFilters } } : skipToken,
  );
  // Only the selected types count, whatever the queries still hold: a
  // skipped query keeps its last result in Apollo 4 (see lib/catalog.ts).
  // The same goes for services all switched off, and for On disc.
  const active = selectedLists(providerSlugs.length > 0 ? kinds : [], searching, {
    SERIES: seriesQuery,
    MOVIE: filmsQuery,
  });
  const queries = [active.SERIES, active.MOVIE].filter((q) => q !== undefined);
  const discList = discOn ? discQuery.data?.discCatalog : undefined;
  const { items, more } = mergeCatalog<Item>({
    SERIES: active.SERIES?.data?.catalog,
    MOVIE: active.MOVIE?.data?.catalog,
    DISC: discList,
  });
  const fromDisc = new Set(discList?.items.map((i) => i.id) ?? []);
  const lists = queries.filter((q) => q.data);
  const anyLoading = queries.some((q) => q.loading) || (discOn && discQuery.loading);
  const loading = !filters.ready || (anyLoading && items.length === 0);
  const error = [...queries, ...(discOn ? [discQuery] : [])].find((q) => q.error)?.error;

  // Searching replaces the catalogue in the grid; clearing the box brings
  // the catalogue back, with every page already loaded still in the cache.
  // Everywhere ignores the services and On disc, but not Series / Films.
  const everywhere = searchScope === "everywhere";
  const mine = useQuery(
    SEARCH_MINE,
    searching && !everywhere && (providerSlugs.length > 0 || disc)
      ? { variables: { query: term, providerSlugs, onDisc: disc } }
      : skipToken,
  );
  const all = useQuery(
    SEARCH_ALL,
    searching && everywhere ? { variables: { query: term } } : skipToken,
  );
  // Only the scope in use counts: the other query keeps its last result.
  const search = everywhere ? all : mine;
  // Search comes back unfiltered, so the score and year filters apply here.
  const results = ((search.data ?? search.previousData)?.searchMedia ?? []).filter(
    (r) =>
      kinds.includes(r.__typename === "Movie" ? "MOVIE" : "SERIES") &&
      passesFilters(r, titleFilters),
  );

  // The watchlist leads the grid, top right and two tiles wide, as the
  // watchlist stats do on Coming Soon: add a title below with + Watchlist
  // and it appears here at once. Left out while the watchlist is empty, so
  // the tiles start top left - and when On disc is all that's picked: a
  // grid of discs to buy isn't about what to stream next.
  const discOnly = disc && providerSlugs.length === 0;
  const watchlist = hasWatchlist && !discOnly && (
    <li className="grid__lead">
      <WatchlistMini onOpen={setOpenId} />
    </li>
  );

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const discAfter = discList?.nextCursor;
      await Promise.all([
        ...lists.map((q) => {
          const after = q.data?.catalog.nextCursor;
          return after ? q.fetchMore({ variables: { after } }) : null;
        }),
        discAfter ? discQuery.fetchMore({ variables: { after: discAfter } }) : null,
      ]);
    } finally {
      setLoadingMore(false);
    }
  };

  const nothingSelected =
    filters.ready && ((providerSlugs.length === 0 && !disc) || kinds.length === 0);
  // On disc alone, with Films off: nothing to show, and a different fix.
  const discWithoutFilms = disc && providerSlugs.length === 0 && !kinds.includes("MOVIE");
  const scope =
    providerSlugs.length === filters.providers.length
      ? "every service"
      : filters.allSubscribed
        ? "your services"
        : `${providerSlugs.length} ${providerSlugs.length === 1 ? "service" : "services"}`;
  const searched = everywhere
    ? "everywhere"
    : providerSlugs.length === 0
      ? "on disc"
      : `on ${scope}${disc ? " and on disc" : ""}`;
  // Everywhere searches whatever the row says; Selected needs something picked.
  const showSearch = searching && (everywhere || !nothingSelected);
  const lede =
    providerSlugs.length === 0 && disc
      ? "Films out on DVD or Blu-ray that no service streams: owning a copy is the way to watch them."
      : disc
        ? `Streaming now on ${scope}, and films out on disc that no service streams.`
        : `Streaming now on ${scope}.`;

  return (
    <>
      <header className="masthead">
        <h1>What's On</h1>
        <p>
          {lede}
          {filters.mySlugs.length === 0 &&
            " Tell us which services you pay for in Insights, and My Services narrows to them."}
        </p>
      </header>

      <div className="catalog__controls">
        <div className="search-row">
          <FilterInput value={text} onChange={setText} label="Search titles" />
          <SearchScope scope={searchScope} onChange={setSearchScope} />
        </div>
        <BrowseFilters filters={filters} />
        <div className="catalog__options">
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
          {/* TMDB's user score, and when it first came out - each list and
              search narrowed to match. */}
          <label className="catalog__sort">
            Score
            <select value={minScore} onChange={(e) => setMinScore(e.target.value)}>
              {SCORES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="catalog__sort">
            Released
            <select value={decade} onChange={(e) => setDecade(e.target.value)}>
              {DECADES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showSearch ? (
        <>
          <p className="state state--count" role="status">
            {search.loading && !search.data
              ? "Searching…"
              : `${results.length} ${results.length === 1 ? "result" : "results"} for “${term}” ${searched}`}
            {/* Nothing in what's selected: offer the wider search. */}
            {!everywhere && !search.loading && results.length === 0 && (
              <>
                {" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setSearchScope("everywhere")}
                >
                  Search everywhere instead
                </button>
              </>
            )}
          </p>
          <ul className="shelf__grid">
            {watchlist}
            {results.map((item) => (
              <CatalogTile
                key={item.id}
                item={item}
                onOpen={() => setOpenId(item.id)}
                // A disc is how to watch it when no service streams it.
                disc={item.onDisc && item.availableOn.length === 0}
                flagNotStreaming={everywhere}
              />
            ))}
          </ul>
        </>
      ) : discWithoutFilms ? (
        <p className="state">On disc lists films only: switch Films on to see them.</p>
      ) : nothingSelected ? (
        <p className="state">Pick at least one service and a type to see what's on.</p>
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
              <CatalogTile
                key={item.id}
                item={item}
                onOpen={() => setOpenId(item.id)}
                disc={fromDisc.has(item.id)}
              />
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
