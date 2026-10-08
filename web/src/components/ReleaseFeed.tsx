import { skipToken, useQuery } from "@apollo/client/react";
import { useState, type ReactNode } from "react";

import { useSearchScope, type Kind } from "../hooks/useBrowseFilters";

import type { Arrival, Release } from "../lib/format";
import { groupByArrival } from "../lib/group";
import { matchesTitle } from "../lib/search";
import { FilterInput } from "./FilterInput";
import { ReleaseCard } from "./ReleaseCard";
import { ReleaseDialog } from "./ReleaseDialog";
import { SearchScope } from "./SearchScope";
import { graphql } from "../generated";

/** What a tile and its dialog show of a title, streaming or on disc alike. */
graphql(`
  fragment ReleaseMedia on MediaItem {
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
`);

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
        ...ReleaseMedia
      }
    }
  }
`);

const DISC_RELEASES = graphql(`
  query DiscReleases($timezone: String!) {
    discReleases(first: 50) {
      id
      availableFrom
      daysUntilRelease(timezone: $timezone)
      media {
        ...ReleaseMedia
      }
    }
  }
`);

/** One tile: a streaming arrival on its services, or a film coming out on disc. */
interface Entry {
  release: Arrival;
  providers: Release["provider"][];
  disc: boolean;
}

/**
 * The browser's own zone, handed to the server so `daysUntilRelease` is
 * counted from the viewer's calendar rather than UTC's. This is the whole
 * reason that field takes an argument.
 */
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function ReleaseFeed({
  slugs,
  disc,
  ready,
  kinds,
  filters,
  lead,
}: {
  /** Services to show arrivals on; a title on several shows if any match. */
  slugs: readonly string[];
  /** Whether to show films coming out on disc, too. */
  disc: boolean;
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
  const [searchScope, setSearchScope] = useSearchScope();
  const filtering = text.trim() !== "";
  // A title filter set to Everywhere looks past the selected services and
  // On disc to every arrival in the window. Series / Films still apply.
  const everywhere = filtering && searchScope === "everywhere";

  // The whole feed, filtered here: the server keeps it warm for every
  // service, so narrowing on the client costs nothing and any mix of
  // services works.
  const { data, loading, error } = useQuery(RELEASE_FEED, {
    variables: { first: 150, timezone },
  });

  // Disc releases are films, so they're asked for only with Films on - and
  // gated again below, since a skipped query keeps its last result.
  const discOn = (disc || everywhere) && kinds.includes("MOVIE");
  const discs = useQuery(DISC_RELEASES, discOn ? { variables: { timezone } } : skipToken);

  const releases = data?.releases ?? [];
  const streaming: Entry[] = groupByArrival(releases)
    .filter(
      (g) =>
        (everywhere || g.providers.some((p) => slugs.includes(p.slug))) &&
        kinds.includes(g.release.media.__typename === "Movie" ? "MOVIE" : "SERIES"),
    )
    .map((g) => ({ ...g, disc: false }));
  const onDisc: Entry[] = (discOn ? (discs.data?.discReleases ?? []) : []).map((d) => ({
    // Shaped like a film's Release: one sitting, no season.
    release: {
      ...d,
      seasonNumber: null,
      bingeableFrom: d.availableFrom,
      isFullDrop: true,
      episodeCount: null,
      watchTimeMinutes: d.media.__typename === "Movie" ? (d.media.runtimeMinutes ?? null) : null,
    },
    providers: [],
    disc: true,
  }));
  // Both lists come soonest first; a stable sort keeps each day's order.
  const entries = [...streaming, ...onDisc]
    .filter((e) => matchesTitle(e.release.media.title, text))
    .sort((a, b) => a.release.availableFrom.localeCompare(b.release.availableFrom));
  const busy = loading || (discOn && discs.loading);
  const failed = error ?? (discOn ? discs.error : undefined);

  const open = entries.find((e) => e.release.id === openId) ?? null;

  return (
    <>
      <div className="feed__controls">
        <div className="search-row">
          <FilterInput value={text} onChange={setText} label="Filter by title" />
          <SearchScope scope={searchScope} onChange={setSearchScope} />
        </div>
        {filters}
      </div>
      {filtering && !busy && (
        <p className="state state--count" role="status">
          {entries.length} {entries.length === 1 ? "match" : "matches"} for “{text.trim()}”
          {everywhere && " everywhere"}
          {/* Nothing in what's selected: offer the wider search. */}
          {!everywhere && entries.length === 0 && (
            <>
              {" "}
              <button
                type="button"
                className="link-button"
                onClick={() => setSearchScope("everywhere")}
              >
                Search everywhere instead
              </button>
            </>
          )}
        </p>
      )}

      {(busy || !ready) && <p className="state">Loading the schedule…</p>}
      {failed && <p className="state state--error">{failed.message}</p>}
      {ready && !busy && !failed && entries.length === 0 && (
        <p className="state">Nothing scheduled in this window for this selection.</p>
      )}

      <ul className="grid">
        {/* Placed top right, two tiles wide, by CSS; the tiles fill in
            around it. */}
        {lead && <li className="grid__lead">{lead}</li>}
        {entries.map(({ release, providers, disc }) => (
          <ReleaseCard
            key={release.id}
            release={release}
            providers={providers}
            disc={disc}
            onOpen={() => setOpenId(release.id)}
          />
        ))}
      </ul>

      <ReleaseDialog
        release={open?.release ?? null}
        providers={open?.providers ?? []}
        disc={open?.disc ?? false}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
