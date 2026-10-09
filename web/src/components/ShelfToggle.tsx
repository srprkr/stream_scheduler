import { useEffect, useState, type ReactNode } from "react";

import type { LibraryItem, Shelf } from "../lib/library";
import { library, useLibrary } from "../hooks/useLibrary";

/**
 * What the user can do with a title:
 *
 * - On disc (ownable): Own, Want and Watchlist - own a copy, plan to buy one,
 *   or just watch it on a service instead.
 * - On disc only (ownable, not `watchable`): Own and Want. The watchlist is
 *   for watching on a service, and no tracked service has it or is getting
 *   it - owning a copy is the only way to see it. A title already on the
 *   watchlist keeps the toggle, so it can be taken off.
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
 * All three are icon pills - Own (a disc and its case), ☆ Want, + Watchlist -
 * so they take one short line under a poster, with room left for the score
 * beside them.
 *
 * Every control's accessible name includes the title. In a list of results, a
 * screen reader hearing "Own, toggle button" twenty times cannot tell which
 * is which.
 */
export function ShelfToggle({
  item,
  ownable = true,
  watchable = true,
  inLibrary = false,
}: {
  item: LibraryItem;
  /** False for streaming-only titles. Defaults to true where it's unknown. */
  ownable?: boolean;
  /**
   * False when no tracked service streams it or is getting it. Defaults to
   * true where that's unknown, as in Home's search.
   */
  watchable?: boolean;
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
      <IconToggle
        className="shelf-toggle__own"
        pressed={shelf === "owned"}
        icon={<OwnIcon />}
        text={shelf === "owned" ? "Owned" : "Own"}
        label={`I own ${item.title}`}
        onClick={() => toggle("owned")}
      />
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
      {!inLibrary && (watchable || shelf === "watchlist") && watchlist}
    </div>
  );
}

/**
 * Own's icon: a disc and its cardboard sleeve, with a thumb notch in the
 * sleeve's open edge that shows the disc behind it. Off, the disc sits half
 * out of the sleeve; pressed, it slides in and the sleeve fills - the copy
 * put away on your shelf. One drawing, moved by CSS on the button's
 * aria-pressed, so the slide plays as it's clicked.
 */
function OwnIcon() {
  return (
    <svg className="own-icon" viewBox="0 0 21 16" focusable="false">
      <g className="own-icon__disc">
        <circle cx="14.6" cy="8" r="5.6" />
        <circle cx="14.6" cy="8" r="1.1" />
        {/* A shine across the part that shows, so it reads as a disc. */}
        <path className="own-icon__shine" d="M15.23 4.45A3.6 3.6 0 0 1 17.72 6.20" />
      </g>
      {/* The sleeve, with a thumb notch cut into its open edge: the disc
          shows through it, half out or all the way in. */}
      <path
        className="own-icon__case"
        d="M2.6 1H11.8A1.6 1.6 0 0 1 13.4 2.6V4.9A3.1 3.1 0 0 0 13.4 11.1V13.4A1.6 1.6 0 0 1 11.8 15H2.6A1.6 1.6 0 0 1 1 13.4V2.6A1.6 1.6 0 0 1 2.6 1Z"
      />
    </svg>
  );
}

/** How long a pill shows its word after a click. */
const FLASH_MS = 1200;

/**
 * A pill that shows only its icon, and briefly spells out its word when
 * clicked - "Owned", "Wanted" - as confirmation, then folds back so three
 * options fit under a narrow poster. The score beside them steps aside
 * meanwhile (the CSS). On hover, the browser's own
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
  icon: ReactNode;
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
