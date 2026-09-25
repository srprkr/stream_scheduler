import type { LibraryItem } from "./library";
import { library, useLibrary } from "./useLibrary";

/**
 * Own and Want for one title. They are one choice, not two: a title is owned,
 * wanted or neither, so ticking one clears the other. The store enforces that
 * by keeping a single entry per title.
 *
 * Each control's accessible name includes the title. In a list of results, a
 * screen reader hearing "Own, checkbox" twenty times cannot tell which is
 * which.
 */
export function ShelfToggle({ item }: { item: LibraryItem }) {
  const shelf = useLibrary().find((e) => e.id === item.id)?.shelf ?? null;

  return (
    <div className="shelf-toggle">
      <label className="shelf-toggle__own">
        <input
          type="checkbox"
          checked={shelf === "owned"}
          aria-label={`I own ${item.title}`}
          onChange={(e) => library.shelve(item, e.target.checked ? "owned" : null)}
        />
        Own
      </label>
      <button
        type="button"
        className="shelf-toggle__want"
        aria-pressed={shelf === "wanted"}
        aria-label={`Want ${item.title}`}
        onClick={() => library.shelve(item, shelf === "wanted" ? null : "wanted")}
      >
        {shelf === "wanted" ? "★ Wanted" : "☆ Want"}
      </button>
    </div>
  );
}
