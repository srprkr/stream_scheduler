import { GraphQLError } from "graphql";
import { daysUntil } from "../dates.js";

import type { Context } from "../context.js";
import type { ReleaseResolvers } from "../generated/graphql.js";

export const Release: ReleaseResolvers = {
  media: async (release, _a, ctx) => {
    const media = await ctx.loaders.media.load(release.mediaId);
    if (!media) {
      throw new Error(`Release ${release.id} references missing media ${release.mediaId}`);
    }
    return media;
  },

  provider: async (release, _a, ctx) => {
    const provider = await ctx.loaders.provider.load(release.providerSlug);
    if (!provider) {
      throw new Error(`Release ${release.id} references unknown provider ${release.providerSlug}`);
    }
    return provider;
  },

  /**
   * Films carry their runtime on the media record, not the release, because
   * the discover listing does not include it. The media loader has already
   * been primed by any query selecting `media`, so this fallback is usually
   * a cache hit rather than a second request.
   */
  watchTimeMinutes: async (release, _a, ctx) => {
    if (release.watchTimeMinutes !== null) return release.watchTimeMinutes;
    const media = await ctx.loaders.media.load(release.mediaId);
    return media?.runtimeMinutes ?? null;
  },

  daysUntilRelease: (release, args, ctx) => daysUntilFor(release.availableFrom, args.timezone, ctx),
};

/** Days until a date in the caller's timezone; an unknown zone is their mistake. */
function daysUntilFor(date: string, zone: string | null | undefined, ctx: Context): number {
  const timezone = zone ?? "UTC";
  try {
    return daysUntil(date, timezone, ctx.now);
  } catch (err) {
    if (err instanceof RangeError) {
      throw new GraphQLError(`Unknown timezone "${timezone}"`, {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    throw err;
  }
}
