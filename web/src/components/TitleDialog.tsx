import { skipToken, useQuery } from "@apollo/client/react";

import { ProviderLogos } from "./ProviderLogos";
import { watchTime } from "../lib/format";
import { graphql } from "../generated";
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
      availableOn {
        id
        name
        logoUrl(size: SMALL)
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
      {media && (
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
          <div>
            <dt>Streams on</dt>
            {media.availableOn.length > 0 ? (
              <dd className="facts__services">
                <ProviderLogos providers={media.availableOn} />
                {media.availableOn.map((p) => p.name).join(", ")}
              </dd>
            ) : (
              <dd>Not on any tracked service</dd>
            )}
          </div>
        </dl>
      )}ProviderLogos, 

    </Sheet>
  );
}
