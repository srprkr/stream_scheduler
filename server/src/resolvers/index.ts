import type { Resolvers } from "../generated/graphql.js";

import { MediaItem, Movie, Series, Video } from "./media.js";
import { Provider } from "./provider.js";
import { Query } from "./query.js";
import { Release } from "./release.js";

export const resolvers: Resolvers = {
  Query,
  Release,
  MediaItem,
  Movie,
  Series,
  Provider,
  Video,
};
