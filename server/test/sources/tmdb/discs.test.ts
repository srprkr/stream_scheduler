import { describe, expect, it } from "vitest";

import { seriesOnDisc } from "../../../src/sources/tmdb/discs.js";

describe("seriesOnDisc", () => {
  it("counts broadcast and cable shows as on disc", () => {
    expect(seriesOnDisc(456, [19])).toBe(true); // The Simpsons, FOX
    expect(seriesOnDisc(1399, [49])).toBe(true); // Game of Thrones, HBO
  });

  it("doesn't count streaming originals", () => {
    expect(seriesOnDisc(108978, [1024])).toBe(false); // Reacher, Prime Video
  });

  it("lets the exceptions list overrule the network", () => {
    expect(seriesOnDisc(65494, [213])).toBe(true); // The Crown, Netflix, on disc
  });
});
