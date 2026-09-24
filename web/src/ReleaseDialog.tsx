import { badge, bingeNote, countdown, formatDate, watchTime } from "./format";
import type { Release } from "./format";
import { Sheet } from "./Sheet";

/** A release's detail: the shared sheet, plus when and where it arrives. */
export function ReleaseDialog({
  release,
  onClose,
}: {
  release: Release | null;
  onClose: () => void;
}) {
  if (!release) return <Sheet open={false} media={null} onClose={onClose} />;

  const { text, kind } = badge(release);
  const note = bingeNote(release);
  const runtime = watchTime(release.watchTimeMinutes);

  return (
    <Sheet
      open
      media={release.media}
      onClose={onClose}
      badges={
        <>
          <span className={`badge badge--${kind}`}>{text}</span>
          {release.isFullDrop === false && (
            <span className="badge badge--weekly">Weekly</span>
          )}
        </>
      }
    >
      <dl className="facts">
        <div>
          <dt>Arrives</dt>
          <dd>
            {formatDate(release.availableFrom, true)} ·{" "}
            {countdown(release.daysUntilRelease)}
          </dd>
        </div>
        {note && (
          <div>
            <dt>Bingeable</dt>
            <dd className="facts__warn">{note}</dd>
          </div>
        )}
        {release.episodeCount && (
          <div>
            <dt>Episodes</dt>
            <dd>
              {release.episodeCount}
              {runtime ? ` · ${runtime} total` : ""}
            </dd>
          </div>
        )}
        {!release.episodeCount && runtime && (
          <div>
            <dt>Runtime</dt>
            <dd>{runtime}</dd>
          </div>
        )}
        <div>
          <dt>Service</dt>
          <dd>{release.provider.name}</dd>
        </div>
      </dl>
    </Sheet>
  );
}
