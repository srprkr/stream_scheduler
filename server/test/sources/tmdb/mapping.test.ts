import { describe, expect, it } from "vitest";

import { pickTrailer } from "../../../src/sources/tmdb/mapping.js";
import type { TmdbVideo } from "../../../src/sources/tmdb/types.js";

function video(overrides: Partial<TmdbVideo>): TmdbVideo {
  return {
    id: "v1",
    key: "abc",
    name: "Official Trailer",
    site: "YouTube",
    type: "Trailer",
    official: true,
    ...overrides,
  };
}
describe("pickTrailer", () => {
  it("returns null when there is nothing to pick", () => {
    expect(pickTrailer(undefined)).toBeNull();
    expect(pickTrailer([])).toBeNull();
  });

  it("prefers an official trailer over one listed earlier", () => {
    const picked = pickTrailer([
      video({ id: "fan", official: false }),
      video({ id: "studio", official: true }),
    ]);
    expect(picked?.id).toBe("video:studio");
  });

  it("falls back to a teaser when there is no trailer", () => {
    const picked = pickTrailer([
      video({ id: "clip", type: "Clip" }),
      video({ id: "teaser", type: "Teaser" }),
    ]);
    expect(picked?.id).toBe("video:teaser");
  });

  it("ignores hosts it cannot embed", () => {
    expect(pickTrailer([video({ site: "Vimeo" })])).toBeNull();
  });
});
