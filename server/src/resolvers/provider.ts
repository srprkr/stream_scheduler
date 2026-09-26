import type { ProviderResolvers } from "../generated/graphql.js";
import { PLANS, PRICES_CHECKED_ON } from "../plans.js";

export const Provider: ProviderResolvers = {
  logoUrl: (provider, args, ctx) =>
    ctx.source.imageUrl(provider.logoPath, args.size ?? "SMALL"),
  plans: (provider) => PLANS[provider.slug] ?? [],
  pricesCheckedOn: (provider) => (PLANS[provider.slug] ? PRICES_CHECKED_ON : null),
};
