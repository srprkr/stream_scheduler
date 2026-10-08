import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

interface CatalogPageShape {
  items: readonly unknown[];
  nextCursor: string | null;
}

/** A first page replaces the list; a later page is appended to it. */
function appendPages(
  existing: CatalogPageShape | undefined,
  incoming: CatalogPageShape,
  { args }: { args: Record<string, unknown> | null },
): CatalogPageShape {
  if (!existing || !args?.["after"]) return incoming;
  return { ...incoming, items: [...existing.items, ...incoming.items] };
}

/**
 * The client's cache rules. Exported separately from the client so tests can
 * build the same cache without a network link.
 */
export function createCache(): InMemoryCache {
  return new InMemoryCache({
    // Which types implement each interface. Without it the cache can't tell
    // that a fragment on MediaItem applies to a Movie or a Series, and reads
    // its fields back as missing.
    possibleTypes: { MediaItem: ["Movie", "Series"] },
    typePolicies: {
      // Apollo files every object with an id under one shared key,
      // "Plan:premium". But plan ids are only unique within a service -
      // Netflix, Peacock, Disney+, HBO Max and Paramount+ all have a
      // "premium" - so five different plans would share one entry, and the
      // last one loaded would overwrite the rest. keyFields: false keeps each
      // plan inside the provider it belongs to instead.
      Plan: { keyFields: false },

      Query: {
        fields: {
          catalog: {
            // One cached list per filter combination. `after` is left out on
            // purpose: every page of the same list lands in the same entry.
            keyArgs: ["providerSlugs", "kind", "sort"],
            merge: appendPages,
          },
          // Films out on disc page the same way, one list per order.
          discCatalog: { keyArgs: ["sort"], merge: appendPages },
        },
      },
    },
  });
}

export const client = new ApolloClient({
  link: new HttpLink({ uri: "/graphql" }),
  cache: createCache(),
});
