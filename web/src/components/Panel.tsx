import type { ReactNode } from "react";

import { useStoredFlag } from "../hooks/useStoredFlag";

/**
 * A card with a heading that folds it away. Open until the user closes it,
 * and remembered in this browser, so someone who has finished with a panel
 * doesn't have to close it on every visit.
 *
 * The body is hidden rather than unmounted, so what's inside keeps its state
 * across a fold. `collapsible={false}` pins it open, for when the panel is
 * the whole page and folding it would leave nothing.
 */
export function Panel({
  id,
  className,
  title,
  collapsible = true,
  children,
}: {
  /** Prefix for the heading and body ids, and the storage key. */
  id: string;
  /** Block class: the card gets it, the heading gets `${className}__title`. */
  className: string;
  title: string;
  collapsible?: boolean;
  children: ReactNode;
}) {
  const [stored, setOpen] = useStoredFlag(`stream-scheduler:${id}-open`, true);
  const open = !collapsible || stored;

  return (
    <section className={`panel ${className}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={`panel__title ${className}__title`}>
        {collapsible ? (
          <button
            type="button"
            className="panel__toggle"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => setOpen(!open)}
          >
            {title}
            <svg
              className="panel__chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : (
          title
        )}
      </h2>
      <div id={`${id}-body`} className="panel__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
