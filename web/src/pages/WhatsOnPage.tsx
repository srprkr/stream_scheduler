import { skipToken, useQuery } from "@apollo/client/react";
import { useState } from "react";
import { Link } from "react-router";

import { ProviderLogos } from "../components/ProviderLogos";
import { ShelfToggle } from "../components/ShelfToggle";
import { TitleDialog } from "../components/TitleDialog";
import { graphql } from "../generated";
import type { CatalogSort, MediaKind } from "../generated/graphql";
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
        availableOn {
          id
          slug
          name
          logoUrl(size: SMALL)
        }
      }
    }
  }
`);

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
 * Everything on the services the user pays for, in one grid. It reads their
 * services from the shared store, so ticking one on Home changes this list.
 */
export function WhatsOnPage() {
  const mine = useSubscriptions();
  const names = useQuery(SERVICE_NAMES).data?.providers ?? [];
  const [kind, setKind] = useState<MediaKind>("SERIES");
  const [sort, setSort] = useState<CatalogSort>("POPULAR");
  const [only, setOnly] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const mySlugs = mine.map((s) => s.slug).sort();
  // A service chosen and then unticked on Home no longer narrows anything.
  const narrowedTo = only && mySlugs.includes(only) ? only : null;
  const slugs = narrowedTo ? [narrowedTo] : mySlugs;

  const { data, loading, error, fetchMore } = useQuery(
    CATALOG,
    slugs.length > 0 ? { variables: { providerSlugs: slugs, kind, sort } } : skipToken,
  );
  const page = data?.catalog;

  if (mySlugs.length === 0) {
    return (
      <header className="masthead">
        <h1>What's On</h1>
        <p>
          <Link to="/">Tick the services you pay for</Link> and everything on
          them shows up here, in one place.
        </p>
      </header>
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

      <div className="catalog__controls">
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

      {loading && !page && <p className="state">Loading what's on…</p>}
      {error && <p className="state state--error">{error.message}</p>}
      {page && page.items.length === 0 && (
        <p className="state">Nothing here yet for this combination.</p>
      )}

      {/* The same tile as the library shelves: poster, where it streams,
          and Own / Want, so shopping is one click from browsing. */}
      <ul className="shelf__grid">
        {page?.items.map((item) => (
          <li key={item.id} className="shelf__item">
            <div className="shelf__services">
              <ProviderLogos providers={item.availableOn} />
            </div>
            <button className="shelf__open" onClick={() => setOpenId(item.id)}>
              {item.posterUrl ? (
                <img src={item.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="shelf__poster--empty" aria-hidden="true">
                  {item.title.slice(0, 1)}
                </div>
              )}
              <span className="shelf__name">{item.title}</span>
            </button>
            <ShelfToggle
              item={{
                id: item.id,
                kind: item.__typename,
                title: item.title,
                posterUrl: item.posterUrl ?? null,
              }}
            />
          </li>
        ))}
      </ul>

      {page?.nextCursor && (
        <button className="catalog__more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
