import type { SearchScope as Scope } from "../hooks/useBrowseFilters";

/**
 * Beside a search box: an on/off switch for keeping the search to what the
 * filter row has selected - services, and On disc. On (the default), it
 * searches the selection; off, every title, wherever it's watched. Labelled
 * by what it narrows to, so it points at the row it depends on. A switch
 * rather than two buttons: there's one question, and the label stays put.
 */
export function SearchScope({
  scope,
  onChange,
}: {
  scope: Scope;
  onChange: (scope: Scope) => void;
}) {
  const on = scope === "selected";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="switch"
      title={
        on ? "Searching what's selected below" : "Searching every title, wherever it's watched"
      }
      onClick={() => onChange(on ? "everywhere" : "selected")}
    >
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      Search only what's selected
    </button>
  );
}
