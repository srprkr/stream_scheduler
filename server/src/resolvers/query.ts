import type { QueryResolvers } from "../generated/graphql.js";
import { decodeCursor, encodeCursor } from "../cursor.js";

/** One page of upstream matches: what a service-filtered search chooses from. */
const SEARCH_POOL = 20;

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
    (await ctx.loaders.media.loadMany(args.ids)).map((m) => (m instanceof Error ? null : m)),
  /**
   * Deliberately not primed into the media loader: these records are
   * summaries, and priming them would hand a summary to anything later in the
   * request that asked the loader for the full record.
   */
  searchMedia: async (_p, args, ctx) => {
    const first = args.first ?? 10;
    if (!args.providerSlugs) return ctx.source.searchMedia(args.query, first);

    // Search can't filter by service upstream, so fetch a full page of
    // matches and keep the ones on the given services. The availability
    // loader batches the lookups - and caches them, so each result's
    // availableOn later in the same request costs nothing more.
    const wanted = new Set(args.providerSlugs);
    const hits = await ctx.source.searchMedia(args.query, SEARCH_POOL);
    const availability = await ctx.loaders.availability.loadMany(hits.map((h) => h.id));
    return hits
      .filter((_, i) => {
        const found = availability[i];
        return (
          found !== undefined &&
          !(found instanceof Error) &&
          found.slugs.some((slug) => wanted.has(slug))
        );
      })
      .slice(0, first);
  },

  catalog: async (_p, args, ctx) => {
    const page = await ctx.source.listCatalog({
      providerSlugs: args.providerSlugs,
      kind: args.kind,
      sort: args.sort ?? "POPULAR",
      page: decodeCursor(args.after),
    });
    return {
      items: page.items,
      nextCursor: page.nextPage === null ? null : encodeCursor(page.nextPage),
    };
  },

  providers: (_p, _a, ctx) => ctx.source.listProviders(),
  provider: (_p, args, ctx) => ctx.loaders.provider.load(args.slug),
};
