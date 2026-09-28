/**
 * Whether a TV series has been released on DVD or Blu-ray. "Owning" a title
 * means holding a disc: a digital purchase is a licence the store can lose,
 * so it doesn't count.
 *
 * TMDB records physical releases for films but not for TV, and no free source
 * fills the gap. So series use a rule of thumb, checked by hand like the price
 * table:
 *
 * - Broadcast and cable networks sell their shows on disc as a matter of
 *   course (The Simpsons, The Office, Game of Thrones).
 * - Streaming services mostly keep their originals to themselves (Reacher,
 *   Severance).
 * - EXCEPTIONS fixes the misses in either direction, by TMDB series id.
 *
 * The ids are TMDB's network ids, verified 2026-09-27.
 */

/** Networks whose series are released on disc. Anything else, isn't. */
export const DISC_NETWORKS = new Map<number, string>([
  // US broadcast
  [2, "ABC"],
  [6, "NBC"],
  [16, "CBS"],
  [19, "FOX"],
  [71, "The CW"],
  [14, "PBS"],
  // US premium cable
  [49, "HBO"],
  [67, "Showtime"],
  [318, "Starz"],
  [359, "Cinemax"],
  // US basic cable
  [174, "AMC"],
  [88, "FX"],
  [1035, "FXX"],
  [47, "Comedy Central"],
  [80, "Adult Swim"],
  [56, "Cartoon Network"],
  [13, "Nickelodeon"],
  [54, "Disney Channel"],
  [68, "TBS"],
  [41, "TNT"],
  [30, "USA Network"],
  [77, "Syfy"],
  [74, "Bravo"],
  [129, "A&E"],
  [34, "Lifetime"],
  // UK
  [4, "BBC One"],
  [332, "BBC Two"],
  [9, "ITV1"],
  [26, "Channel 4"],
]);

/**
 * Series the network rule gets wrong, by TMDB series id: true means "is on
 * disc", false means "isn't". Add to this as misses turn up.
 */
export const EXCEPTIONS = new Map<number, boolean>([
  [65494, true], // The Crown - Netflix, but sold as DVD and Blu-ray box sets
  [66732, true], // Stranger Things - Netflix; season 1 had a disc release
]);

/** The rule, then the exceptions: whether this series can be owned on disc. */
export function seriesOnDisc(seriesId: number, networkIds: readonly number[]): boolean {
  return EXCEPTIONS.get(seriesId) ?? networkIds.some((id) => DISC_NETWORKS.has(id));
}
