import type { ReleaseResolvers } from "../generated/graphql.js";

export const Release: ReleaseResolvers = {
  media: async (release, __dirname, ctx) => {
    const media = await ctx.loaders.media.load(release.mediaId);
    if (!media) {
      throw new Error(
        `Release ${release.id} references missing media ${release.mediaId}`,
      );
    }
    return media
  },

  provider: async (release, _a, ctx) => {
    const provider = await ctx.loaders.provider.load(release.providerSlug);
    if (!provider) {
      throw new Error (
        `Release ${release.id} references unknown provider ${release.providerSlug}`,
      );
    }
    return provider;
  },

  daysUntilRelease: (release) =>
    Math.ceil(
      (new Date(release.availableFrom).getTime() - Date.now()) / 86_400_000,
    ),
};