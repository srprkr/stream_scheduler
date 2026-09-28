import { useEffect, useState } from "react";

import type { LibraryItem, Shelf } from "../lib/library";
import { library, useLibrary } from "../hooks/useLibrary";

/**
 * What the user can do with a title:
 *
 * - On disc (ownable): Own, Want and Watchlist - own a copy, plan to buy one,
 *   or just watch it on a service instead.
 * - Streaming only: Watchlist. A digital "purchase" isn't ownership - it's a
 *   licence the store can lose - so these can only be watched on a service.
 *
 * The three are one choice, not three: a title sits on at most one shelf, so
 * picking one clears the others. The store enforces that by keeping a single
 * entry per title.
 *
 * On the library's own shelves (`inLibrary`) the planning options drop away:
 * that page is about what's on the shelf, not what to watch next. Only Own
 * stays, plus the ★ on a wishlisted title - it's the way to take it back off
 * the wishlist without buying it.
 *
 * Every control's accessible name includes the title. In a list of results, a
 * screen reader hearing "Own, checkbox" twenty times cannot tell which is
 * which.
 */
export function ShelfToggle({
  item,
  ownable = true,
  inLibrary = false,
}: {
  item: LibraryItem;
  /** False for streaming-only titles. Defaults to true where it's unknown. */
  ownable?: boolean;
  /** On a library shelf: Own only, and ★ while the title is wanted. */
  inLibrary?: boolean;
}) {
  const shelf = useLibrary().find((e) => e.id === item.id)?.shelf ?? null;
  // Tapping the shelf a title is already on takes it off again.
  const toggle = (target: Shelf) => library.shelve(item, shelf === target ? null : target);

  const watchlist = (
    <IconToggle
      className="shelf-toggle__watch"
      pressed={shelf === "watchlist"}
      icon={shelf === "watchlist" ? "✓" : "+"}
      // The pill stays short - the ✓ already says it's listed - while the
      // tooltip spells the state out.
      text="Watchlist"
      tooltip={shelf === "watchlist" ? "On watchlist" : "Watchlist"}
      label={`Add ${item.title} to your watchlist`}
      onClick={() => toggle("watchlist")}
    />
  );

  if (!ownable) {
    // The only option, so there's room to spell it out.
    return <div className="shelf-toggle shelf-toggle--solo">{watchlist}</div>;
  }

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
      <div className="shelf-toggle__icons">
        {(!inLibrary || shelf === "wanted") && (
          <IconToggle
            className="shelf-toggle__want"
            pressed={shelf === "wanted"}
            icon={shelf === "wanted" ? "★" : "☆"}
            text={shelf === "wanted" ? "Wanted" : "Want"}
            label={`Want ${item.title}`}
            onClick={() => toggle("wanted")}
          />
        )}
        {!inLibrary && watchlist}
      </div>
    </div>
  );
}

/** How long a pill shows its word after a click. */
const FLASH_MS = 1200;

/**
 * A pill that shows only its icon, and briefly spells out its word when
 * clicked - "Wanted", "Watchlist" - as confirmation, then folds back so
 * three options fit under a narrow poster. On hover, the browser's own
 * tooltip (`tooltip`, or the word itself) says what the icon means.
 *
 * The accessible name comes from `label`; the icon and the word are hidden
 * from screen readers so nothing is read twice.
 */
function IconToggle({
  className,
  pressed,
  icon,
  text,
  tooltip = text,
  label,
  onClick,
}: {
  className: string;
  pressed: boolean;
  icon: string;
  text: string;
  /** Hover text, when it should say more than the pill's word. */
  tooltip?: string;
  label: string;
  onClick: () => void;
}) {
  // Counts clicks rather than holding a boolean, so a second click restarts
  // the timer instead of being cut short by the first one's.
  const [flashes, setFlashes] = useState(0);
  const flashing = flashes > 0;

  useEffect(() => {
    if (!flashing) return;
    const id = setTimeout(() => setFlashes(0), FLASH_MS);
    return () => clearTimeout(id);
  }, [flashes, flashing]);

  return (
    <button
      type="button"
      className={`icon-toggle ${className}`}
      data-flash={flashing}
      aria-pressed={pressed}
      aria-label={label}
      title={tooltip}
      onClick={() => {
        onClick();
        setFlashes((n) => n + 1);
      }}
    >
      <span className="icon-toggle__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="icon-toggle__text" aria-hidden="true">
        {text}
      </span>
    </button>
  );
}
