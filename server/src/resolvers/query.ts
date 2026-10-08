import type { QueryResolvers } from "../generated/graphql.js";
import { decodeCursor, encodeCursor } from "../cursor.js";
import type { CatalogFilters } from "../sources/types.js";

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
    const ids = hits.map((h) => h.id);
    // Disc lookups only when asked for; batched and cached like availability,
    // so each result's onDisc later in the request costs nothing more.
    const [availability, discs] = await Promise.all([
      ctx.loaders.availability.loadMany(ids),
      args.onDisc ? ctx.loaders.onDisc.loadMany(ids) : [],
    ]);
    return hits
      .filter((_, i) => {
        const found = availability[i];
        if (found === undefined || found instanceof Error) return false;
        if (found.slugs.some((slug) => wanted.has(slug))) return true;
        // On disc: out on disc, and on none of the tracked services.
        return args.onDisc === true && found.slugs.length === 0 && discs[i] === true;
      })
      .slice(0, first);
  },

  catalog: async (_p, args, ctx) => {
    const page = await ctx.source.listCatalog({
      providerSlugs: args.providerSlugs,
      kind: args.kind,
      sort: args.sort ?? "POPULAR",
      page: decodeCursor(args.after),
      ...filtersFrom(args),
    });
    return {
      items: page.items,
      nextCursor: page.nextPage === null ? null : encodeCursor(page.nextPage),
    };
  },

  discCatalog: async (_p, args, ctx) => {
    const page = await ctx.source.listDiscCatalog({
      kind: args.kind ?? "MOVIE",
      sort: args.sort ?? "POPULAR",
      page: decodeCursor(args.after),
      ...filtersFrom(args),
    });
    return {
      items: page.items,
      nextCursor: page.nextPage === null ? null : encodeCursor(page.nextPage),
    };
  },

  providers: (_p, _a, ctx) => ctx.source.listProviders(),
  provider: (_p, args, ctx) => ctx.loaders.provider.load(args.slug),
};

/** The score and year filters, unset as null. */
function filtersFrom(args: {
  minScore?: number | null;
  fromYear?: number | null;
  toYear?: number | null;
}): CatalogFilters {
  return {
    minScore: args.minScore ?? null,
    fromYear: args.fromYear ?? null,
    toYear: args.toYear ?? null,
  };
}
