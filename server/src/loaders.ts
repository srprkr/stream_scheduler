import DataLoader from "dataloader";

import type {
  CatalogSource,
  MediaRecord,
  ProviderRecord,
} from "./sources/types.js";

export interface Loaders {
  media: DataLoader<string, MediaRecord | null>;
  provider: DataLoader<string, ProviderRecord | null>;
}

export function createLoaders(source: CatalogSource): Loaders {
  return {
    media: new DataLoader(async (ids) => {
      console.log(`[batch] getMedia x${ids.length}: ${ids.join(", ")}`);
      return source.getMedia(ids);
    }),
    provider: new DataLoader(async (slugs) => {
      console.log(`[batch] getProviders x${slugs.length}: ${slugs.join(", ")}`);
      return source.getProviders(slugs);
    }),
  };
}