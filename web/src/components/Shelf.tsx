import type { LibraryDetail } from "../hooks/useLibraryDetails";
import type { LibraryEntry } from "../lib/library";
import { useKeptOnScreen, removedLabel } from "../hooks/useKeptOnScreen";
import { useLibrary } from "../hooks/useLibrary";
import { CatalogTile } from "./CatalogTile";

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
  // A title taken off the shelf stays, greyed, until the page is left.
  const kept = useKeptOnScreen(entries);
  const library = useLibrary();
  if (kept.length === 0) return null;

  return (
    <section className="shelf">
      <h2 className="shelf__title">
        {title} <span className="shelf__count">{entries.length}</span>
      </h2>
      <ul className="shelf__grid">
        {kept.map(({ item: entry, removed }) => (
          <CatalogTile
            key={entry.id}
            item={{
              __typename: entry.kind,
              id: entry.id,
              title: entry.title,
              posterUrl: entry.posterUrl,
              availableOn: details.get(entry.id)?.availableOn,
              score: details.get(entry.id)?.score,
              // Owned and wanted titles are on disc by definition.
              onDisc: true,
            }}
            inLibrary
            flagNotStreaming
            removed={removed ? removedLabel(library.find((e) => e.id === entry.id)) : null}
            onOpen={() => onOpen(entry.id)}
          />
        ))}
      </ul>
    </section>
  );
}
