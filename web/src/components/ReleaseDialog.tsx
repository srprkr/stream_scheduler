import { badge, bingeNote, countdown, formatDate, watchTime } from "../lib/format";
import type { Release } from "../lib/format";
import { Sheet } from "./Sheet";
import { ProviderLogos } from "./ProviderLogos";

/** A release's detail: the shared sheet, plus when and where it arrives. */
export function ReleaseDialog({
  release,
  providers,
  onClose,
}: {

  release: Release | null;
  onClose: () => void;
  providers: readonly Release["provider"][];
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
          <div>
            <dt>{providers.length > 1 ? "Services" : "Service"}</dt>
            <dd className="facts__services">
              <ProviderLogos providers={providers} />
              {providers.map((p) => p.name).join(", ")}
            </dd>
          </div>
        </div>
      </dl>
    </Sheet>
  );
}
