import { describe, expect, it } from "vitest";

import { recentlyArrived } from "../../src/resolvers/media.js";
import type { ReleaseRecord } from "../../src/sources/types.js";

const arrival = (providerSlug: string, availableFrom: string): ReleaseRecord => ({
  id: `release:${providerSlug}`,
  mediaId: "movie:1",
  providerSlug,
  availableFrom,
  bingeableFrom: availableFrom,
  isFullDrop: true,
  episodeCount: null,
  watchTimeMinutes: null,
  seasonNumber: null,
});

describe("recentlyArrived", () => {
  const today = "2026-10-02";

  it("vouches for a service a film premiered on in the last 60 days", () => {
    expect(recentlyArrived([arrival("appletv", "2026-10-01")], today)).toEqual(["appletv"]);
    expect(recentlyArrived([arrival("appletv", "2026-08-03")], today)).toEqual(["appletv"]);
  });

  it("says nothing for an older premiere, or one still to come", () => {
    expect(recentlyArrived([arrival("hulu", "2026-08-01")], today)).toEqual([]);
    expect(recentlyArrived([arrival("netflix", "2026-10-16")], today)).toEqual([]);
  });
});
