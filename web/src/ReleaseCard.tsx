import { badge, bingeNote, countdown, formatDate, watchTime } from "./format";
import type { Release } from "./format";
import  { ProviderLogos } from "./ProviderLogos";

export function ReleaseCard({
  release,
  providers,
  onOpen,
  showProvider,
}: {

  release: Release;
  onOpen: () => void;
  /** Every service this title arrives on that day; usually one. */
  providers: readonly Release["provider"][];

  /** Only worth the pixels when the feed is mixing services. */
  showProvider: boolean;
}) {

  const { media } = release;
  const { text, kind } = badge(release);
  const note = bingeNote(release);
  const runtime = watchTime(release.watchTimeMinutes);
  const imminent =
    release.isFullDrop &&
    release.daysUntilRelease >= 0 &&
    release.daysUntilRelease <= 7;

  return (
    <li className="card">
      {/* A button, not a div with onClick: keyboard and screen readers get
          this for free, and the dialog needs something to return focus to. */}
      <button className="card__button" onClick={onOpen}>
        <div className="card__art">
          {media.posterUrl ? (
            <img src={media.posterUrl} alt="" loading="lazy" />
          ) : (
            <div className="card__art--empty" aria-hidden="true">
              {media.title.slice(0, 1)}
            </div>
          )}
          <span className={`badge badge--${kind}`}>{text}</span>
          {media.trailer?.embedUrl && (
            <span className="card__has-trailer" aria-hidden="true">▶</span>
          )}
        </div>

        <div className="card__body">
          {showProvider && <ProviderLogos providers={providers} />}

          <h2 className="card__title">{media.title}</h2>

          <p className="card__meta">
            <span className={imminent ? "countdown countdown--soon" : "countdown"}>
              {countdown(release.daysUntilRelease)}
            </span>
            <span className="card__date">{formatDate(release.availableFrom)}</span>
          </p>
          {/* The whole point of Stage 7: a weekly season must not read as
              "Today" when it is not watchable for another two months. */}
          {note && <p className="card__note">{note}</p>}
          {!note && release.episodeCount && (
            <p className="card__sub">
              {release.episodeCount} eps{runtime ? ` · ${runtime}` : ""}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}
