import type { ReleaseFeedQuery } from "./generated/graphql";

type Release = ReleaseFeedQuery["releases"][number];

/**
 * `availableFrom` is a calendar date, so it is formatted in UTC. Letting the
 * browser interpret "2026-09-22" in local time renders it as the 21st for
 * anyone west of Greenwich - the same bug class daysUntilRelease exists to
 * avoid on the server.
 */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function countdown(days: number): string {
  if (days < 0) return "Available now";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "Next week";
  return `In ${Math.round(days / 7)} weeks`;
}

function badge(release: Release): { text: string; kind: string } {
  const season = release.seasonNumber;
  if (season === null || season === undefined) return { text: "Film", kind: "film" };
  if (season === 1) return { text: "New series", kind: "new" };
  return { text: `Season ${season}`, kind: "returning" };
}

export function ReleaseCard({ release }: { release: Release }) {
  const { media } = release;
  const { text, kind } = badge(release);
  const imminent = release.daysUntilRelease >= 0 && release.daysUntilRelease <= 7;

  return (
    <li className="card">
      <div className="card__art">
        {media.posterUrl ? (
          <img src={media.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className="card__art--empty" aria-hidden="true">
            {media.title.slice(0, 1)}
          </div>
        )}
        <span className={`badge badge--${kind}`}>{text}</span>
      </div>

      <div className="card__body">
        <h2 className="card__title">{media.title}</h2>
        <p className="card__meta">
          <span className={imminent ? "countdown countdown--soon" : "countdown"}>
            {countdown(release.daysUntilRelease)}
          </span>
          <span className="card__date">{formatDate(release.availableFrom)}</span>
        </p>
      </div>
    </li>
  );
}