import { describe, expect, it } from "vitest";

import type { SeasonSchedule } from "../../src/lib/seasons";
import {
  stillToCome,
  titleReadiness,
  watchlistByService,
  watchlistGroup,
  type WatchlistTitle,
} from "../../src/lib/watchlist";

const TODAY = "2026-09-28";

const title = (name: string, minutes: number | null, ...slugs: string[]): WatchlistTitle => ({
  id: name,
  title: name,
  runtime: minutes === null ? null : { minutes, estimated: false },
  availableOn: slugs.map((slug) => ({ slug })),
});

const coming = (t: WatchlistTitle, season: Partial<SeasonSchedule>): WatchlistTitle => ({
  ...t,
  nextSeason: { seasonNumber: 2, ...season },
});

const summarise = (titles: WatchlistTitle[], subscribed: string[] = []) =>
  watchlistByService(titles, new Set(subscribed), TODAY);

describe("watchlistByService", () => {
  it("sums each service's titles and hours", () => {
    const [appletv] = summarise([
      title("Severance", 900, "appletv"),
      title("Slow Horses", 1200, "appletv"),
    ]).services;
    expect(appletv?.titles.map((t) => t.title)).toEqual(["Severance", "Slow Horses"]);
    expect(appletv?.minutes).toBe(2100);
  });

  it("counts a title on two services toward both", () => {
    const { services } = summarise([title("Demon Slayer", 600, "hulu", "netflix")]);
    expect(services.map((s) => [s.key, s.minutes])).toEqual([
      ["hulu", 600],
      ["netflix", 600],
    ]);
  });

  it("lists a title without a runtime but adds nothing for it", () => {
    const [peacock] = summarise([
      title("Poker Face", null, "peacock"),
      title("The Office", 100, "peacock"),
    ]).services;
    expect(peacock?.titles).toHaveLength(2);
    expect(peacock?.minutes).toBe(100);
  });

  it("puts subscribed services first, then the busiest", () => {
    const { services } = summarise(
      [
        title("A", 60, "hulu"),
        title("B", 60, "netflix"),
        title("C", 60, "netflix"),
        title("D", 60, "peacock"),
      ],
      ["peacock"],
    );
    expect(services.map((s) => s.key)).toEqual(["peacock", "netflix", "hulu"]);
  });

  it("lists untracked services too, never as subscribed", () => {
    const { services } = summarise(
      [
        { ...title("Frieren", 700, "hulu"), otherServices: [{ id: "other:crunchyroll" }] },
        { ...title("Dandadan", 300), otherServices: [{ id: "other:crunchyroll" }] },
      ],
      ["hulu", "other:crunchyroll"],
    );
    expect(services.map((s) => [s.key, s.tracked, s.subscribed, s.titles.length])).toEqual([
      ["hulu", true, true, 1],
      ["other:crunchyroll", false, false, 2],
    ]);
  });

  it("keeps titles streaming nowhere apart", () => {
    const { services, unhosted } = summarise([title("Gone", 90), title("Also Gone", 90)]);
    expect(services).toEqual([]);
    expect(unhosted).toEqual(["Also Gone", "Gone"]);
  });

  describe("when it can be watched", () => {
    const reacher = title("Reacher", 1200, "prime");
    const rings = coming(title("The Rings of Power", 500, "prime"), {
      premieresOn: "2026-11-11",
      fullyOutOn: "2026-11-25",
    });
    const boys = coming(title("The Boys", 900, "prime"), {
      premieresOn: "2026-10-01",
      expectedFullyOutOn: "2026-12-10",
    });

    it("dates a service by its last finale, soonest title first", () => {
      const [prime] = summarise([boys, rings, reacher]).services;
      expect(prime?.titles.map((t) => [t.title, t.ready])).toEqual([
        ["Reacher", { state: "now" }],
        ["The Rings of Power", { state: "on", date: "2026-11-25", estimated: false }],
        ["The Boys", { state: "on", date: "2026-12-10", estimated: true }],
      ]);
      expect(prime?.ready).toEqual({ state: "on", date: "2026-12-10", estimated: true });
    });

    it("is out now when nothing is still to come", () => {
      const done = coming(title("Andor", 600, "prime"), { fullyOutOn: "2026-05-01" });
      expect(summarise([reacher, done]).services[0]?.ready).toEqual({ state: "now" });
    });

    it("lists a film under the service it's coming to, dated by its arrival", () => {
      const norm = {
        ...title("Norm", 90),
        upcoming: [{ slug: "netflix", availableFrom: "2026-10-16", bingeableFrom: "2026-10-16" }],
      };
      const { services, unhosted } = summarise([norm]);
      expect(unhosted).toEqual([]);
      expect(services.map((s) => [s.key, s.subscribed, s.ready])).toEqual([
        ["netflix", false, { state: "on", date: "2026-10-16", estimated: false }],
      ]);
      expect(services[0]?.titles[0]?.arrivesOn).toBe("2026-10-16");
    });

    it("keeps a title already on the service under that service once", () => {
      const both = {
        ...rings,
        upcoming: [{ slug: "prime", availableFrom: "2026-11-11", bingeableFrom: null }],
      };
      const [prime] = summarise([both]).services;
      expect(prime?.titles).toHaveLength(1);
      expect(prime?.titles[0]?.arrivesOn).toBeNull();
    });

    it("places an undated new series under the service its network makes it for", () => {
      const newShow = { ...coming(title("New Show", null), {}), madeFor: [{ slug: "netflix" }] };
      const { services, unhosted } = summarise([newShow]);
      expect(unhosted).toEqual([]);
      expect(services.map((s) => [s.key, s.ready])).toEqual([["netflix", { state: "unknown" }]]);
    });

    it("lists a series once when it already streams on its own service", () => {
      const both = { ...rings, madeFor: [{ slug: "prime" }] };
      expect(summarise([both]).services[0]?.titles).toHaveLength(1);
    });

    it("can't be dated while any title is undated", () => {
      const undated = coming(title("Invincible", 400, "prime"), {});
      expect(summarise([rings, undated]).services[0]?.ready).toEqual({ state: "unknown" });
    });
  });
});

describe("watchlistGroup", () => {
  const arriving = (slug: string, date: string) => [
    { slug, availableFrom: date, bingeableFrom: date },
  ];

  it("puts a title that's fully out under Watch now", () => {
    expect(watchlistGroup(title("Reacher", 60, "prime"), TODAY)).toBe("now");
  });

  it("puts a season that has premiered under Watch now, even while it airs", () => {
    const airing = coming(title("The Boys", 60, "prime"), {
      premieresOn: "2026-09-01",
      fullyOutOn: "2026-10-20",
    });
    expect(watchlistGroup(airing, TODAY)).toBe("now");
    // ...but it isn't all out until the finale, which the stats and plan wait for.
    expect(stillToCome(airing, TODAY)).toBe(true);
  });

  it("puts a premiered new series under Watch now before watch data lists it", () => {
    const fresh = coming(title("New Show", 60), { premieresOn: "2026-09-25" });
    expect(watchlistGroup(fresh, TODAY)).toBe("now");
  });

  it("keeps a season that hasn't premiered under Coming soon", () => {
    const next = coming(title("Stranger Things", 60, "netflix"), { premieresOn: "2026-11-26" });
    expect(watchlistGroup(next, TODAY)).toBe("coming");
    const undated = coming(title("Severance", 60, "appletv"), {});
    expect(watchlistGroup(undated, TODAY)).toBe("coming");
  });

  it("keeps a film that's only on its way under Coming soon, dated by its arrival", () => {
    const norm = { ...title("Norm", 90), upcoming: arriving("netflix", "2026-10-16") };
    expect(watchlistGroup(norm, TODAY)).toBe("coming");
    expect(titleReadiness(norm, TODAY)).toEqual({
      state: "on",
      date: "2026-10-16",
      estimated: false,
    });
  });

  it("puts a film already streaming under Watch now, wherever else it's going", () => {
    const film = { ...title("Heat", 170, "hulu"), upcoming: arriving("netflix", "2026-11-01") };
    expect(watchlistGroup(film, TODAY)).toBe("now");
  });

  it("keeps a title with no service at all under Coming soon", () => {
    expect(watchlistGroup(title("Gone", 90), TODAY)).toBe("coming");
  });
});
