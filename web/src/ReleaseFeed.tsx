import { useState } from "react";
import { useQuery } from "@apollo/client/react";

import { ReleaseCard } from "./ReleaseCard";
import { ReleaseDialog } from "./ReleaseDialog";
import { graphql } from "./generated";

const RELEASE_FEED = graphql(`
  query ReleaseFeed($first: Int!, $timezone: String!) {
    releases(first: $first) {
      id
      availableFrom
      daysUntilRelease(timezone: $timezone)
      seasonNumber
      bingeableFrom
      isFullDrop
      episodeCount
      watchTimeMinutes
      provider {
        id
        name
      }
      media {
        __typename
        id
        title
        overview
        posterUrl(size: MEDIUM)
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
  }
`);

/**
 * The browser's own zone, handed to the server so `daysUntilRelease` is
 * counted from the viewer's calendar rather than UTC's. This is the whole
 * reason that field takes an argument.
 */
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function ReleaseFeed() {
  const { data, loading, error } = useQuery(RELEASE_FEED, {
    variables: { first: 24, timezone },
  });
    // Which release the dialog is showing. One dialog for the whole grid
  // rather than one per card, so only a single <dialog> is ever mounted.
  const [openId, setOpenId] = useState<string | null>(null);


  if (loading) return <p className="state">Loading the schedule…</p>;
  if (error) return <p className="state state--error">{error.message}</p>;

  const releases = data?.releases ?? [];
  if (releases.length === 0) {
    return <p className="state">Nothing scheduled in this window.</p>;
  }

  const open = releases.find((r) => r.id === openId) ?? null;

  return (
    <>
      <ul className="grid">
        {releases.map((release) => (
          <ReleaseCard
            key={release.id}
            release={release}
            onOpen={() => setOpenId(release.id)}
          />
        ))}
      </ul>
      <ReleaseDialog release={open} onClose={() => setOpenId(null)} />
    </>
  );

}
