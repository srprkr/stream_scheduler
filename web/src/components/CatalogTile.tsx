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
  availableOn: readonly LogoProvider[];
  /** On DVD or Blu-ray: Own/Want if so, Watchlist if it's streaming only. */
  onDisc: boolean;
}

/**
 * The same tile as the library shelves: where it streams, the poster, and
 * Own / Want, so shopping is one click from browsing. Used for What's On's
 * catalogue and its search results alike.
 */
export function CatalogTile({
  item,
  onOpen,
  note,
}: {
  item: CatalogItem;
  onOpen: () => void;
  /** A line under the title in place of the season line, e.g. a film's arrival. */
  note?: string | null;
}) {
  return (
    <li className="shelf__item">
      <div className="shelf__services">
        <ProviderLogos providers={item.availableOn} />
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
