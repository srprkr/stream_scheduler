import type { Context } from "../context.js";
import { addDays, isoDate } from "../dates.js";
import type { MediaRecord, ProviderRecord, ReleaseRecord } from "../sources/types.js";
import type {
  MediaItemResolvers,
  MovieResolvers,
  OtherServiceResolvers,
  SeasonScheduleResolvers,
  SeriesResolvers,
  VideoResolvers,
} from "../generated/graphql.js";

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

/** How long a premiere vouches for a service, while watch data catches up. */
export const ARRIVAL_GRACE_DAYS = 60;

/**
 * Services a film premiered on recently, by its release-date notes. TMDB's
 * watch-provider data (from JustWatch) lags a premiere by days - Winter K2
 * reached Apple TV on Oct 1 and was listed nowhere two days later - which
 * left a just-arrived film neither upcoming nor streaming. The note fills
 * that gap, for a limited time: an old premiere says nothing about where a
 * film streams now, since licences move.
 */
export function recentlyArrived(arrivals: readonly ReleaseRecord[], today: string): string[] {
  const since = isoDate(addDays(new Date(Date.parse(today)), -ARRIVAL_GRACE_DAYS));
  return arrivals
    .filter((r) => r.availableFrom <= today && r.availableFrom >= since)
    .map((r) => r.providerSlug);
}

/**
 * Arrivals still to come on the tracked services. A film's are its streaming
 * premieres after today. A series' is its next season, on the services its
 * network makes it for, until that season premieres - built from the same
 * nextSeason loader the nextSeason field uses, so the two always agree and
 * the season is worked out once per request.
 */
async function upcoming(m: MediaRecord, _a: unknown, ctx: Context): Promise<ReleaseRecord[]> {
  const today = isoDate(ctx.now);
  if (m.kind === "MOVIE") {
    return (await ctx.loaders.filmArrivals.load(m.id)).filter((r) => r.availableFrom > today);
  }
  const [slugs, next] = await Promise.all([
    ctx.loaders.seriesServices.load(m.id),
    ctx.loaders.nextSeason.load(m.id),
  ]);
  if (!next?.premieresOn || next.premieresOn <= today) return [];
  const { premieresOn, seasonNumber } = next;
  return slugs.map((slug) => ({
    id: `release:${slug}:${m.id}:s${seasonNumber}`,
    mediaId: m.id,
    providerSlug: slug,
    availableFrom: premieresOn,
    bingeableFrom: next.fullyOutOn,
    isFullDrop: next.isFullDrop,
    episodeCount: next.episodeCount,
    watchTimeMinutes: null,
    seasonNumber,
  }));
}

/**
 * Movie and Series map to the same MediaRecord and share every field the
 * interface declares, implementations are literally identical.
 */
const shared = {
  posterUrl: (m, args, ctx) => ctx.source.imageUrl(m.posterPath, args.size ?? "MEDIUM"),
  backdropUrl: (m, args, ctx) => ctx.source.imageUrl(m.backdropPath, args.size ?? "LARGE"),
  trailer: async (m, _a, ctx) => (await full(m, ctx)).trailer,
  // Two batched hops: slugs for every title in the query, then every
  // provider those slugs name - two loader calls, however long the list.
  availableOn: async (m, _a, ctx) => {
    const { slugs } = await ctx.loaders.availability.load(m.id);
    const arrivals = m.kind === "MOVIE" ? await ctx.loaders.filmArrivals.load(m.id) : [];
    const all = [...slugs, ...recentlyArrived(arrivals, isoDate(ctx.now))];
    const providers = await ctx.loaders.provider.loadMany([...new Set(all)]);
    return providers.filter((p): p is ProviderRecord => p !== null && !(p instanceof Error));
  },
  // The same loader call as availableOn, so selecting both costs nothing more.
  otherServices: async (m, _a, ctx) => (await ctx.loaders.availability.load(m.id)).others,
  onDisc: (m, _a, ctx) => ctx.loaders.onDisc.load(m.id),
  upcoming,
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
  nextSeason: (m, _a, ctx) => ctx.loaders.nextSeason.load(m.id),
  // The same loader upcoming uses for a series, so asking for both costs one.
  madeFor: async (m, _a, ctx) => {
    const slugs = await ctx.loaders.seriesServices.load(m.id);
    const providers = await ctx.loaders.provider.loadMany(slugs);
    return providers.filter((p): p is ProviderRecord => p !== null && !(p instanceof Error));
  },
  seasonCount: async (m, _a, ctx) => (await full(m, ctx)).seasonCount,
  totalRuntime: (m, _a, ctx) => ctx.loaders.runtime.load(m.id),
};

// Fetched only when a query asks: it can cost a request for the season
// before, which the catalogue's next-season lines don't need.
export const SeasonSchedule: SeasonScheduleResolvers = {
  watchTime: (s, _a, ctx) => ctx.loaders.seasonRuntime.load(`${s.mediaId}#${s.seasonNumber}`),
};

export const OtherService: OtherServiceResolvers = {
  logoUrl: (service, args, ctx) => ctx.source.imageUrl(service.logoPath, args.size ?? "SMALL"),
};

export const Video: VideoResolvers = {
  url: (video, _a, ctx) => ctx.source.videoUrl(video),
  embedUrl: (video, _a, ctx) => ctx.source.videoEmbedUrl(video),
};
