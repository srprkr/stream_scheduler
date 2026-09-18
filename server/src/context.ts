import { createLoaders, type Loaders } from "./loaders.js";
import { FixtureSource } from "./sources/fixture.js";
import type { CatalogSource } from "./sources/types.js";

export interface Context {
  source: CatalogSource;
  loaders: Loaders;
}

const source = new FixtureSource();

export async function createContext(): Promise<Context> {
  return {source, loaders: createLoaders(source) };
}