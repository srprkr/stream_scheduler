import type { CatalogSource } from "./sources/types.js";
import { config } from "./config.js";
import { createLoaders, type Loaders } from "./loaders.js";
import { FileCache } from "./cache.js";
import { FixtureSource } from "./sources/fixture.js";
import { TmdbClient } from "./sources/tmdb/client.js";
import { TmdbSource } from "./sources/tmdb/source.js";


export interface Context {
  source: CatalogSource;
  loaders: Loaders;
  /** One instant per request, every field in response agrees on "today". */
  now: Date;
}

/**
 * CATALOG_SOURCE=fixture still boots the whole server with no network and no
 * credential. That the switch is this small is the point of CatalogSource.
 */
function createSource(): CatalogSource {
  if (process.env.CATALOG_SOURCE === "fixture") return new FixtureSource();
  const cache = new FileCache(config.tmdb.cacheDir, config.tmdb.cacheTtlMs);
  return new TmdbSource(
    new TmdbClient(config.tmdb.baseUrl, config.tmdb.readToken, cache),
  );
}

const source = createSource();


export async function createContext(): Promise<Context> {
  return {source, loaders: createLoaders(source), now: new Date() };
}