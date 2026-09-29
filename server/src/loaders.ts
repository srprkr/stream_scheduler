import DataLoader from "dataloader";

import type {
  AvailabilityRecord,
  CatalogSource,
  MediaRecord,
  ProviderRecord,
  ReleaseRecord,
  RuntimeRecord,
  SeasonScheduleRecord,
} from "./sources/types.js";

export interface Loaders {
  /** Where each media id streams. */
  availability: DataLoader<string, AvailabilityRecord>;
  media: DataLoader<string, MediaRecord | null>;
  nextSeason: DataLoader<string, SeasonScheduleRecord | null>;
  onDisc: DataLoader<string, boolean>;
  provider: DataLoader<string, ProviderRecord | null>;
  /** Arrivals still to come per media id. */
  upcoming: DataLoader<string, ReleaseRecord[]>;
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
    onDisc: new DataLoader(async (ids) => {
      console.log(`[batch] getOnDisc x${ids.length}: ${ids.join(", ")}`);
      return source.getOnDisc(ids);
    }),
    nextSeason: new DataLoader(async (ids) => {
      console.log(`[batch] getNextSeasons x${ids.length}: ${ids.join(", ")}`);
      return source.getNextSeasons(ids);
    }),
    provider: new DataLoader(async (slugs) => {
      console.log(`[batch] getProviders x${slugs.length}: ${slugs.join(", ")}`);
      return source.getProviders(slugs);
    }),
    upcoming: new DataLoader(async (ids) => {
      console.log(`[batch] getUpcoming x${ids.length}: ${ids.join(", ")}`);
      return source.getUpcoming(ids);
    }),
    runtime: new DataLoader(async (ids) => {
      console.log(`[batch] getSeriesRuntimes x${ids.length}: ${ids.join(", ")}`);
      return source.getSeriesRuntimes(ids);
    }),
  };
}
