import { ProviderLogos, type LogoProvider } from "./ProviderLogos";
import { ShelfToggle } from "./ShelfToggle";

import {
  localToday,
  seasonLine,
  type SeasonSchedule
} from "../lib/seasons";

export interface CatalogItem {
  __typename: "Movie" | "Series";
  id: string;
  title: string;
  /** Series only, and only when one is coming or airing. */
  nextSeason?: SeasonSchedule | null;
  posterUrl?: string | null;
  availableOn: readonly LogoProvider[];
}

/**
 * The same tile as the library shelves: where it streams, the poster, and
 * Own / Want, so shopping is one click from browsing. Used for What's On's
 * catalogue and its search results alike.
 */
export function CatalogTile({ item, onOpen }: { item: CatalogItem; onOpen: () => void }) {
  return (
    <li className="shelf__item">
      <div className="shelf__services">
        <ProviderLogos providers={item.availableOn} />
      </div>
      <button className="shelf__open" onClick={onOpen}>
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className="shelf__poster--empty" aria-hidden="true">
            {item.title.slice(0, 1)}
          </div>
        )}
        <span className="shelf__name">{item.title}</span>
        {item.nextSeason && (
          <span className="shelf__next">{seasonLine(item.nextSeason, localToday())}</span>
        )}

      </button>
      <ShelfToggle
        item={{
          id: item.id,
          kind: item.__typename,
          title: item.title,
          posterUrl: item.posterUrl ?? null,
        }}
      />
    </li>
  );
}