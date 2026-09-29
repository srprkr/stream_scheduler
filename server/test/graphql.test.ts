import { ApolloServer } from "@apollo/server";
import { describe, expect, it, vi } from "vitest";

import type { Context } from "../src/context.js";
import { createLoaders } from "../src/loaders.js";
import { resolvers } from "../src/resolvers/index.js";
import { typeDefs } from "../src/schema.js";
import { FixtureSource } from "../src/sources/fixture.js";

const NOW = new Date("2026-09-18T12:00:00Z");

/** Searches the way TMDB does: summaries, with detail-only fields blanked. */
class SummarySearchFixture extends FixtureSource {
  override async searchMedia(query: string, first: number) {
    const hits = await super.searchMedia(query, first);
    return hits.map((m) => ({ ...m, trailer: null, summary: true }));
  }
}

/**
 * Runs one operation through the real schema, resolvers and loaders against
 * the fixture. Context is built here rather than through createContext, which
 * would construct the TMDB source at import time.
 */
async function run(query: string, source = new FixtureSource(() => NOW)) {
  const getMedia = vi.spyOn(source, "getMedia");
  const server = new ApolloServer<Context>({ typeDefs, resolvers });
  const res = await server.executeOperation(
    { query },
    { contextValue: { source, loaders: createLoaders(source), now: NOW } },
  );
  if (res.body.kind !== "single") throw new Error("expected a single result");
  return { ...res.body.singleResult, getMedia };
}

describe("GraphQL layer", () => {
  it("narrows MediaItem to Movie and Series", async () => {
    const { data, errors } = await run(`{
      releases {
        media {
          __typename
          ... on Movie { runtimeMinutes }
          ... on Series { seasonCount }
        }
      }
    }`);
    expect(errors).toBeUndefined();
    const types = new Set(
      (data?.releases as { media: { __typename: string } }[]).map((r) => r.media.__typename),
    );
    expect(types).toEqual(new Set(["Movie", "Series"]));
  });

  it("loads every release's media in one batch", async () => {
    const { errors, getMedia } = await run(`{ releases { media { title } } }`);
    expect(errors).toBeUndefined();
    expect(getMedia).toHaveBeenCalledTimes(1);
    expect(getMedia.mock.calls[0]?.[0]).toHaveLength(5);
  });

  it("falls back to a film's runtime without a second batch", async () => {
    const { data, getMedia } = await run(`{
      releases { media { id } watchTimeMinutes }
    }`);
    const film = (
      data?.releases as { media: { id: string }; watchTimeMinutes: number | null }[]
    ).find((r) => r.media.id === "media:2");
    expect(film?.watchTimeMinutes).toBe(108);
    expect(getMedia).toHaveBeenCalledTimes(1);
  });

  it("counts days in the caller's timezone", async () => {
    const { data } = await run(`{ releases(first: 1) { daysUntilRelease } }`);
    expect(data).toEqual({ releases: [{ daysUntilRelease: 3 }] });
  });

  it("rejects an unknown timezone as bad input", async () => {
    const { errors } = await run(`{
      releases(first: 1) { daysUntilRelease(timezone: "Mars/Olympus_Mons") }
    }`);
    expect(errors?.[0]?.extensions?.code).toBe("BAD_USER_INPUT");
  });

  it("finds titles by name", async () => {
    const { data, errors } = await run(`{ searchMedia(query: "ledger") { id title } }`);
    expect(errors).toBeUndefined();
    expect(data).toEqual({ searchMedia: [{ id: "media:3", title: "Ledger" }] });
  });

  it("fills a search summary's trailer from the full record", async () => {
    const source = new SummarySearchFixture(() => NOW);
    const { data, getMedia } = await run(
      `{ searchMedia(query: "harbor") { trailer { name } } }`,
      source,
    );
    expect(data).toEqual({
      searchMedia: [{ trailer: { name: "The Quiet Harbor | Official Trailer" } }],
    });
    expect(getMedia).toHaveBeenCalledTimes(1);
  });

  it("costs nothing extra when no detail field is selected", async () => {
    const source = new SummarySearchFixture(() => NOW);
    const { getMedia } = await run(`{ searchMedia(query: "harbor") { title } }`, source);
    expect(getMedia).not.toHaveBeenCalled();
  });

  it("fetches several titles in the order asked, null for unknown ids", async () => {
    const { data, errors } = await run(`{
      mediaItems(ids: ["media:3", "media:404", "media:2"]) {
        title
        totalRuntime { minutes estimated }
      }
    }`);
    expect(errors).toBeUndefined();
    expect(data).toEqual({
      mediaItems: [
        { title: "Ledger", totalRuntime: { minutes: 400, estimated: false } },
        null,
        {
          title: "Nightshift at the Museum of Failure",
          totalRuntime: { minutes: 108, estimated: false },
        },
      ],
    });
  });

  it("lists the services a title streams on, and none for an unhosted one", async () => {
    const { data, errors } = await run(`{
      hosted: mediaItem(id: "media:2") { availableOn { slug } }
      unhosted: mediaItem(id: "media:3") { availableOn { slug } }
    }`);
    expect(errors).toBeUndefined();
    expect(data).toEqual({
      hosted: { availableOn: [{ slug: "netflix" }, { slug: "max" }] },
      unhosted: { availableOn: [] },
    });
  });

  it("prices a service's plans, and admits when it has none", async () => {
    const { data, errors } = await run(`{
      netflix: provider(slug: "netflix") {
        pricesCheckedOn
        plans { id monthlyCents isDefault }
      }
      max: provider(slug: "max") { pricesCheckedOn plans { id } }
    }`);
    expect(errors).toBeUndefined();
    expect(data).toEqual({
      netflix: {
        pricesCheckedOn: "2026-09-26",
        plans: [
          { id: "standard-ads", monthlyCents: 899, isDefault: true },
          { id: "standard", monthlyCents: 1999, isDefault: false },
          { id: "premium", monthlyCents: 2699, isDefault: false },
        ],
      },
      max: { pricesCheckedOn: null, plans: [] },
    });
  });

  it("pages through a catalogue with opaque cursors", async () => {
    const page = (after?: string) =>
      run(`{
        catalog(providerSlugs: ["netflix"], kind: SERIES${after ? `, after: "${after}"` : ""}) {
          items { id }
          nextCursor
        }
      }`);

    const first = await page();
    const firstPage = first.data?.catalog as { items: { id: string }[]; nextCursor: string };
    expect(firstPage.items).toEqual([{ id: "media:1" }]);

    const second = await page(firstPage.nextCursor);
    expect(second.data?.catalog).toEqual({ items: [{ id: "media:5" }], nextCursor: null });
  });

  it("rejects a forged cursor as bad input", async () => {
    const { errors } = await run(`{
      catalog(providerSlugs: ["netflix"], kind: SERIES, after: "forged") { nextCursor }
    }`);
    expect(errors?.[0]?.extensions?.code).toBe("BAD_USER_INPUT");
  });

  it("narrows a search to titles on the given services, in one availability batch", async () => {
    const source = new FixtureSource(() => NOW);
    const getAvailability = vi.spyOn(source, "getAvailability");
    const { data, errors } = await run(
      `{ searchMedia(query: "the", providerSlugs: ["max"]) { id availableOn { slug } } }`,
      source,
    );
    expect(errors).toBeUndefined();
    expect(data).toEqual({
      searchMedia: [{ id: "media:2", availableOn: [{ slug: "netflix" }, { slug: "max" }] }],
    });
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it("names untracked services alongside the tracked ones, from one availability batch", async () => {
    const source = new FixtureSource(() => NOW);
    const getAvailability = vi.spyOn(source, "getAvailability");
    const { data, errors } = await run(
      `{ mediaItems(ids: ["media:4", "media:1"]) {
          id availableOn { slug } otherServices { id name }
      } }`,
      source,
    );
    expect(errors).toBeUndefined();
    expect(data).toEqual({
      mediaItems: [
        {
          id: "media:4",
          availableOn: [{ slug: "max" }],
          otherServices: [{ id: "other:crunchyroll", name: "Crunchyroll" }],
        },
        { id: "media:1", availableOn: [{ slug: "netflix" }], otherServices: [] },
      ],
    });
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it("says where a title is going, not just where it is", async () => {
    const { data, errors } = await run(
      `{ mediaItem(id: "media:4") { upcoming { provider { slug } availableFrom } } }`,
    );
    expect(errors).toBeUndefined();
    expect(data).toEqual({
      mediaItem: { upcoming: [{ provider: { slug: "max" }, availableFrom: "2026-11-02" }] },
    });
  });

  it("gives a weekly series its next season, dated like its release", async () => {
    const { data, errors } = await run(`{
      mediaItem(id: "media:5") {
        ... on Series {
          nextSeason { seasonNumber premieresOn fullyOutOn isFullDrop }
        }
      }
    }`);
    expect(errors).toBeUndefined();
    expect(data).toEqual({
      mediaItem: {
        nextSeason: {
          seasonNumber: 3,
          premieresOn: "2026-11-28",
          fullyOutOn: "2027-01-30",
          isFullDrop: false,
        },
      },
    });
  });

  it("says whether a title can be owned on disc", async () => {
    const { data, errors } = await run(`{
      exclusive: mediaItem(id: "media:1") { onDisc }
      onShelves: mediaItem(id: "media:2") { onDisc }
    }`);
    expect(errors).toBeUndefined();
    expect(data).toEqual({ exclusive: { onDisc: false }, onShelves: { onDisc: true } });
  });
});
