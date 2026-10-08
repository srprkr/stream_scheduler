import { skipToken, useQuery } from "@apollo/client/react";
import type { TypedDocumentNode } from "@apollo/client";

import { graphql } from "../generated";
import type { LibraryDetailsQuery } from "../generated/graphql";

/**
 * Everything the library page shows about its titles, for both shelves, in
 * one request: mediaItems batches every id through the server's loaders.
 */
const LIBRARY_DETAILS = graphql(`
  query LibraryDetails($ids: [ID!]!) {
    mediaItems(ids: $ids) {
      id
      ...ScoreFields
      totalRuntime {
        minutes
        estimated
      }
      availableOn {
        ...ServiceLogo
      }
    }
  }
`);

export type LibraryDetail = NonNullable<LibraryDetailsQuery["mediaItems"][number]>;

/** The library page's details for the given titles. */
export function useLibraryDetails(ids: readonly string[]) {
  return useDetailsById(LIBRARY_DETAILS, ids);
}

/**
 * Any mediaItems query's results keyed by id, so each part of a page picks
 * out the titles it needs. The query decides the fields; this handles the
 * plumbing every such page shares.
 *
 * The ids are sorted before they become variables. Shelves list newest first,
 * so moving a title between them reorders the ids without changing the set -
 * and Apollo caches by variables, so an unsorted list would refetch for
 * nothing. The previous result stays up while a changed set refetches.
 */
export function useDetailsById<Item extends { id: string }>(
  query: TypedDocumentNode<{ mediaItems: readonly (Item | null)[] }, { ids: string[] }>,
  ids: readonly string[],
) {
  const { data, previousData, loading } = useQuery(
    query,
    ids.length > 0 ? { variables: { ids: [...ids].sort() } } : skipToken,
  );
  const byId = new Map<string, Item>();
  for (const item of (data ?? previousData)?.mediaItems ?? []) if (item) byId.set(item.id, item);
  return { byId, loading: loading && byId.size === 0 };
}
