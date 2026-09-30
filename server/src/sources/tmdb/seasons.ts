import type { RuntimeRecord } from "../types.js";
import { addDays, isoDate } from "../../dates.js";
import type { TmdbEpisode, TmdbSeasonDetail, TmdbTvDetail } from "./types.js";

/**
 * Reading a series' episode dates: when a season is watchable in one sitting,
 * how long the whole series runs, and which season comes next.
 */

export type SeasonAnalysis = ReturnType<typeof analyseSeason>;

/**
 * Collapses a season's episode dates into the two facts the product needs:
 * when the season is fully watchable, and whether it lands all at once.
 *
 * Netflix mostly full-drops, but not always - a weekly season can span two
 * months, and treating its premiere as the binge date is what would tell a
 * user to unpause eight weeks early.
 */
export function analyseSeason(season: TmdbSeasonDetail): {
  firstAirDate: string | null;
  bingeableFrom: string | null;
  isFullDrop: boolean | null;
  episodeCount: number;
  watchTimeMinutes: number | null;
} {
  const dates = season.episodes
    .map((e) => e.air_date)
    .filter((d): d is string => Boolean(d))
    .sort();

  const runtimes = season.episodes
    .map((e) => e.runtime)
    .filter((r): r is number => typeof r === "number" && r > 0);
  // Partial runtime data would understate the season, so it is all or nothing.
  const watchTimeMinutes =
    runtimes.length === season.episodes.length && runtimes.length > 0
      ? runtimes.reduce((a, b) => a + b, 0)
      : null;

  if (dates.length === 0) {
    return {
      firstAirDate: null,
      bingeableFrom: null,
      isFullDrop: null,
      episodeCount: season.episodes.length,
      watchTimeMinutes,
    };
  }
  // Two distinct dates prove a weekly season even with gaps; one date proves
  // nothing while other episodes are undated.
  const weekly = new Set(dates).size > 1;
  // TMDB lists a season's episodes as they are announced, so two dated
  // episodes of a twenty-two-episode season look finished. Only a finale
  // marker settles it - or one shared date across several episodes, which
  // is a full drop released whole. Until then the finale date, and the
  // season's total runtime, are unknown.
  const hasFinale = season.episodes.some((e) => e.episode_type === "finale");
  const complete =
    dates.length === season.episodes.length &&
    (hasFinale || (!weekly && season.episodes.length > 1));
  return {
    firstAirDate: dates[0] as string,
    bingeableFrom: complete ? (dates[dates.length - 1] as string) : null,
    isFullDrop: weekly ? false : complete ? true : null,
    episodeCount: season.episodes.length,
    watchTimeMinutes: complete ? watchTimeMinutes : null,
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Minutes to watch every aired episode of a series once.
 *
 * Specials (season 0) and episodes that have not aired are left out: they are
 * not what a box set holds. An aired episode with no runtime is counted at
 * its season's median length - or the whole series' median, if nothing in its
 * season has one - and the total is marked as an estimate. Unlike a season's
 * watchTimeMinutes, which refuses partial data, a library total is more useful
 * as a close estimate than as nothing.
 */
export function seriesRuntime(
  seasons: readonly TmdbSeasonDetail[],
  today: string,
): RuntimeRecord | null {
  const aired = seasons
    .filter((s) => s.season_number > 0)
    .map((s) => s.episodes.filter((e) => e.air_date !== null && e.air_date <= today));
  const known = (episodes: readonly TmdbEpisode[]) =>
    episodes.map((e) => e.runtime).filter((r): r is number => typeof r === "number" && r > 0);

  const seriesMedian = median(aired.flatMap(known));
  if (seriesMedian === null) return null;

  let minutes = 0;
  let estimated = false;
  for (const episodes of aired) {
    const fill = median(known(episodes)) ?? seriesMedian;
    for (const e of episodes) {
      if (e.runtime && e.runtime > 0) {
        minutes += e.runtime;
      } else {
        minutes += fill;
        estimated = true;
      }
    }
  }
  return { minutes: Math.round(minutes), estimated };
}

const MS_PER_DAY = 86_400_000;

/**
 * When a still-unscheduled weekly season will probably end.
 *
 * If the new season already lists as many episodes as the last one, every
 * one of them dated, its last date is the likely finale: the schedule is out
 * and TMDB just hasn't marked the finale yet. The Rings of Power's third
 * season lists eight dated episodes - four at once, then two a week - ending
 * Nov 25, with no finale marker.
 *
 * Otherwise, the premiere plus how long the previous season ran, premiere to
 * finale: Abbott Elementary's fifth season ran 203 days, so a sixth
 * premiering Oct 7 is estimated for late April. Never earlier than an episode
 * already dated, though - a season that has changed its cadence can outrun
 * the last one's span.
 *
 * Only a previous season that is known to be complete (it has a finale) and
 * aired weekly gives anything worth copying; anything else gives no estimate.
 * Episode orders do change - a strike-shortened season runs half as long -
 * which is why this stays a separate, labelled estimate.
 */
export function expectedFinale(
  premieresOn: string | null,
  previous: TmdbSeasonDetail | null,
  current: TmdbSeasonDetail | null = null,
): string | null {
  if (!premieresOn || !previous) return null;
  const last = analyseSeason(previous);
  if (!last.firstAirDate || !last.bingeableFrom || last.isFullDrop !== false) return null;

  const episodes = current?.episodes ?? [];
  const dated = episodes
    .map((e) => e.air_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const lastDated = dated.at(-1) ?? null;
  if (lastDated && dated.length === episodes.length && dated.length >= last.episodeCount) {
    return lastDated;
  }

  // Both are calendar dates parsed at UTC midnight, so the gap is whole days.
  const span = (Date.parse(last.bingeableFrom) - Date.parse(last.firstAirDate)) / MS_PER_DAY;
  const copied = isoDate(addDays(new Date(Date.parse(premieresOn)), span));
  return lastDated && lastDated > copied ? lastDated : copied;
}

/**
 * Which season a series is releasing now or will release next, or null.
 *
 * A dated next episode settles it. Failing that, a returning series may
 * already list a season it hasn't dated yet - Severance's third, say - and
 * that is worth knowing too: it says "stay paused, nothing to watch yet".
 * Finished, cancelled and between-announcement shows have no next season.
 */
export function nextSeasonNumber(detail: TmdbTvDetail): number | null {
  if (detail.next_episode_to_air) return detail.next_episode_to_air.season_number;
  if (detail.status !== "Returning Series") return null;
  const lastAired = detail.last_episode_to_air?.season_number ?? 0;
  const announced = (detail.seasons ?? [])
    .map((s) => s.season_number)
    .filter((n) => n > lastAired)
    .sort((a, b) => a - b);
  return announced[0] ?? null;
}
