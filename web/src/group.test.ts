import { describe, expect, it } from "vitest";

import { groupByArrival } from "./group";

function arrival(mediaId: string, date: string, provider: string, seasonNumber: number | null = null) {
  return { media: { id: mediaId }, availableFrom: date, seasonNumber, provider };
}

describe("groupByArrival", () => {
  it("merges one title arriving on several services the same day", () => {
    const groups = groupByArrival([
      arrival("movie:1", "2026-09-28", "hulu"),
      arrival("movie:1", "2026-09-28", "netflix"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.providers).toEqual(["hulu", "netflix"]);
  });

  it("keeps different dates apart: a move between services is two events", () => {
    const groups = groupByArrival([
      arrival("movie:1", "2026-03-01", "hbomax"),
      arrival("movie:1", "2026-10-18", "hulu"),
    ]);
    expect(groups.map((g) => g.providers)).toEqual([["hbomax"], ["hulu"]]);
  });

  it("keeps different seasons apart even on the same day", () => {
    const groups = groupByArrival([
      arrival("tv:1", "2026-10-01", "netflix", 1),
      arrival("tv:1", "2026-10-01", "netflix", 2),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("preserves the feed's order", () => {
    const groups = groupByArrival([
      arrival("movie:2", "2026-09-25", "netflix"),
      arrival("movie:1", "2026-09-28", "hulu"),
      arrival("movie:1", "2026-09-28", "netflix"),
      arrival("movie:3", "2026-10-02", "peacock"),
    ]);
    expect(groups.map((g) => g.release.media.id)).toEqual(["movie:2", "movie:1", "movie:3"]);
  });
});
