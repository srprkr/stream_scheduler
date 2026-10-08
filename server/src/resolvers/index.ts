import type { Resolvers } from "../generated/graphql.js";

import { DateScaler, URLScaler } from "./scalars.js";
import { MediaItem, Movie, OtherService, SeasonSchedule, Series, Video } from "./media.js";
import { Provider } from "./provider.js";
import { Query } from "./query.js";
import { DiscRelease, Release } from "./release.js";

export const resolvers: Resolvers = {
  Date: DateScaler,
  URL: URLScaler,
  Query,
  Release,
  DiscRelease,
  MediaItem,
  Movie,
  Series,
  Provider,
  OtherService,
  SeasonSchedule,
  Video,
};
