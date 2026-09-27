import { describe, expect, it } from "vitest";

import { listTitles, replacementSummary } from "../../src/lib/replaces";

const on = (...slugs: string[]) => slugs.map((slug) => ({ slug }));

describe("replacementSummary", () => {
  it("lists each service's owned titles, alphabetically", () => {
    const { bySlug } = replacementSummary([
      { title: "The Office", availableOn: on("peacock") },
      { title: "Parks and Recreation", availableOn: on("peacock") },
      { title: "Severance", availableOn: on("appletv") },
    ]);
    expect(bySlug.get("peacock")).toEqual(["Parks and Recreation", "The Office"]);
    expect(bySlug.get("appletv")).toEqual(["Severance"]);
  });

  it("lists a title on two services under both", () => {
    const { bySlug } = replacementSummary([{ title: "Demon Slayer", availableOn: on("hulu", "netflix") }]);
    expect([bySlug.get("hulu"), bySlug.get("netflix")]).toEqual([["Demon Slayer"], ["Demon Slayer"]]);
  });

  it("keeps titles streaming nowhere apart", () => {
    const { unhosted, bySlug } = replacementSummary([
      { title: "Heat", availableOn: [] },
      { title: "Alien", availableOn: [] },
    ]);
    expect(unhosted).toEqual(["Alien", "Heat"]);
    expect(bySlug.size).toBe(0);
  });
});

describe("listTitles", () => {
  it("joins a short list naturally", () => {
    expect(listTitles(["Heat"])).toBe("Heat");
    expect(listTitles(["Alien", "Heat"])).toBe("Alien and Heat");
    expect(listTitles(["Alien", "Heat", "Ronin"])).toBe("Alien, Heat and Ronin");
  });

  it("summarises a long one", () => {
    expect(listTitles(["A", "B", "C", "D", "E", "F", "G"], 5)).toBe("A, B, C, D and 3 more");
  });
});
