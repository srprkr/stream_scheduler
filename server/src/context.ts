import type { CatalogSource } from "./sources/types.js";
import { config } from "./config.js";
import { createLoaders, type Loaders } from "./loaders.js";
import { FileCache, writeOnly } from "./cache.js";
import { FixtureSource } from "./sources/fixture.js";
import { TmdbClient } from "./sources/tmdb/client.js";
import { TmdbSource } from "./sources/tmdb/source.js";

export interface Context {
  source: CatalogSource;
  loaders: Loaders;
  /** One instant per request, every field in response agrees on "today". */
  now: Date;
}

const cache = new FileCache(config.tmdb.cacheDir, config.tmdb.cacheTtlMs);

function tmdbSource(store: Pick<FileCache, "read" | "write">): TmdbSource {
  return new TmdbSource(new TmdbClient(config.tmdb.baseUrl, config.tmdb.readToken, store));
}

/**
 * CATALOG_SOURCE=fixture still boots the whole server with no network and no
 * credential. That the switch is this small is the point of CatalogSource.
 */
const fixture = process.env.CATALOG_SOURCE === "fixture";

/**
 * FIXTURE_NOW pins "today" (an ISO date or time) for the fixture source and
 * every request, so browser tests and their screenshots see the same dates
 * every day. Only honoured with the fixture source; real data runs on the
 * real clock.
 */
const pinned = fixture && process.env.FIXTURE_NOW ? new Date(process.env.FIXTURE_NOW) : null;
const clock = () => (pinned ? new Date(pinned) : new Date());

const source: CatalogSource = fixture ? new FixtureSource(clock) : tmdbSource(cache);

/** Half the cache TTL, so no entry is ever old enough to expire under a visitor. */
const REFRESH_EVERY_MS = config.tmdb.cacheTtlMs / 2;

/**
 * Keeps the full feed warm so no visitor pays for a cold one: with all eight
 * services that is about 580 upstream requests and 12 seconds.
 *
 * At boot it reads through the cache, which is nearly free when the cache is
 * already warm - so a `tsx watch` restart does not refetch everything. After
 * that it refreshes through a write-only view of the cache, replacing every
 * entry at half its TTL.
 */
export function startFeedRefresher(): void {
  if (fixture) return;
  const refresher = tmdbSource(writeOnly(cache));

  const warm = async (via: CatalogSource, label: string) => {
    const started = Date.now();
    try {
      const releases = await via.listReleases({ first: Number.MAX_SAFE_INTEGER });
      await via.getMedia([...new Set(releases.map((r) => r.mediaId))]);
      console.log(`[feed] ${label}: ${releases.length} releases in ${Date.now() - started}ms`);
    } catch (err) {
      console.error(`[feed] ${label} failed`, err);
    }
  };

  void warm(source, "warmed");
  setInterval(() => void warm(refresher, "refreshed"), REFRESH_EVERY_MS).unref();
}

export async function createContext(): Promise<Context> {
  return { source, loaders: createLoaders(source), now: clock() };
}
