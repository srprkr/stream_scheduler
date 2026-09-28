import { skipToken, useQuery } from "@apollo/client/react";
import { useState } from "react";

import { CatalogTile } from "../components/CatalogTile";
import { FilterInput } from "../components/FilterInput";
import { MyServices } from "../components/MyServices";
import { TitleDialog } from "../components/TitleDialog";
import { graphql } from "../generated";
import type { CatalogSort, MediaKind } from "../generated/graphql";
import { useDebounced } from "../hooks/useDebounced";
import { useSubscriptions } from "../hooks/useSubscriptions";

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
          id
          slug
          name
          logoUrl(size: SMALL)
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
        id
        slug
        name
        logoUrl(size: SMALL)
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

/** Shorter than this matches too much to be useful, and still costs a request. */
const MIN_LENGTH = 2;

const SERVICE_NAMES = graphql(`
  query ServiceNames {
    providers {
      id
      slug
      name
    }
  }
`);

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "POPULAR", label: "Popular" },
  { value: "TOP_RATED", label: "Top rated" },
  { value: "NEWEST", label: "Newest" },
];

/**
 * Everything on the services the user pays for, in one grid, and a search
 * across them. It reads their services from the shared store, so ticking one
 * anywhere changes what this page shows.
 */
export function WhatsOnPage() {
  const mine = useSubscriptions();
  const names = useQuery(SERVICE_NAMES).data?.providers ?? [];
  const [kind, setKind] = useState<MediaKind>("SERIES");
  const [sort, setSort] = useState<CatalogSort>("POPULAR");
  const [only, setOnly] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const term = useDebounced(text.trim(), 300);
  const searching = term.length >= MIN_LENGTH;

  const mySlugs = mine.map((s) => s.slug).sort();
  // A service chosen and then unticked no longer narrows anything.
  const narrowedTo = only && mySlugs.includes(only) ? only : null;
  const slugs = narrowedTo ? [narrowedTo] : mySlugs;

  const { data, loading, error, fetchMore } = useQuery(
    CATALOG,
    slugs.length > 0 ? { variables: { providerSlugs: slugs, kind, sort } } : skipToken,
  );
  const page = data?.catalog;

  // Searching replaces the catalogue in the grid; clearing the box brings
  // the catalogue back, with every page already loaded still in the cache.
  const search = useQuery(
    SEARCH_MINE,
    searching && slugs.length > 0 ? { variables: { query: term, providerSlugs: slugs } } : skipToken,
  );
  const results = (search.data ?? search.previousData)?.searchMedia;

  // Nothing to browse until the user says what they pay for, so the page
  // asks right here rather than sending them somewhere else to answer.
  if (mySlugs.length === 0) {
    return (
      <>
        <header className="masthead">
          <h1>What's On</h1>
          <p>Tick the services you pay for, and everything on them shows up here.</p>
        </header>
        <MyServices />
      </>
    );
  }

  const loadMore = async () => {
    if (!page?.nextCursor) return;
    setLoadingMore(true);
    try {
      await fetchMore({ variables: { after: page.nextCursor } });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <header className="masthead">
        <h1>What's On</h1>
        <p>
          Streaming now on your {mySlugs.length}{" "}
          {mySlugs.length === 1 ? "service" : "services"}.
        </p>
      </header>

      <details className="catalog__services">
        <summary>Your services and plans</summary>
        <MyServices />
      </details>

      <div className="catalog__controls">
        <FilterInput value={text} onChange={setText} label="Search your services" />

        <div className="tags" role="group" aria-label="Services">
          <button
            className={`tag${narrowedTo === null ? " tag--on" : ""}`}
            aria-pressed={narrowedTo === null}
            onClick={() => setOnly(null)}
          >
            All mine
          </button>
          {mySlugs.map((slug) => (
            <button
              key={slug}
              className={`tag${narrowedTo === slug ? " tag--on" : ""}`}
              aria-pressed={narrowedTo === slug}
              onClick={() => setOnly(slug)}
            >
              {names.find((n) => n.slug === slug)?.name ?? slug}
            </button>
          ))}
        </div>

        <div className="catalog__options">
          <div className="tags" role="group" aria-label="Kind">
            {(["SERIES", "MOVIE"] as const).map((k) => (
              <button
                key={k}
                className={`tag${kind === k ? " tag--on" : ""}`}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {k === "SERIES" ? "Series" : "Films"}
              </button>
            ))}
          </div>
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
      </div>

      {searching ? (
        <>
          <p className="state state--count" role="status">
            {search.loading && !results
              ? "Searching…"
              : `${results?.length ?? 0} ${results?.length === 1 ? "result" : "results"} for “${term}” on ${
                  narrowedTo ? "this service" : "your services"
                }`}
          </p>
          <ul className="shelf__grid">
            {results?.map((item) => (
              <CatalogTile key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
            ))}
          </ul>
        </>
      ) : (
        <>
          {loading && !page && <p className="state">Loading what's on…</p>}
          {error && <p className="state state--error">{error.message}</p>}
          {page && page.items.length === 0 && (
            <p className="state">Nothing here yet for this combination.</p>
          )}
          <ul className="shelf__grid">
            {page?.items.map((item) => (
              <CatalogTile key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
            ))}
          </ul>
          {page?.nextCursor && (
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
