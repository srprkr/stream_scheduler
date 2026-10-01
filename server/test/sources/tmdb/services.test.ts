import { describe, expect, it } from "vitest";

import { otherServices, subscriptionServices } from "../../../src/sources/tmdb/services.js";

describe("subscriptionServices", () => {
  const services = [
    { slug: "peacock", watchProviderIds: [386, 387] },
    { slug: "hbomax", watchProviderIds: [1899] },
  ];
  const offer = (provider_id: number) => ({ provider_id, provider_name: "" });

  it("names the configured services offering the title on subscription", () => {
    const found = subscriptionServices(
      { results: { US: { flatrate: [offer(1899), offer(2528)] } } },
      services,
    );
    expect(found).toEqual(["hbomax"]);
  });

  it("finds a service listed only under its ad tier", () => {
    const found = subscriptionServices({ results: { US: { flatrate: [offer(2100)] } } }, [
      { slug: "prime", watchProviderIds: [9, 2100] },
    ]);
    expect(found).toEqual(["prime"]);
  });

  it("counts a service once when it is listed under two tiers", () => {
    const found = subscriptionServices(
      { results: { US: { flatrate: [offer(386), offer(387)] } } },
      services,
    );
    expect(found).toEqual(["peacock"]);
  });

  it("ignores rent, free-with-ads and other countries", () => {
    const found = subscriptionServices(
      {
        results: {
          US: { rent: [offer(1899)], ads: [offer(386)] },
          GB: { flatrate: [offer(1899)] },
        },
      },
      services,
    );
    expect(found).toEqual([]);
  });
});
describe("otherServices", () => {
  const tracked = [
    { name: "Paramount+", noteAliases: ["paramount+", "paramount plus"], watchProviderIds: [2303] },
    { name: "Netflix", noteAliases: ["netflix"], watchProviderIds: [8] },
  ];
  const offer = (provider_id: number, provider_name: string) => ({
    provider_id,
    provider_name,
    logo_path: `/${provider_id}.png`,
  });
  const found = (...flatrate: ReturnType<typeof offer>[]) =>
    otherServices({ results: { US: { flatrate } } }, tracked);

  it("names untracked services, keyed by name", () => {
    expect(found(offer(283, "Crunchyroll"))).toEqual([
      { id: "other:crunchyroll", name: "Crunchyroll", logoPath: "/283.png" },
    ]);
  });

  it("folds a service's reseller channels into the service itself", () => {
    expect(
      found(
        offer(1794, "Starz Amazon Channel"),
        offer(43, "Starz"),
        offer(1855, "Starz Apple TV channel"),
      ),
    ).toEqual([{ id: "other:starz", name: "Starz", logoPath: "/43.png" }]);
  });

  it("keeps a service sold only as a channel, under its plain name", () => {
    expect(found(offer(2668, "Wonder Project Amazon Channel"))).toEqual([
      { id: "other:wonderproject", name: "Wonder Project", logoPath: "/2668.png" },
    ]);
  });

  it("treats 'Plus' and '+' as one service", () => {
    expect(found(offer(526, "AMC+"), offer(1854, "AMC Plus Apple TV channel"))).toHaveLength(1);
  });

  it("drops tiers and channels of the tracked services", () => {
    expect(
      found(
        offer(8, "Netflix"),
        offer(1796, "Netflix Standard with Ads"),
        offer(582, "Paramount+ Amazon Channel"),
        offer(1853, "Paramount Plus Apple TV channel"),
      ),
    ).toEqual([]);
  });

  it("leaves out cable-login apps and live-TV bundles", () => {
    expect(found(offer(79, "NBC"), offer(2528, "YouTube TV"))).toEqual([]);
  });
});
