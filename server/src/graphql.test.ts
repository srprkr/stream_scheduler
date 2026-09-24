import { ApolloServer } from "@apollo/server";
import { describe, expect, it, vi } from "vitest";

import type { Context } from "./context.js";
import { createLoaders } from "./loaders.js";
import { resolvers } from "./resolvers/index.js";
import { typeDefs } from "./schema.js";
import { FixtureSource } from "./sources/fixture.js";

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
    const film = (data?.releases as { media: { id: string }; watchTimeMinutes: number | null }[])
      .find((r) => r.media.id === "media:2");
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
});
