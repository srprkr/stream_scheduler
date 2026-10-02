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

const listOf = (saved: string) => saved.split(",").filter(Boolean);
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * The service and type filters What's On and Coming Soon share. Both pages
 * read and write the same saved selection, so a choice made on one is
 * there on the other, and on the next visit.
 *
 * Services behave like checkboxes; "All Services" and "All Subscribed" are
 * shortcuts that select a whole set, and show as on whenever the selection
 * matches it. The first visit starts on the user's services, or on all of
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

  const allSlugs = providers.map((p) => p.slug);
  const slugs = savedServices === ALL ? allSlugs : listOf(savedServices);
  const kinds = listOf(savedKinds).filter((k): k is Kind => KINDS.includes(k as Kind));

  const setSlugs = (next: readonly string[]) =>
    saveServices(allSlugs.length > 0 && sameSet(next, allSlugs) ? ALL : next.join(","));

  return {
    /** False until the service list loads: "every service" has no slugs yet. */
    ready: providers.length > 0,
    providers,
    mySlugs,
    slugs,
    kinds,
    allServices: savedServices === ALL || (allSlugs.length > 0 && sameSet(slugs, allSlugs)),
    allSubscribed: mySlugs.length > 0 && sameSet(slugs, mySlugs),
    selectAll: () => saveServices(ALL),
    selectSubscribed: () => setSlugs(mySlugs),
    toggleService: (slug: string) =>
      setSlugs(slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [...slugs, slug]),
    toggleKind: (kind: Kind) =>
      saveKinds(
        (kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind]).join(","),
      ),
  };
}

export type BrowseFilters = ReturnType<typeof useBrowseFilters>;
