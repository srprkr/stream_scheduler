import type { Kind } from "../hooks/useBrowseFilters";

/** One page-set of a catalogue list, as the Catalog query returns it. */
export interface CatalogList<T> {
  items: readonly T[];
  nextCursor: string | null;
}

/**
 * The per-type results that should count right now: only types that are
 * selected, and none while a search replaces the grid.
 *
 * This is the guard against Apollo 4's skip behaviour: a skipped query sits
 * on "standby" and keeps returning its last result, so What's On can't rely
 * on skipping to hide a type the user switched off. Whatever the queries
 * hold, a type that isn't selected gets nothing here.
 */
export function selectedLists<Q>(
  kinds: readonly Kind[],
  searching: boolean,
  byKind: Record<Kind, Q>,
): Partial<Record<Kind, Q>> {
  if (searching) return {};
  const out: Partial<Record<Kind, Q>> = {};
  for (const kind of kinds) out[kind] = byKind[kind];
  return out;
}

/** Takes from each list in turn, so none is buried under a page of another. */
export function interleave<T>(...lists: readonly (readonly T[])[]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (i < list.length) out.push(list[i] as T);
  }
  return out;
}

/** What's On's lists: each type on the services, and each type out on disc. */
export type ListKey = Kind | "DISC_SERIES" | "DISC_MOVIE";

/**
 * The grid What's On shows from the selected lists: series and films, on the
 * services and out on disc, interleaved - and whether any has another page.
 */
export function mergeCatalog<T>(lists: Partial<Record<ListKey, CatalogList<T> | undefined>>): {
  items: T[];
  more: boolean;
} {
  return {
    items: interleave(
      lists.SERIES?.items ?? [],
      lists.MOVIE?.items ?? [],
      lists.DISC_SERIES?.items ?? [],
      lists.DISC_MOVIE?.items ?? [],
    ),
    more: Object.values(lists).some((l) => Boolean(l?.nextCursor)),
  };
}
