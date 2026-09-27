import { describe, expect, it } from "vitest";

import { matchesTitle } from "../../src/lib/search";

describe("matchesTitle", () => {
  it("ignores case and surrounding space", () => {
    expect(matchesTitle("The Office", "  OFFICE ")).toBe(true);
  });

  it("matches every word, in any order", () => {
    expect(matchesTitle("The Office", "office the")).toBe(true);
    expect(matchesTitle("The Office", "office space")).toBe(false);
  });

  it("ignores accents either way", () => {
    expect(matchesTitle("Pokémon Horizons", "pokemon")).toBe(true);
    expect(matchesTitle("Amelie", "amélie")).toBe(true);
  });

  it("matches everything when nothing is typed", () => {
    expect(matchesTitle("Anything", "   ")).toBe(true);
  });
});
