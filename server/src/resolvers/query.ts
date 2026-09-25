import type { QueryResolvers } from "../generated/graphql.js";

export const Query: QueryResolvers = {
  releases: (_p, args, ctx) => 
    ctx.source.listReleases({
      providerSlug: args.providerSlug ?? undefined,
      from: args.from ?? undefined,
      to: args.to ?? undefined,
      first: args.first ?? 20,
    }),

  release: (_p, args, ctx) => ctx.source.getRelease(args.id),
  mediaItem: (_p, args, ctx) => ctx.loaders.media.load(args.id),
  // loadMany reports a failed key as an Error in its slot instead of
  // rejecting the batch; the schema promises null there, not a failed list.
  mediaItems: async (_p, args, ctx) =>
    (await ctx.loaders.media.loadMany(args.ids)).map((m) =>
      m instanceof Error ? null : m,
    ),
  /**
   * Deliberately not primed into the media loader: these records are
   * summaries, and priming them would hand a summary to anything later in the
   * request that asked the loader for the full record.
   */
  searchMedia: (_p, args, ctx) =>
    ctx.source.searchMedia(args.query, args.first ?? 10),
  providers: (_p, _a, ctx) => ctx.source.listProviders(),
  provider: (_p, args, ctx) => ctx.loaders.provider.load(args.slug),
}