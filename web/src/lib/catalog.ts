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

/** Alternates two lists, so neither type is buried under a page of the other. */
export function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i] as T);
    if (i < b.length) out.push(b[i] as T);
  }
  return out;
}

/**
 * The grid What's On shows from the selected lists: series and films
 * interleaved, and whether either has another page to load.
 */
export function mergeCatalog<T>(lists: Partial<Record<Kind, CatalogList<T> | undefined>>): {
  items: T[];
  more: boolean;
} {
  return {
    items: interleave(lists.SERIES?.items ?? [], lists.MOVIE?.items ?? []),
    more: Boolean(lists.SERIES?.nextCursor || lists.MOVIE?.nextCursor),
  };
}
