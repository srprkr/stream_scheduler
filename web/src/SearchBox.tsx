import { skipToken, useQuery } from "@apollo/client/react";
import { useState } from "react";
import { TitleDialog } from "./TitleDialog";
import { graphql } from "./generated";
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
  const [openId, setOpenId] = useState<string | null>(null);
  const term = useDebounced(text.trim(), 300);
  const active = term.length >= MIN_LENGTH;

  const { data, previousData, loading } = useQuery(
    SEARCH,
    active ? { variables: { query: term } } : skipToken,
  );
  // Keep the last results up while the next ones load, so the list does not
  // flash empty on every pause in typing.
  const results = active ? ((data ?? previousData)?.searchMedia ?? []) : [];

  return (
    <section className="search">
      <input
        type="search"
        className="search__input"
        placeholder="Search films and series"
        aria-label="Search films and series"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {active && !loading && results.length === 0 && (
        <p className="state">No matches for “{term}”.</p>
      )}
      <ul className="search__results">
        {results.map((m) => (
          <li key={m.id}>
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
          </li>

        ))}
      </ul>
      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}
