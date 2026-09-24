import { skipToken, useQuery } from "@apollo/client/react";

import { watchTime } from "./format";
import { graphql } from "./generated";
import { Sheet } from "./Sheet";

/**
 * Fetched on open, not with the search: the search list selects summary
 * fields only, and this is the one title whose detail is actually wanted.
 */
const TITLE_DETAIL = graphql(`
  query TitleDetail($id: ID!) {
    mediaItem(id: $id) {
      __typename
      id
      title
      overview
      backdropUrl(size: LARGE)
      trailer {
        id
        name
        url
        embedUrl
      }
      ... on Series {
        seasonCount
      }
      ... on Movie {
        runtimeMinutes
      }
    }
  }
`);

/**
 * A title's detail, independent of any release. What a search hit opens:
 * most titles are not coming soon, so there is no date or service to show.
 */
export function TitleDialog({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { data } = useQuery(TITLE_DETAIL, id ? { variables: { id } } : skipToken);
  const media = id ? (data?.mediaItem ?? null) : null;

  const runtime =
    media?.__typename === "Movie" ? watchTime(media.runtimeMinutes) : null;
  const seasons = media?.__typename === "Series" ? media.seasonCount : null;

  return (
    <Sheet
      open={id !== null}
      media={media}
      onClose={onClose}
      badges={
        media && (
          <span className="badge badge--film">
            {media.__typename === "Movie" ? "Film" : "Series"}
          </span>
        )
      }
    >
      {(seasons || runtime) && (
        <dl className="facts">
          {seasons && (
            <div>
              <dt>Seasons</dt>
              <dd>{seasons}</dd>
            </div>
          )}
          {runtime && (
            <div>
              <dt>Runtime</dt>
              <dd>{runtime}</dd>
            </div>
          )}
        </dl>
      )}
    </Sheet>
  );
}
