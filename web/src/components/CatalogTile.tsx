import { ProviderLogos, type LogoProvider } from "./ProviderLogos";
import { ShelfToggle } from "./ShelfToggle";

import { localToday, seasonLine, type SeasonSchedule } from "../lib/seasons";

export interface CatalogItem {
  __typename: "Movie" | "Series";
  id: string;
  title: string;
  /** Series only, and only when one is coming or airing. */
  nextSeason?: SeasonSchedule | null;
  posterUrl?: string | null;
  /** Undefined while it's still loading: the slot keeps its height, empty. */
  availableOn: readonly LogoProvider[] | undefined;
  /**
   * Services it's still to arrive on, shown after the current ones just the
   * same - where it sits (a "Coming soon" section) already says when.
   */
  comingTo?: readonly LogoProvider[];
  /** On DVD or Blu-ray: Own/Want if so, Watchlist if it's streaming only. */
  onDisc: boolean;
}

/**
 * The poster tile used everywhere a title is shown in a grid: where it
 * streams, the poster, the Own / Want / Watchlist toggles, and the title.
 * The library shelves, What's On's catalogue and search, and the watchlist
 * all use it, so shopping is one click from browsing.
 */
export function CatalogTile({
  item,
  onOpen,
  note,
  inLibrary = false,
  flagNotStreaming = false,
  disc = false,
}: {
  item: CatalogItem;
  onOpen: () => void;
  /** A line under the title in place of the season line, e.g. a film's arrival. */
  note?: string | null;
  /** On a library shelf: the toggles drop to Own (and ★ while wanted). */
  inLibrary?: boolean;
  /**
   * Say "Not streaming" when it's on no service. Worth saying on the
   * library, where it means only the user's copy plays it.
   */
  flagNotStreaming?: boolean;
  /** Mark it On disc, after any services: listed because a disc is how to watch it. */
  disc?: boolean;
}) {
  // Where it streams, then where it's coming - each service once: a new
  // season of a show on Prime is still just Prime.
  const logos = [...(item.availableOn ?? []), ...(item.comingTo ?? [])].filter(
    (p, i, all) => all.findIndex((x) => x.id === p.id) === i,
  );
  return (
    <li className="shelf__item">
      {/* Renders even while loading, at a fixed height, so every poster in
          a row starts on the same line whatever its slot is showing. */}
      <div className="shelf__services">
        {(logos.length > 0 || disc) && <ProviderLogos providers={logos} disc={disc} />}
        {flagNotStreaming && !disc && item.availableOn?.length === 0 && logos.length === 0 && (
          <span className="shelf__unhosted">Not streaming</span>
        )}
      </div>
      {/* Poster, then the toggles, then the title and season line: toggles
          sit on one line across a row because every poster is the same height. */}
      <button className="shelf__open" onClick={onOpen} aria-label={item.title}>
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className="shelf__poster--empty" aria-hidden="true">
            {item.title.slice(0, 1)}
          </div>
        )}
      </button>
      <ShelfToggle
        ownable={item.onDisc}
        inLibrary={inLibrary}
        item={{
          id: item.id,
          kind: item.__typename,
          title: item.title,
          posterUrl: item.posterUrl ?? null,
        }}
      />
      {/* A second way in for the mouse: clicking the title opens the same
          dialog as the poster. Not a button, so keyboard and screen-reader
          users don't meet the same action twice; the poster is theirs. */}
      <span className="shelf__name opens-dialog" onClick={onOpen}>
        {item.title}
      </span>
      {note ? (
        <span className="shelf__next">{note}</span>
      ) : (
        item.nextSeason && (
          <span className="shelf__next">{seasonLine(item.nextSeason, localToday())}</span>
        )
      )}
    </li>
  );
}
