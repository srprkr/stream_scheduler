import { describe, expect, it } from "vitest";

import { summary } from "../../src/lib/browse";
import type { Kind } from "../../src/hooks/useBrowseFilters";

const providers = [
  { id: "1", slug: "hulu", name: "Hulu", logoUrl: null },
  { id: "2", slug: "netflix", name: "Netflix", logoUrl: null },
];
const base = {
  providers,
  slugs: ["netflix"],
  kinds: ["SERIES", "MOVIE"] as Kind[],
  allServices: false,
  allSubscribed: false,
};

describe("summary", () => {
  it("names the shortcut sets", () => {
    expect(summary({ ...base, allServices: true })).toBe("All services · Series & films");
    expect(summary({ ...base, allSubscribed: true })).toBe("Your services · Series & films");
  });

  it("names up to two services, then counts", () => {
    expect(summary({ ...base, slugs: ["netflix", "hulu"], kinds: ["MOVIE"] })).toBe(
      "Netflix, Hulu · Films",
    );
    expect(summary({ ...base, slugs: ["a", "b", "c"], kinds: ["SERIES"] })).toBe(
      "3 services · Series",
    );
  });

  it("says when nothing is selected", () => {
    expect(summary({ ...base, slugs: [], kinds: [] })).toBe("No services · No type");
  });
});
