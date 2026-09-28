import { ProviderLogos } from "./ProviderLogos";
import type { LibraryDetail } from "../hooks/useLibraryDetails";
import type { LibraryEntry } from "../lib/library";
import { ShelfToggle } from "./ShelfToggle";

/** One shelf of the library as a poster grid. Renders nothing when empty. */
export function Shelf({
  title,
  entries,
  details,
  onOpen,
}: {
  title: string;
  /** Loaded details by id; a title missing here just shows no availability. */
  details: ReadonlyMap<string, LibraryDetail>;
  entries: readonly LibraryEntry[];
  onOpen: (id: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="shelf">
      <h2 className="shelf__title">
        {title} <span className="shelf__count">{entries.length}</span>
      </h2>
      <ul className="shelf__grid">
        {entries.map((entry) => (
          <li key={entry.id} className="shelf__item">
            <Availability services={details.get(entry.id)?.availableOn} />
            {/* Poster, then the toggles, then the title: toggles sit on one
                line across a row because every poster is the same height. */}
            <button
              className="shelf__open"
              onClick={() => onOpen(entry.id)}
              aria-label={entry.title}
            >
              {entry.posterUrl ? (
                <img src={entry.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="shelf__poster--empty" aria-hidden="true">
                  {entry.title.slice(0, 1)}
                </div>
              )}
            </button>
            <ShelfToggle item={entry} inLibrary />
            {/* A second way in for the mouse: clicking the title opens the same
                dialog as the poster. Not a button, so keyboard and screen-reader
                users don't meet the same action twice; the poster is theirs. */}
            <span className="shelf__name opens-dialog" onClick={() => onOpen(entry.id)}>
              {entry.title}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Where a title streams, or that it streams nowhere. The slot renders even
 * while the answer is loading, at a fixed height, so every poster in a row
 * starts at the same line whatever its tile is showing above it.
 */
function Availability({ services }: { services: LibraryDetail["availableOn"] | undefined }) {
  return (
    <div className="shelf__services">
      {services && services.length === 0 && <span className="shelf__unhosted">Not streaming</span>}
      {services && services.length > 0 && <ProviderLogos providers={services} />}
    </div>
  );
}
