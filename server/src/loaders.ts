import DataLoader from "dataloader";

import type {
  CatalogSource,
  MediaRecord,
  ProviderRecord,
  RuntimeRecord,
} from "./sources/types.js";

export interface Loaders {
  /** Provider slugs per media id. */
  availability: DataLoader<string, string[]>;
  media: DataLoader<string, MediaRecord | null>;
  provider: DataLoader<string, ProviderRecord | null>;
  runtime: DataLoader<string, RuntimeRecord | null>;
}

export function createLoaders(source: CatalogSource): Loaders {
  return {
    availability: new DataLoader(async (ids) => {
      console.log(`[batch] getAvailability x${ids.length}: ${ids.join(", ")}`);
      return source.getAvailability(ids);
    }),

    media: new DataLoader(async (ids) => {
      console.log(`[batch] getMedia x${ids.length}: ${ids.join(", ")}`);
      return source.getMedia(ids);
    }),
    provider: new DataLoader(async (slugs) => {
      console.log(`[batch] getProviders x${slugs.length}: ${slugs.join(", ")}`);
      return source.getProviders(slugs);
    }),
    runtime: new DataLoader(async (ids) => {
      console.log(`[batch] getSeriesRuntimes x${ids.length}: ${ids.join(", ")}`);
      return source.getSeriesRuntimes(ids);
    }),
  };
}