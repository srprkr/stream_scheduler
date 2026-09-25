import type { Context } from "../context.js";
import type { MediaRecord } from "../sources/types.js";
import type {
  MediaItemResolvers,
  MovieResolvers,
  SeriesResolvers,
  VideoResolvers,
} from '../generated/graphql.js';

export const MediaItem: MediaItemResolvers = {
  __resolveType: (media) => (media.kind === "MOVIE" ? "Movie" : "Series"),
};

/**
 * A search summary does not know its detail-only fields. When a query selects
 * one, load the full record through the loader, so selecting trailer and
 * runtimeMinutes on one title costs one upstream request, not two.
 */
async function full(m: MediaRecord, ctx: Context): Promise<MediaRecord> {
  if (!m.summary) return m;
  return (await ctx.loaders.media.load(m.id)) ?? m;
}

/**
 * Movie and Series map to the same MediaRecord and share every field the
 * interface declares, implementations are literally identical.
 */
const shared = {
  posterUrl: (m, args, ctx) =>
    ctx.source.imageUrl(m.posterPath, args.size ?? "MEDIUM"),
  backdropUrl: (m, args, ctx) =>
    ctx.source.imageUrl(m.backdropPath, args.size ?? "LARGE"),
  trailer: async (m, _a, ctx) => (await full(m, ctx)).trailer,
} satisfies MovieResolvers;

export const Movie: MovieResolvers = {
  ...shared,
  runtimeMinutes: async (m, _a, ctx) => (await full(m, ctx)).runtimeMinutes,
  // TMDB reports 0 minutes for films it has no runtime for yet.
  totalRuntime: async (m, _a, ctx) => {
    const minutes = (await full(m, ctx)).runtimeMinutes;
    return minutes ? { minutes, estimated: false } : null;
  },
};
export const Series: SeriesResolvers = {
  ...shared,
  seasonCount: async (m, _a, ctx) => (await full(m, ctx)).seasonCount,
  totalRuntime: (m, _a, ctx) => ctx.loaders.runtime.load(m.id),
};

export const Video: VideoResolvers = {
  url: (video, _a, ctx) => ctx.source.videoUrl(video),
  embedUrl: (video, _a, ctx) => ctx.source.videoEmbedUrl(video),
};