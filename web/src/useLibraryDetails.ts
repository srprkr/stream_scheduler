import { skipToken, useQuery } from "@apollo/client/react";

import { graphql } from "./generated";
import type { LibraryDetailsQuery } from "./generated/graphql";

/**
 * Everything the library page shows about its titles, for both shelves, in
 * one request: mediaItems batches every id through the server's loaders.
 */
const LIBRARY_DETAILS = graphql(`
  query LibraryDetails($ids: [ID!]!) {
    mediaItems(ids: $ids) {
      id
      totalRuntime {
        minutes
        estimated
      }
      availableOn {
        id
        slug
        name
        logoUrl(size: SMALL)
      }
    }
  }
`);

export type LibraryDetail = NonNullable<LibraryDetailsQuery["mediaItems"][number]>;

/**
 * Details keyed by id, so each part of the page picks out the titles it needs.
 *
 * The ids are sorted before they become variables. Shelves list newest first,
 * so moving a title between them reorders the ids without changing the set -
 * and Apollo caches by variables, so an unsorted list would refetch for
 * nothing.
 */
export function useLibraryDetails(ids: readonly string[]) {
  const { data, previousData, loading } = useQuery(
    LIBRARY_DETAILS,
    ids.length > 0 ? { variables: { ids: [...ids].sort() } } : skipToken,
  );
  // The previous result stays up while a changed shelf refetches.
  const items = (data ?? previousData)?.mediaItems ?? [];
  const byId = new Map<string, LibraryDetail>();
  for (const item of items) if (item) byId.set(item.id, item);
  return { byId, loading: loading && byId.size === 0 };
}
