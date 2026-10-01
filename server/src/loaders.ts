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
  /** Streaming premieres per film id. */
  filmArrivals: DataLoader<string, ReleaseRecord[]>;
  /** Tracked services per series id, by the network that made it. */
  seriesServices: DataLoader<string, string[]>;
  runtime: DataLoader<string, RuntimeRecord | null>;
  /** Coming-season watch time, keyed `${mediaId}#${seasonNumber}`. */
  seasonRuntime: DataLoader<string, RuntimeRecord | null>;
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
    filmArrivals: new DataLoader(async (ids) => {
      console.log(`[batch] getFilmArrivals x${ids.length}: ${ids.join(", ")}`);
      return source.getFilmArrivals(ids);
    }),
    seriesServices: new DataLoader(async (ids) => {
      console.log(`[batch] getSeriesServices x${ids.length}: ${ids.join(", ")}`);
      return source.getSeriesServices(ids);
    }),
    seasonRuntime: new DataLoader(async (keys) => {
      console.log(`[batch] getSeasonRuntimes x${keys.length}: ${keys.join(", ")}`);
      return source.getSeasonRuntimes(keys);
    }),
    runtime: new DataLoader(async (ids) => {
      console.log(`[batch] getSeriesRuntimes x${ids.length}: ${ids.join(", ")}`);
      return source.getSeriesRuntimes(ids);
    }),
  };
}
