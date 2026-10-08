import { useQuery } from "@apollo/client/react";
import { useState, type ReactNode } from "react";

import { useSearchScope, type Kind } from "../hooks/useBrowseFilters";

import { groupByArrival } from "../lib/group";
import { matchesTitle } from "../lib/search";
import { FilterInput } from "./FilterInput";
import { ReleaseCard } from "./ReleaseCard";
import { ReleaseDialog } from "./ReleaseDialog";
import { SearchScope } from "./SearchScope";
import { graphql } from "../generated";

/** What a tile and its dialog show of a title. */
graphql(`
  fragment ReleaseMedia on MediaItem {
    __typename
    id
    title
    onDisc
    ...ScoreFields
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
  const [searchScope, setSearchScope] = useSearchScope();
  const filtering = text.trim() !== "";
  // A title filter set to Everywhere looks past the selected services to
  // every arrival in the window. Series / Films still apply.
  const everywhere = filtering && searchScope === "everywhere";

  // The whole feed, filtered here: the server keeps it warm for every
  // service, so narrowing on the client costs nothing and any mix of
  // services works.
  const { data, loading, error } = useQuery(RELEASE_FEED, {
    variables: { first: 150, timezone },
  });

  const releases = data?.releases ?? [];
  const entries = groupByArrival(releases).filter(
    (g) =>
      (everywhere || g.providers.some((p) => slugs.includes(p.slug))) &&
      kinds.includes(g.release.media.__typename === "Movie" ? "MOVIE" : "SERIES") &&
      matchesTitle(g.release.media.title, text),
  );
  const busy = loading;
  const failed = error;

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
        <p className="state">
          {/* On disc can still be picked on What's On; it isn't a service. */}
          {slugs.length === 0 && !everywhere
            ? "Pick a service to see what's coming to it. Upcoming disc titles can be searched from the Library page"
            : "Nothing scheduled in this window for this selection."}
        </p>
      )}

      <ul className="grid">
        {/* Placed top right, two tiles wide, by CSS; the tiles fill in
            around it. */}
        {lead && <li className="grid__lead">{lead}</li>}
        {entries.map(({ release, providers }) => (
          <ReleaseCard
            key={release.id}
            release={release}
            providers={providers}
            onOpen={() => setOpenId(release.id)}
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
