import { describe, expect, it } from "vitest";

import { interleave, mergeCatalog, selectedLists, type CatalogList } from "../../src/lib/catalog";

const series: CatalogList<string> = { items: ["S1", "S2"], nextCursor: "p2" };
const films: CatalogList<string> = { items: ["F1", "F2", "F3"], nextCursor: null };
const both = { SERIES: series, MOVIE: films };

describe("selectedLists", () => {
  it("drops a type that's switched off, even though its query still holds data", () => {
    // The bug: Films off, but the films query (on Apollo standby) still had
    // its last page, and it kept showing.
    const lists = selectedLists(["SERIES"], false, both);
    expect(mergeCatalog(lists).items).toEqual(["S1", "S2"]);
  });

  it("drops series the same way", () => {
    const lists = selectedLists(["MOVIE"], false, both);
    expect(mergeCatalog(lists).items).toEqual(["F1", "F2", "F3"]);
  });

  it("shows nothing when no type is selected, or while searching", () => {
    expect(mergeCatalog(selectedLists([], false, both)).items).toEqual([]);
    expect(mergeCatalog(selectedLists(["SERIES", "MOVIE"], true, both)).items).toEqual([]);
  });
});

describe("mergeCatalog", () => {
  it("interleaves both types when both are selected", () => {
    const lists = selectedLists(["SERIES", "MOVIE"], false, both);
    expect(mergeCatalog(lists).items).toEqual(["S1", "F1", "S2", "F2", "F3"]);
  });

  it("offers more only from a selected list", () => {
    expect(mergeCatalog(selectedLists(["SERIES", "MOVIE"], false, both)).more).toBe(true);
    // Only series has another page; with series off there's nothing more.
    expect(mergeCatalog(selectedLists(["MOVIE"], false, both)).more).toBe(false);
  });
});

describe("interleave", () => {
  it("alternates, then runs out the longer list", () => {
    expect(interleave([1, 2], [10, 20, 30, 40])).toEqual([1, 10, 2, 20, 30, 40]);
  });

  it("takes from three lists in turn", () => {
    expect(interleave([1, 2], [10], [100, 200, 300])).toEqual([1, 10, 100, 2, 200, 300]);
  });
});

describe("mergeCatalog with films out on disc", () => {
  it("weaves them in, and offers more when only they have another page", () => {
    const disc: CatalogList<string> = { items: ["D1", "D2"], nextCursor: "p2" };
    const merged = mergeCatalog({ MOVIE: { items: ["F1"], nextCursor: null }, DISC_MOVIE: disc });
    expect(merged).toEqual({ items: ["F1", "D1", "D2"], more: true });
  });

  it("weaves series out on disc in too, after the services' lists", () => {
    const merged = mergeCatalog({
      SERIES: { items: ["S1"], nextCursor: null },
      DISC_SERIES: { items: ["DS1"], nextCursor: null },
      DISC_MOVIE: { items: ["DM1"], nextCursor: null },
    });
    expect(merged.items).toEqual(["S1", "DS1", "DM1"]);
  });
});
