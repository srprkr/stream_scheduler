import { useSyncExternalStore } from "react";

import { LIBRARY_KEY, localLibrary, type LibraryEntry } from "../lib/library";

import { browserStorage } from "./browserStorage";

/** The one library for this browser, shared by every component. */
export const library = localLibrary(browserStorage());

// Fires in OTHER tabs when this origin's storage changes (key null = cleared),
// so two open tabs never show different libraries.
window.addEventListener("storage", (e) => {
  if (e.key === null || e.key === LIBRARY_KEY) library.reload();
});

/**
 * The library as React state. useSyncExternalStore is React's primitive for
 * data that lives outside React: it re-renders when the store notifies, and
 * never renders two components from two different versions of the data.
 */
export function useLibrary(): readonly LibraryEntry[] {
  return useSyncExternalStore(library.subscribe, library.entries);
}
