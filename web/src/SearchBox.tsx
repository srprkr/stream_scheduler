import { skipToken, useQuery } from "@apollo/client/react";
import { useEffect, useRef, useState } from "react";

import { graphql } from "./generated";
import { ShelfToggle } from "./ShelfToggle";
import { TitleDialog } from "./TitleDialog";
import { useDebounced } from "./useDebounced";

/**
 * Summary fields only. Selecting trailer here would cost one extra upstream
 * request per hit (see the searchMedia resolver), and the list does not show it.
 */
const SEARCH = graphql(`
  query SearchMedia($query: String!) {
    searchMedia(query: $query, first: 8) {
      __typename
      id
      title
      posterUrl(size: SMALL)
    }
  }
`);

/** Shorter than this matches too much to be useful, and still costs a request. */
const MIN_LENGTH = 2;

export function SearchBox() {
  const [text, setText] = useState("");
  // Whether the results panel is showing. Separate from `text`, so closing the
  // panel keeps the query and focusing the box brings the same results back.
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = useDebounced(text.trim(), 300);
  const active = term.length >= MIN_LENGTH;

  const { data, previousData, loading } = useQuery(
    SEARCH,
    active ? { variables: { query: term } } : skipToken,
  );
  // Keep the last results up while the next ones load, so the list does not
  // flash empty on every pause in typing.
  const results = active ? ((data ?? previousData)?.searchMedia ?? []) : [];
  const showPanel = expanded && active;

  // Close on a press anywhere outside the field and its panel - except while
  // a title's dialog is open, so closing the dialog lands back on the results.
  useEffect(() => {
    if (!showPanel || openId !== null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!fieldRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showPanel, openId]);

  return (
    <section className="search">
      {/* Escape is handled here, on the field, not on the section: the
          dialog below is inside the section too, and its own Escape should
          close only the dialog. */}
      <div
        className="search__field"
        ref={fieldRef}
        onKeyDown={(e) => {
          if (e.key === "Escape" && showPanel) {
            // A type="search" input clears itself on Escape; closing the
            // panel should keep the query.
            e.preventDefault();
            setExpanded(false);
            inputRef.current?.focus();
          }
        }}
      >
        <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>

        <input
          ref={inputRef}
          type="search"
          className="search__input"
          placeholder="Search films and series"
          aria-label="Search films and series"
          aria-expanded={showPanel}
          aria-controls="search-results"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setExpanded(true);
          }}
          onFocus={() => setExpanded(true)}
        />

        {showPanel && (
          <div className="search__panel" id="search-results">
            {!loading && results.length === 0 ? (
              <p className="search__empty">No matches for “{term}”.</p>
            ) : (
              <ul className="search__results">
                {results.map((m) => (
                  <li key={m.id} className="search__row">
                    <button className="search__hit" onClick={() => setOpenId(m.id)}>
                      {m.posterUrl ? (
                        <img src={m.posterUrl} alt="" />
                      ) : (
                        <div className="search__thumb--empty" />
                      )}
                      <span>{m.title}</span>
                      <span className="search__kind">
                        {m.__typename === "Movie" ? "Film" : "Series"}
                      </span>
                    </button>
                    <ShelfToggle
                      item={{
                        id: m.id,
                        kind: m.__typename,
                        title: m.title,
                        posterUrl: m.posterUrl ?? null,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}
