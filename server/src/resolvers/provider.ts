import type { ProviderResolvers } from "../generated/graphql.js";

export const Provider: ProviderResolvers = {
  logoUrl: (provider, args, ctx) =>
    ctx.source.imageUrl(provider.logoPath, args.size ?? "SMALL"),
};
