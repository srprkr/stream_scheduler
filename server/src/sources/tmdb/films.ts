import { WATCH_REGION } from "./services.js";
import type { TmdbReleaseDates } from "./types.js";

/**
 * What a film's TMDB release dates say: when it premieres on a streaming
 * service, and whether it has been out on disc.
 */

/** TMDB release type for a digital release, streaming premieres included. */
export const DIGITAL_RELEASE = 4;

/**
 * Words that mark a digital note as a rent-or-buy release. "Apple TV" and
 * "Prime Video" are also storefronts, so "Apple TV, Prime Video, Google VOD"
 * is a rental listing, not two streaming premieres.
 */
const STOREFRONT = /\b(vod|tvod|google|vudu|fandango|itunes|rent|buy)\b/;

/**
 * Streaming premieres hidden in a film's release dates: US Digital entries
 * whose note names a configured service. The note is user-entered free text
 * ("HBO Max", "Max", "Hulu / Netflix"), so it is split on "/" and "," and each
 * part matched exactly against the service's aliases. A blank note is a
 * rent-or-buy release and matches nothing.
 */
export function streamingPremieres(
  dates: TmdbReleaseDates,
  configs: readonly { slug: string; noteAliases: readonly string[] }[],
): { slug: string; date: string }[] {
  const local = dates.results.find((c) => c.iso_3166_1 === WATCH_REGION);
  const premieres: { slug: string; date: string }[] = [];
  for (const d of local?.release_dates ?? []) {
    if (d.type !== DIGITAL_RELEASE) continue;
    const parts = d.note
      .toLowerCase()
      .split(/[\/,]/)
      .map((p) => p.trim());
    if (parts.some((p) => STOREFRONT.test(p))) continue;
    for (const config of configs) {
      if (parts.some((p) => config.noteAliases.includes(p))) {
        premieres.push({ slug: config.slug, date: d.release_date.slice(0, 10) });
      }
    }
  }
  return premieres;
}

/** TMDB's release type for a physical release: DVD, Blu-ray or 4K disc. */
export const PHYSICAL_RELEASE = 5;

/**
 * Whether a film has been released on disc anywhere. Any country, not just
 * the US: TMDB's US entries have gaps - Heat has discs in Canada, the UK,
 * Germany and France on record, but no US row - and a film on disc abroad is
 * on disc here too.
 */
export function filmOnDisc(dates: TmdbReleaseDates): boolean {
  return dates.results.some((country) =>
    country.release_dates.some((d) => d.type === PHYSICAL_RELEASE),
  );
}

/**
 * The film's first US disc release between `from` and `to`, inclusive, or
 * null. Discover finds a re-release - a 4K edition of a 2000 film - by its
 * new date but lists it under its first one, so the date has to come from
 * here.
 */
export function usDiscRelease(dates: TmdbReleaseDates, from: string, to: string): string | null {
  const local = dates.results.find((c) => c.iso_3166_1 === WATCH_REGION);
  const inWindow = (local?.release_dates ?? [])
    .filter((d) => d.type === PHYSICAL_RELEASE)
    .map((d) => d.release_date.slice(0, 10))
    .filter((date) => date >= from && date <= to)
    .sort();
  return inWindow[0] ?? null;
}
