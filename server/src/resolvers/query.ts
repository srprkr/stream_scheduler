import type { QueryResolvers } from "../generated/graphql.js";

export const Query: QueryResolvers = {
  releases: (_p, args, ctx) => 
    ctx.source.listReleases({
      providerSlug: args.providerSlug ?? undefined,
      from: args.from ?? undefined,
      to: args.to ?? undefined,
      first: args.first ?? undefined,
    }),

  release: (_p, args, ctx) => ctx.source.getRelease(args.id),
  mediaItem: (_p, args, ctx) => ctx.loaders.media.load(args.id),
  providers: (_p, _a, ctx) => ctx.source.listProviders(),
  provider: (_p, args, ctx) => ctx.loaders.provider.load(args.slug),

  mediaItem: 
}