import { useQuery } from "@apollo/client/react";
import { useState } from "react";

import { ProviderFilter } from "./ProviderFilter";
import { ReleaseCard } from "./ReleaseCard";
import { ReleaseDialog } from "./ReleaseDialog";
import { graphql } from "./generated";

const RELEASE_FEED = graphql(`
  query ReleaseFeed($first: Int!, $timezone: String!, $providerSlug: String) {
    releases(first: $first, providerSlug: $providerSlug) {
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
        slug
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
  // null means every service. It is also the default, so the feed opens on
  // the full slate and narrows from there.
  const [providerSlug, setProviderSlug] = useState<string | null>(null);
  // Which release the dialog is showing. One dialog for the whole grid
  // rather than one per card, so only a single <dialog> is ever mounted.
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, loading, error } = useQuery(RELEASE_FEED, {
    variables: { first: 150, timezone, providerSlug },
  });

  const releases = data?.releases ?? [];
  const open = releases.find((r) => r.id === openId) ?? null;

  return (
    <>
      <ProviderFilter selected={providerSlug} onSelect={setProviderSlug} />

      {loading && <p className="state">Loading the schedule…</p>}
      {error && <p className="state state--error">{error.message}</p>}
      {!loading && !error && releases.length === 0 && (
        <p className="state">Nothing scheduled in this window.</p>
      )}

      <ul className="grid">
        {releases.map((release) => (
          <ReleaseCard
            key={release.id}
            release={release}
            onOpen={() => setOpenId(release.id)}
            showProvider={providerSlug === null}
          />
        ))}
      </ul>

      <ReleaseDialog release={open} onClose={() => setOpenId(null)} />
    </>
  );
}
