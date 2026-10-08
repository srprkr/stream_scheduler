import type { RefObject } from "react";

/**
 * The × pill inside a search box that empties it - there only while the box
 * has something in it. Hands focus back to the box, so the next search can
 * be typed straight away. Browsers' own clear buttons are hidden (the CSS):
 * Firefox has none, and the others' differ, so this is the one everywhere.
 */
export function ClearButton({
  input,
  onClear,
}: {
  input: RefObject<HTMLInputElement | null>;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      className="search__clear"
      aria-label="Clear search"
      title="Clear"
      onClick={() => {
        onClear();
        input.current?.focus();
      }}
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}
