import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

interface CatalogPageShape {
  items: readonly unknown[];
  nextCursor: string | null;
}

export const client = new ApolloClient({
  link: new HttpLink({ uri: "/graphql" }),
  cache: new InMemoryCache({
    typePolicies: {
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
  }),
});
