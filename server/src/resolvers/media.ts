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
 * Movie and Series map to the same MediaRecord and share every field the
 * interface declares, implementations are literally identical.
 */
const shared = {
  posterUrl: (m, args, ctx) =>
    ctx.source.imageUrl(m.posterPath, args.size ?? "MEDIUM"),
  backdropUrl: (m, args, ctx) =>
    ctx.source.imageUrl(m.backdropPath, args.size ?? "LARGE"),
} satisfies MovieResolvers;

export const Movie: MovieResolvers = shared;
export const Series: SeriesResolvers = shared;

export const Video: VideoResolvers = {
  url: (video, _a, ctx) => ctx.source.videoUrl(video),
};