import type { OtherServiceRecord, ProviderRecord } from "../types.js";
import type { TmdbWatchProviders } from "./types.js";

/**
 * The tracked services and what TMDB's watch-provider data says about them:
 * which tracked services stream a title, and which untracked ones do.
 */

export const WATCH_REGION = "US";

/**
 * A streaming service, plus the two different TMDB handles needed to find its
 * content.
 *
 * `networkId` finds a service's own originals, including ones that have not
 * aired yet and so appear under no watch provider. `watchProviderIds` finds
 * what is actually streamable there now. A service needs both, and the second
 * is a list because TMDB splits one consumer-facing service across tiers -
 * Paramount+ has Essential and Premium. Reseller entries ("Paramount+ Amazon
 * Channel") are deliberately excluded; they are the same catalogue and would
 * double-count.
 */
export interface ProviderConfig extends ProviderRecord {
  networkId: number | null;
  /** Lower-case names a TMDB release-date note uses for this service. */
  noteAliases: string[];
  watchProviderIds: number[];
}

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "provider:netflix",
    slug: "netflix",
    name: "Netflix",
    logoPath: "/rK1KljqmbvO9HQa1PBFLILWah72.png",
    networkId: 213,
    noteAliases: ["netflix"],
    // Netflix, and Standard with Ads.
    watchProviderIds: [8, 1796],
  },
  {
    id: "provider:peacock",
    slug: "peacock",
    name: "Peacock",
    logoPath: "/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png",
    noteAliases: ["peacock"],
    networkId: 3353,
    // Premium and Premium Plus.
    watchProviderIds: [386, 387],
  },
  {
    id: "provider:hulu",
    slug: "hulu",
    name: "Hulu",
    logoPath: "/44uAnmSqvA4yBOdbPWN8YgQHjWm.png",
    networkId: 453,
    noteAliases: ["hulu"],
    watchProviderIds: [15],
  },
  {
    id: "provider:prime",
    slug: "prime",
    name: "Prime Video",
    logoPath: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png",
    networkId: 1024,
    noteAliases: ["prime video", "amazon prime video", "amazon prime"],
    // Prime Video, and Prime Video with Ads. Not 613, "Prime Video Free with
    // Ads": that's free, listed under ads rather than as a subscription.
    watchProviderIds: [9, 2100],
  },
  {
    id: "provider:appletv",
    slug: "appletv",
    name: "Apple TV",
    logoPath: "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
    networkId: 2552,
    noteAliases: ["apple tv", "apple tv+"],
    watchProviderIds: [350],
  },
  {
    id: "provider:disney",
    slug: "disney",
    name: "Disney+",
    logoPath: "/5eZ872CghnHFLB1j8grszbrx0dx.png",
    networkId: 2739,
    noteAliases: ["disney+", "disney plus"],
    watchProviderIds: [337],
  },
  {
    // Network 49 is HBO, the cable network, not the streaming service. It
    // finds HBO originals but misses Max-only titles. Good enough, not exact.
    id: "provider:hbomax",
    slug: "hbomax",
    name: "HBO Max",
    logoPath: "/skypuy7SXuugIQeYg0IglmzoKaS.png",
    networkId: 49,
    noteAliases: ["hbo max", "max"],
    watchProviderIds: [1899],
  },
  {
    id: "provider:paramount",
    slug: "paramount",
    name: "Paramount+",
    logoPath: "/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png",
    networkId: 4330,
    noteAliases: ["paramount+", "paramount plus"],
    watchProviderIds: [2303, 2616],
  },
];

export const PROVIDERS: ProviderRecord[] = PROVIDER_CONFIGS.map(({ id, slug, name, logoPath }) => ({
  id,
  slug,
  name,
  logoPath,
}));

/**
 * Which configured services carry a title on subscription, from TMDB's
 * JustWatch-sourced availability. Only `flatrate` counts - rent, buy and
 * free-with-ads are not a subscription the library could replace - and only
 * the services' own ids, so resellers like "HBO Max Amazon Channel" and a
 * service listed under two tiers each count once.
 */
export function subscriptionServices(
  availability: TmdbWatchProviders,
  configs: readonly { slug: string; watchProviderIds: readonly number[] }[],
): string[] {
  const offered = new Set(
    (availability.results[WATCH_REGION]?.flatrate ?? []).map((p) => p.provider_id),
  );
  return configs.filter((c) => c.watchProviderIds.some((id) => offered.has(id))).map((c) => c.slug);
}

/**
 * Entries TMDB lists as subscriptions that aren't a streaming service in the
 * sense this app means. Network apps need a cable or live-TV login. Live-TV
 * bundles re-carry whole cable channels, so they'd top every list for
 * carrying everything, while standing in for cable rather than for a
 * streaming service.
 */
const NOT_STREAMING_SERVICES = new Set([
  79, // NBC
  123, // FXNow
  211, // Freeform
  318, // Adult Swim
  322, // USA Network
  363, // TNT
  365, // Bravo TV
  486, // Spectrum On Demand
  506, // TBS
  507, // truTV
  508, // DisneyNOW
  257, // fuboTV
  2383, // Philo
  2528, // YouTube TV
]);

/** "Starz Amazon Channel" -> "Starz": the service a reseller entry sells. */
const RESELLER = /\s+(amazon|apple tv|roku premium) channel$/i;

/** Folds spellings together: "AMC Plus" and "AMC+" are one service. */
function serviceKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+plus\b/g, "+")
    .replace(/[^a-z0-9+]/g, "");
}

/**
 * The subscription services outside the tracked ones that stream a title,
 * one entry per service. TMDB lists a service several times over - its own
 * app, its Amazon, Apple TV and Roku channels, extra tiers - so entries are
 * folded by name: resellers into the service they sell, and anything named
 * after a tracked service ("Netflix Standard with Ads", "Paramount+ Amazon
 * Channel") dropped, since the tracked service already covers it. A service
 * sold only as a channel keeps the channel's logo under the plain name.
 *
 * The id comes from the folded name, not TMDB's id, so a service is the same
 * service on every title whichever of its entries TMDB listed.
 */
export function otherServices(
  availability: TmdbWatchProviders,
  configs: readonly {
    name: string;
    noteAliases: readonly string[];
    watchProviderIds: readonly number[];
  }[],
): OtherServiceRecord[] {
  const trackedIds = new Set(configs.flatMap((c) => c.watchProviderIds));
  const trackedKeys = configs.flatMap((c) => [c.name, ...c.noteAliases]).map(serviceKey);

  const byKey = new Map<string, OtherServiceRecord & { direct: boolean }>();
  for (const p of availability.results[WATCH_REGION]?.flatrate ?? []) {
    if (trackedIds.has(p.provider_id) || NOT_STREAMING_SERVICES.has(p.provider_id)) continue;
    const name = p.provider_name.trim().replace(RESELLER, "");
    const key = serviceKey(name);
    if (!key || trackedKeys.some((tracked) => key.startsWith(tracked))) continue;

    const direct = name === p.provider_name.trim();
    const seen = byKey.get(key);
    if (seen && (seen.direct || !direct)) continue;
    byKey.set(key, {
      id: `other:${key}`,
      name,
      logoPath: p.logo_path ?? null,
      direct,
    });
  }
  return [...byKey.values()].map(({ direct: _direct, ...service }) => service);
}
