import type { LibraryEntry } from "./library";
import { ShelfToggle } from "./ShelfToggle";

/** One shelf of the library as a poster grid. Renders nothing when empty. */
export function Shelf({
  title,
  entries,
  onOpen,
}: {
  title: string;
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
            <button className="shelf__open" onClick={() => onOpen(entry.id)}>
              {entry.posterUrl ? (
                <img src={entry.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="shelf__poster--empty" aria-hidden="true">
                  {entry.title.slice(0, 1)}
                </div>
              )}
              <span className="shelf__name">{entry.title}</span>
            </button>
            <ShelfToggle item={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
