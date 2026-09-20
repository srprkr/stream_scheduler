import { createLoaders, type Loaders } from "./loaders.js";
import { FixtureSource } from "./sources/fixture.js";
import type { CatalogSource } from "./sources/types.js";

export interface Context {
  source: CatalogSource;
  loaders: Loaders;
  /** One instant per request, every field in response agrees on "today". */
  now: Date;
}

const source = new FixtureSource();

export async function createContext(): Promise<Context> {
  return {source, loaders: createLoaders(source), now: new Date() };
}