import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation, useMatch } from "react-router";

/**
 * The bar across the top: the brand, the three sections, and the How it works
 * and Settings icons. Below tablet width the links fold into a menu behind a
 * two-bar button, which turns into an X while the menu is open (the CSS).
 *
 * The menu closes when a page is picked, on Escape - handing focus back to
 * the button - and on a press anywhere outside the bar.
 */
export function TopBar() {
  // "Browse" is a section, not a page: it is current on any of its tabs.
  const onWhatsOn = useMatch("/whats-on");
  const onComingSoon = useMatch("/coming-soon");
  const onWatchlist = useMatch("/watchlist");
  const browsing = Boolean(onWhatsOn || onComingSoon || onWatchlist);

  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // A new page closes the menu: picking a link is the end of using it.
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="topbar" ref={bar}>
      <Link to="/" className="brand">
        StreamHopper
      </Link>
      {/* Hidden at tablet width and up, where the links fit on the bar. */}
      <button
        ref={toggle}
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
      >
        <span className="menu-toggle__bar" aria-hidden="true" />
        <span className="menu-toggle__bar" aria-hidden="true" />
      </button>
      <nav id={menuId} className="nav" data-open={open} aria-label="Main">
        <NavLink to="/" end className="nav__link">
          Home
        </NavLink>
        <Link
          to="/whats-on"
          className="nav__link"
          aria-current={onWhatsOn ? "page" : browsing ? "true" : undefined}
        >
          Browse
        </Link>
        <NavLink to="/insights" className="nav__link">
          Insights
        </NavLink>
        {/* Help and Settings sit apart, top right, as icons: a question
            mark for how the app works, then the gear. */}
        <NavLink
          to="/how-it-works"
          className="nav__icon"
          aria-label="How it works"
          title="How it works"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 4" />
            <circle className="nav__icon-dot" cx="12" cy="17.4" r="0.6" />
          </svg>
          <span className="nav__icon-label" aria-hidden="true">
            How it works
          </span>
        </NavLink>
        <NavLink to="/settings" className="nav__icon" aria-label="Settings" title="Settings">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
          <span className="nav__icon-label" aria-hidden="true">
            Settings
          </span>
        </NavLink>
      </nav>
    </header>
  );
}
