export type Shelf = "owned" | "wanted";

/**
 * A title on one of the user's shelves, with enough of it copied in to render
 * the library without asking the server: a 100-title library would otherwise
 * cost 100 upstream lookups on every visit. Titles and posters almost never
 * change, so the copy does not go stale in practice.
 */
export interface LibraryEntry {
  id: string;
  kind: "Movie" | "Series";
  title: string;
  posterUrl: string | null;
  shelf: Shelf;
  /** ISO timestamp of when it reached this shelf; shelves list newest first. */
  addedAt: string;
}

/** What a caller supplies; the store owns `shelf` and `addedAt`. */
export type LibraryItem = Omit<LibraryEntry, "shelf" | "addedAt">;

/**
 * Where the library lives. Reads are synchronous snapshots so React can render
 * straight from them. A server-backed store would keep this shape by serving
 * from a local copy and syncing behind it.
 */
export interface LibraryStore {
  entries(): readonly LibraryEntry[];
  /** Puts a title on a shelf, moves it between shelves, or (null) removes it. */
  shelve(item: LibraryItem, shelf: Shelf | null): void;
  subscribe(listener: () => void): () => void;
}

export const LIBRARY_KEY = "stream-scheduler:library";
/** Bumped when the saved shape changes, so old data is migrated, not misread. */
const VERSION = 1;

interface Saved {
  version: number;
  entries: LibraryEntry[];
}

/** Anything unreadable is treated as an empty library rather than a crash. */
function load(raw: string | null): LibraryEntry[] {
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw) as Saved;
    return saved.version === VERSION && Array.isArray(saved.entries)
      ? saved.entries
      : [];
  } catch {
    return [];
  }
}

/**
 * The library in browser storage. Storage is injected so tests can pass a
 * plain object; the app passes window.localStorage.
 *
 * Every write replaces `snapshot` with a NEW array. React compares snapshots
 * by reference to decide whether to re-render, so mutating in place would
 * change the data and leave the screen showing the old version.
 */
export function localLibrary(
  storage: Pick<Storage, "getItem" | "setItem">,
  now: () => Date = () => new Date(),
): LibraryStore & { reload(): void } {
  let snapshot = load(storage.getItem(LIBRARY_KEY));
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    entries: () => snapshot,

    shelve(item, shelf) {
      const existing = snapshot.find((e) => e.id === item.id);
      const rest = snapshot.filter((e) => e.id !== item.id);
      snapshot =
        shelf === null
          ? rest
          : [
              {
                ...item,
                shelf,
                addedAt:
                  existing?.shelf === shelf
                    ? existing.addedAt
                    : now().toISOString(),
              },
              ...rest,
            ];
      try {
        storage.setItem(LIBRARY_KEY, JSON.stringify({ version: VERSION, entries: snapshot }));
      } catch {
        // Quota exceeded or storage disabled: keep working from memory.
      }
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Re-read storage, e.g. after another tab changed it. */
    reload() {
      snapshot = load(storage.getItem(LIBRARY_KEY));
      notify();
    },
  };
}
