import { useQuery } from "@apollo/client/react";

import { graphql } from "../generated";
import { useStored } from "./useStored";
import { useSubscriptions } from "./useSubscriptions";

const SERVICE_NAMES = graphql(`
  query ServiceNames {
    providers {
      ...ServiceLogo
    }
  }
`);

export type Kind = "SERIES" | "MOVIE";
export const KINDS: readonly Kind[] = ["SERIES", "MOVIE"];

/** Saved in place of a list: every service, including any added later. */
const ALL = "all";

/**
 * Saved in the services list beside the slugs: films out on disc that no
 * service streams (What's On), or coming out on disc (Coming Soon). Not a
 * service, but picked like one, so a disc is one more place to watch.
 */
export const DISC = "disc";

const listOf = (saved: string) => saved.split(",").filter(Boolean);
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * The service and type filters What's On and Coming Soon share. Both pages
 * read and write the same saved selection, so a choice made on one is
 * there on the other, and on the next visit.
 *
 * Services - and On disc - behave like checkboxes; "My Services" is a
 * shortcut that selects the user's set, and shows as on whenever the
 * selection matches it. "Select All" selects every service and On disc -
 * and once they all are, turns into "Clear All", which clears them, so
 * picking just one is two clicks rather than one per service to turn off. The first visit starts on the user's services, or on all of
 * them if they haven't said which they pay for.
 */
export function useBrowseFilters() {
  const providers = [...(useQuery(SERVICE_NAMES).data?.providers ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const mySlugs = useSubscriptions().map((s) => s.slug);
  const [savedServices, saveServices] = useStored<string>(
    "stream-scheduler:browse-services",
    mySlugs.length > 0 ? mySlugs.join(",") : ALL,
    (s) => s,
  );
  const [savedKinds, saveKinds] = useStored<string>(
    "stream-scheduler:browse-kinds",
    KINDS.join(","),
    (s) => s,
  );

  // Everything the row can select: every service, then On disc.
  const everything = [...providers.map((p) => p.slug), DISC];
  const selected = savedServices === ALL ? everything : listOf(savedServices);
  const slugs = selected.filter((s) => s !== DISC);
  const disc = selected.includes(DISC);
  const kinds = listOf(savedKinds).filter((k): k is Kind => KINDS.includes(k as Kind));

  const select = (next: readonly string[]) =>
    saveServices(providers.length > 0 && sameSet(next, everything) ? ALL : next.join(","));
  const toggle = (slug: string) =>
    select(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);

  return {
    /** False until the service list loads: "every service" has no slugs yet. */
    ready: providers.length > 0,
    providers,
    mySlugs,
    /** The services selected - never DISC, which is `disc`. */
    slugs,
    /** Whether On disc is selected. */
    disc,
    kinds,
    allServices: savedServices === ALL || (providers.length > 0 && sameSet(selected, everything)),
    allSubscribed: mySlugs.length > 0 && !disc && sameSet(slugs, mySlugs),
    /** The same two, judged by the services alone: for a page without On disc. */
    everyService:
      providers.length > 0 &&
      sameSet(
        slugs,
        providers.map((p) => p.slug),
      ),
    myServicesOnly: mySlugs.length > 0 && sameSet(slugs, mySlugs),
    selectAll: () => saveServices(ALL),
    selectNone: () => saveServices(""),
    selectSubscribed: () => select(mySlugs),
    toggleService: toggle,
    toggleDisc: () => toggle(DISC),
    toggleKind: (kind: Kind) =>
      saveKinds(
        (kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind]).join(","),
      ),
  };
}

export type BrowseFilters = ReturnType<typeof useBrowseFilters>;

export type SearchScope = "selected" | "everywhere";

/**
 * What a search on What's On or Coming Soon covers: what the filter row has
 * selected, or every title wherever it's watched. Remembered, and shared by
 * both pages like the filters.
 */
export function useSearchScope() {
  return useStored<SearchScope>("stream-scheduler:search-scope", "selected", (s) =>
    s === "selected" || s === "everywhere" ? s : undefined,
  );
}
