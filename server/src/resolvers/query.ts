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