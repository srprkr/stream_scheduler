import type { ServiceInfo } from "../components/WatchServices";
import { graphql } from "../generated";
import type { WatchlistTitle } from "../lib/watchlist";
import { useLibrary } from "./useLibrary";
import { useDetailsById } from "./useLibraryDetails";

/** The tile's fields, plus runtimes for the hours. */
const WATCHLIST_DETAILS = graphql(`
  query WatchlistDetails($ids: [ID!]!) {
    mediaItems(ids: $ids) {
      __typename
      id
      onDisc
      ...ScoreFields
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
        madeFor {
          ...ServiceLogo
        }
        nextSeason {
          ...SeasonScheduleFields
          watchTime {
            minutes
            estimated
          }
        }
      }
    }
  }
`);

/**
 * The watchlist with its details, as the Watchlist page and Coming Soon's
 * stats both read it: one request, shared through Apollo's cache.
 *
 * `entries` come from the library store, so they're there at once; `titles`
 * holds only those whose details have arrived, so a title added a moment
 * ago isn't counted as having no runtime or no service.
 */
export function useWatchlist() {
  const entries = useLibrary().filter((e) => e.shelf === "watchlist");
  const { byId, loading } = useDetailsById(
    WATCHLIST_DETAILS,
    entries.map((e) => e.id),
  );

  const titles = new Map<string, WatchlistTitle>();
  // Name and logo for each service the titles touch: tracked services by
  // slug, the rest by id - the keys watchlistByService rolls up under.
  const serviceInfo = new Map<string, ServiceInfo>();

  for (const entry of entries) {
    const detail = byId.get(entry.id);
    if (!detail) continue;
    const nextSeason = detail.__typename === "Series" ? detail.nextSeason : null;
    titles.set(entry.id, {
      id: entry.id,
      title: entry.title,
      runtime: detail.totalRuntime ?? null,
      // What's still to watch: the coming season, or the whole film.
      comingRuntime:
        detail.__typename === "Series"
          ? (nextSeason?.watchTime ?? null)
          : (detail.totalRuntime ?? null),
      availableOn: detail.availableOn,
      otherServices: detail.otherServices,
      upcoming: detail.upcoming.map((u) => ({
        slug: u.provider.slug,
        availableFrom: u.availableFrom,
        bingeableFrom: u.bingeableFrom,
      })),
      nextSeason,
      madeFor: detail.__typename === "Series" ? detail.madeFor : [],
    });
    const madeFor = detail.__typename === "Series" ? detail.madeFor : [];
    for (const p of [
      ...detail.availableOn,
      ...detail.upcoming.map((u) => u.provider),
      ...madeFor,
    ]) {
      serviceInfo.set(p.slug, { name: p.name, logoUrl: p.logoUrl });
    }
    for (const o of detail.otherServices)
      serviceInfo.set(o.id, { name: o.name, logoUrl: o.logoUrl });
  }

  return { entries, byId, titles, serviceInfo, loading };
}
