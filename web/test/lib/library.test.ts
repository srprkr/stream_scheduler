import { describe, expect, it } from "vitest";

import { LIBRARY_KEY, localLibrary, type LibraryItem } from "../../src/lib/library";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const office: LibraryItem = { id: "tv:2316", kind: "Series", title: "The Office", posterUrl: null };
const heat: LibraryItem = { id: "movie:949", kind: "Movie", title: "Heat", posterUrl: null };

describe("localLibrary", () => {
  it("keeps a title on one shelf at a time", () => {
    const library = localLibrary(memoryStorage());
    library.shelve(office, "wanted");
    library.shelve(office, "owned");
    expect(library.entries().map((e) => [e.id, e.shelf])).toEqual([["tv:2316", "owned"]]);
  });

  it("removes a title when shelved to null", () => {
    const library = localLibrary(memoryStorage());
    library.shelve(office, "owned");
    library.shelve(office, null);
    expect(library.entries()).toEqual([]);
  });

  it("lists newest first, and dates a move to the new shelf", () => {
    let clock = 0;
    const library = localLibrary(memoryStorage(), () => new Date(Date.UTC(2026, 8, 24, clock++)));
    library.shelve(office, "wanted");
    library.shelve(heat, "owned");
    library.shelve(office, "owned");
    expect(library.entries().map((e) => [e.id, e.addedAt])).toEqual([
      ["tv:2316", "2026-09-24T02:00:00.000Z"],
      ["movie:949", "2026-09-24T01:00:00.000Z"],
    ]);
  });

  it("survives a reload from the same storage", () => {
    const storage = memoryStorage();
    localLibrary(storage).shelve(heat, "owned");
    expect(localLibrary(storage).entries().map((e) => e.id)).toEqual(["movie:949"]);
  });

  it("hands React a new snapshot on every change, and the same one otherwise", () => {
    const library = localLibrary(memoryStorage());
    const before = library.entries();
    expect(library.entries()).toBe(before);
    library.shelve(heat, "owned");
    expect(library.entries()).not.toBe(before);
  });

  it("tells subscribers about changes until they unsubscribe", () => {
    const library = localLibrary(memoryStorage());
    let calls = 0;
    const unsubscribe = library.subscribe(() => calls++);
    library.shelve(heat, "owned");
    unsubscribe();
    library.shelve(heat, null);
    expect(calls).toBe(1);
  });

  it("treats corrupt or foreign-version data as an empty library", () => {
    expect(localLibrary(memoryStorage({ [LIBRARY_KEY]: "{not json" })).entries()).toEqual([]);
    const future = JSON.stringify({ version: 99, entries: [heat] });
    expect(localLibrary(memoryStorage({ [LIBRARY_KEY]: future })).entries()).toEqual([]);
  });

  it("keeps working in memory when storage refuses writes", () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    const library = localLibrary(full);
    library.shelve(heat, "owned");
    expect(library.entries()).toHaveLength(1);
  });
});
