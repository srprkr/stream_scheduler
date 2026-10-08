import { badge, bingeNote, countdown, formatDate, watchTime } from "../lib/format";
import type { Release } from "../lib/format";
import { ProviderLogos } from "./ProviderLogos";
import { ShelfToggle } from "./ShelfToggle";

export function ReleaseCard({
  release,
  providers,
  onOpen,
}: {
  release: Release;
  onOpen: () => void;
  /** Every service this title arrives on that day; usually one. */
  providers: readonly Release["provider"][];
}) {
  const { media } = release;
  const { text, kind } = badge(release);
  const note = bingeNote(release);
  const runtime = watchTime(release.watchTimeMinutes);
  const imminent =
    release.isFullDrop && release.daysUntilRelease >= 0 && release.daysUntilRelease <= 7;

  return (
    <li className="card">
      {/* Where it arrives, above the poster as on every other tile - a
          fixed-height slot, so posters line up across a row. */}
      <div className="shelf__services">
        <ProviderLogos providers={providers} />
      </div>

      {/* The poster is the button that opens the release: keyboard and screen
          readers get it for free, and the dialog needs something to return
          focus to. The toggles sit right under it, above the details, so they
          line up across a row - every poster is the same height. */}
      <button className="card__button" onClick={onOpen} aria-label={media.title}>
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
            <span className="card__has-trailer" aria-hidden="true">
              ▶
            </span>
          )}
        </div>
      </button>

      {/* Own/Want if it is on disc; Watchlist for streaming-only titles. */}
      <ShelfToggle
        ownable={media.onDisc}
        item={{
          id: media.id,
          kind: media.__typename,
          title: media.title,
          posterUrl: media.posterUrl ?? null,
        }}
      />

      <div className="card__body">
        {/* A second way in for the mouse: clicking the title opens the same
            dialog as the poster. Not a button, so keyboard and screen-reader
            users don't meet the same action twice; the poster is theirs. */}
        <h2 className="card__title opens-dialog" onClick={onOpen}>
          {media.title}
        </h2>

        <p className="card__meta">
          <span className={imminent ? "countdown countdown--soon" : "countdown"}>
            {countdown(release.daysUntilRelease)}
          </span>
          <span className="card__date">{formatDate(release.availableFrom)}</span>
        </p>
        {/* A weekly season must not read as "Today" when it won't be
            watchable in full for another two months. */}
        {note && <p className="card__note">{note}</p>}
        {!note && release.episodeCount && (
          <p className="card__sub">
            {release.episodeCount} eps{runtime ? ` · ${runtime}` : ""}
          </p>
        )}
      </div>
    </li>
  );
}
