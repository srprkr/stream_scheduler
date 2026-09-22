import { useQuery } from "@apollo/client/react";

import { ReleaseCard } from "./ReleaseCard";
import { graphql } from "./generated";

const RELEASE_FEED = graphql(`
  query ReleaseFeed($first: Int!, $timezone: String!) {
    releases(first: $first) {
      id
      availableFrom
      daysUntilRelease(timezone: $timezone)
      seasonNumber
      provider {
        id
        name
      }
      media {
        __typename
        id
        title
        posterUrl(size: MEDIUM)
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

  if (loading) return <p className="state">Loading the schedule…</p>;
  if (error) return <p className="state state--error">{error.message}</p>;

  const releases = data?.releases ?? [];
  if (releases.length === 0) {
    return <p className="state">Nothing scheduled in this window.</p>;
  }

  return (
    <ul className="grid">
      {releases.map((release) => (
        <ReleaseCard key={release.id} release={release} />
      ))}
    </ul>
  );
}
