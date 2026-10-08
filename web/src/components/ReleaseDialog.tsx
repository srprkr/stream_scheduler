import { badge, bingeNote, countdown, formatDate, watchTime } from "../lib/format";
import type { Arrival, Release } from "../lib/format";
import { DiscGlyph } from "./DiscLogo";
import { ScoreFact } from "./ScoreBadge";
import { Sheet } from "./Sheet";
import { ProviderLogos } from "./ProviderLogos";

/** A release's detail: the shared sheet, plus when and where it arrives. */
export function ReleaseDialog({
  release,
  providers,
  disc = false,
  onClose,
}: {
  release: Arrival | null;
  onClose: () => void;
  providers: readonly Release["provider"][];
  /** Coming out on disc rather than arriving on a service. */
  disc?: boolean;
}) {
  if (!release) return <Sheet open={false} media={null} onClose={onClose} />;

  const { text, kind } = badge(release, disc);
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
          {release.isFullDrop === false && <span className="badge badge--weekly">Weekly</span>}
        </>
      }
    >
      <dl className="facts">
        <ScoreFact score={release.media.score} />
        <div>
          <dt>{disc ? "Out on disc" : "Arrives"}</dt>
          <dd>
            {formatDate(release.availableFrom, true)} · {countdown(release.daysUntilRelease)}
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
          {disc ? (
            <div>
              <dt>Format</dt>
              <dd className="facts__services">
                <ul className="logos">
                  <li>
                    <DiscGlyph className="logos__img" />
                  </li>
                </ul>
                DVD or Blu-ray
              </dd>
            </div>
          ) : (
            <div>
              <dt>{providers.length > 1 ? "Services" : "Service"}</dt>
              <dd className="facts__services">
                <ProviderLogos providers={providers} />
                {providers.map((p) => p.name).join(", ")}
              </dd>
            </div>
          )}
        </div>
      </dl>
    </Sheet>
  );
}
