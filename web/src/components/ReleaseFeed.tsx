import { useQuery } from "@apollo/client/react";
import { useState, type ReactNode } from "react";

import type { Kind } from "../hooks/useBrowseFilters";

import { groupByArrival } from "../lib/group";
import { matchesTitle } from "../lib/search";
import { FilterInput } from "./FilterInput";
import { ReleaseCard } from "./ReleaseCard";
import { ReleaseDialog } from "./ReleaseDialog";
import { graphql } from "../generated";

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
        ...ServiceLogo
      }
      media {
        __typename
        id
        title
        onDisc
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

export function ReleaseFeed({
  slugs,
  ready,
  kinds,
  filters,
  lead,
}: {
  /** Services to show arrivals on; a title on several shows if any match. */
  slugs: readonly string[];
  /** False while the service list is still loading, so slugs may be empty. */
  ready: boolean;
  kinds: readonly Kind[];
  /** The shared filter row, drawn under the title filter. */
  filters: ReactNode;
  lead?: ReactNode;
}) {
  // Which release the dialog is showing. One dialog for the whole grid
  // rather than one per card, so only a single <dialog> is ever mounted.
  const [openId, setOpenId] = useState<string | null>(null);
  // Filters the feed already on screen: no request, so no debounce.
  const [text, setText] = useState("");

  // The whole feed, filtered here: the server keeps it warm for every
  // service, so narrowing on the client costs nothing and any mix of
  // services works.
  const { data, loading, error } = useQuery(RELEASE_FEED, {
    variables: { first: 150, timezone },
  });

  const releases = data?.releases ?? [];
  const groups = groupByArrival(releases).filter(
    (g) =>
      g.providers.some((p) => slugs.includes(p.slug)) &&
      kinds.includes(g.release.media.__typename === "Movie" ? "MOVIE" : "SERIES") &&
      matchesTitle(g.release.media.title, text),
  );
  const filtering = text.trim() !== "";

  const open = groups.find((g) => g.release.id === openId) ?? null;

  return (
    <>
      <div className="feed__controls">
        <FilterInput value={text} onChange={setText} label="Filter by title" />
        {filters}
      </div>
      {filtering && (
        <p className="state state--count" role="status">
          {groups.length} {groups.length === 1 ? "match" : "matches"} for “{text.trim()}”
        </p>
      )}

      {(loading || !ready) && <p className="state">Loading the schedule…</p>}
      {error && <p className="state state--error">{error.message}</p>}
      {ready && !loading && !error && groups.length === 0 && (
        <p className="state">Nothing scheduled in this window for this selection.</p>
      )}

      <ul className="grid">
        {/* Placed top right, two tiles wide, by CSS; the tiles fill in
            around it. */}
        {lead && <li className="grid__lead">{lead}</li>}
        {groups.map(({ release, providers }) => (
          <ReleaseCard
            key={release.id}
            release={release}
            providers={providers}
            onOpen={() => setOpenId(release.id)}
            showProvider={slugs.length > 1}
          />
        ))}
      </ul>

      <ReleaseDialog
        release={open?.release ?? null}
        providers={open?.providers ?? []}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
