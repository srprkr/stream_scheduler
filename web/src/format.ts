import type { ReleaseFeedQuery } from "./generated/graphql";

export type Release = ReleaseFeedQuery["releases"][number];

/**
 * `availableFrom` is a calendar date, so it is formatted in UTC. Letting the
 * browser interpret "2026-09-22" in local time renders it as the 21st for
 * anyone west of Greenwich - the same bug class daysUntilRelease exists to
 * avoid on the server.
 */
export function formatDate(iso: string, withYear = false): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function countdown(days: number): string {
  if (days < 0) return "Available now";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "Next week";
  return `In ${Math.round(days / 7)} weeks`;
}

export function badge(release: Release): { text: string; kind: string } {
  const season = release.seasonNumber;
  if (season === null || season === undefined) return { text: "Film", kind: "film" };
  if (season === 1) return { text: "New series", kind: "new" };
  return { text: `Season ${season}`, kind: "returning" };
}

export function watchTime(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * The line that actually answers "should I unsubscribe this month?".
 * A weekly season is not worth resuming for until its last episode lands.
 */
export function bingeNote(release: Release): string | null {
  if (release.isFullDrop) return null;
  return `Airs weekly — complete ${formatDate(release.bingeableFrom)}`;
}
