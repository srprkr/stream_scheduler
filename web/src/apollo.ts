import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

interface CatalogPageShape {
  items: readonly unknown[];
  nextCursor: string | null;
}

/**
 * The client's cache rules. Exported separately from the client so tests can
 * build the same cache without a network link.
 */
export function createCache(): InMemoryCache {
  return new InMemoryCache({
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
            // A first page replaces the list; a later page is appended to it.
            merge(existing: CatalogPageShape | undefined, incoming: CatalogPageShape, { args }) {
              if (!existing || !args?.["after"]) return incoming;
              return { ...incoming, items: [...existing.items, ...incoming.items] };
            },
          },
        },
      },
    },
  });
}

export const client = new ApolloClient({
  link: new HttpLink({ uri: "/graphql" }),
  cache: createCache(),
});
