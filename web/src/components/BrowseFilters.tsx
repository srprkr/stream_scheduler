import { useEffect, useId, useRef, useState } from "react";
import { NavLink } from "react-router";

import type { BrowseFilters as Filters } from "../hooks/useBrowseFilters";
import { KINDS } from "../hooks/useBrowseFilters";
import { summary } from "../lib/browse";
import { DiscLogo } from "./DiscLogo";
import { ServiceLogo } from "./ServiceLogo";

/**
 * One row of filters shared by What's On and Coming Soon:
 *
 *   What's On  Coming Soon | Select/Clear All  My Services  [disc] [logos…] | Series  Films
 *
 * The first two switch page - one or the other, like radio buttons. The
 * services and the two types are checkboxes: any mix can be on. The pipes
 * are visual only; each group is its own labelled group for screen readers.
 *
 * Below desktop width the row won't fit on one line, and a sideways scroll
 * is out of reach of a mouse wheel. So there the services and types fold
 * into a "Filters" button that names the current selection and opens them
 * in a panel underneath. The page links stay out: they're navigation, not
 * a filter. The CSS decides which layout shows; the markup is the same.
 */
export function BrowseFilters({
  filters: all,
  offerDisc = true,
}: {
  filters: Filters;
  /**
   * Whether On disc is offered. Coming Soon leaves it out: it shows what's
   * arriving on services, and a disc to buy is a wishlist matter. There the
   * shortcuts are judged by the services alone, so a hidden On disc never
   * makes Select All or My Services look half-done.
   */
  offerDisc?: boolean;
}) {
  const filters = offerDisc
    ? all
    : {
        ...all,
        disc: false,
        allServices: all.everyService,
        allSubscribed: all.myServicesOnly,
      };
  const { providers, mySlugs, slugs, kinds } = filters;
  const tag = (on: boolean) => `tag${on ? " tag--on" : ""}`;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Open, the panel closes on a click anywhere outside the row, or on Esc -
  // which hands focus back to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
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
    <div className="filters" ref={root}>
      <nav className="filters__group" aria-label="Show">
        <NavLink to="/whats-on" className={({ isActive }) => tag(isActive)} data-label="What's On">
          What's On
        </NavLink>
        <NavLink
          to="/coming-soon"
          className={({ isActive }) => tag(isActive)}
          data-label="Coming Soon"
        >
          Coming Soon
        </NavLink>
      </nav>

      <span className="filters__pipe" aria-hidden="true">
        |
      </span>

      {/* Hidden at desktop width, where everything fits on the row. */}
      <button
        ref={toggle}
        type="button"
        className="filters__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span className="filters__toggle-label">Filters:</span>
        <span className="filters__toggle-summary">{summary(filters)}</span>
        <span className="filters__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      <div id={panelId} className="filters__panel" data-open={open}>
        <div className="filters__group" role="group" aria-label="Services">
          {/* An action, not a toggle: its label says what a click does -
              select every service, or with all of them on, clear them to
              pick one. So no pressed state; the logos show the selection. */}
          <button
            type="button"
            className="tag tag--action"
            // The wider of its two labels, so swapping them moves nothing.
            data-label="Select All"
            onClick={filters.allServices ? filters.selectNone : filters.selectAll}
          >
            {filters.allServices ? "Clear All" : "Select All"}
          </button>
          <button
            type="button"
            className={tag(filters.allSubscribed)}
            data-label="My Services"
            aria-pressed={filters.allSubscribed}
            disabled={mySlugs.length === 0}
            title={mySlugs.length === 0 ? "Choose the services you pay for in Insights" : undefined}
            onClick={filters.selectSubscribed}
          >
            My Services
          </button>
          {/* Not a service but picked like one: titles you can only watch
              by owning the disc. */}
          {offerDisc && (
            <button
              type="button"
              className="filters__service"
              aria-pressed={filters.disc}
              aria-label="On disc"
              title="On disc: DVD and Blu-ray"
              onClick={filters.toggleDisc}
            >
              <DiscLogo active={filters.disc} />
            </button>
          )}
          {/* Logos rather than names, to keep the row to one line: in colour
              when selected, greyed when not, as elsewhere in the app. The
              name is the button's label and its hover text. */}
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              className="filters__service"
              aria-pressed={slugs.includes(p.slug)}
              aria-label={p.name}
              title={p.name}
              onClick={() => filters.toggleService(p.slug)}
            >
              <ServiceLogo
                name={p.name}
                logoUrl={p.logoUrl}
                active={slugs.includes(p.slug)}
                size="chip"
              />
            </button>
          ))}
        </div>

        {/* On the row, pushes itself and the type group to the right edge. */}
        <span className="filters__pipe filters__pipe--end" aria-hidden="true">
          |
        </span>

        <div className="filters__group" role="group" aria-label="Type">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={tag(kinds.includes(k))}
              data-label={k === "SERIES" ? "Series" : "Films"}
              aria-pressed={kinds.includes(k)}
              onClick={() => filters.toggleKind(k)}
            >
              {k === "SERIES" ? "Series" : "Films"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
