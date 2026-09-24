import { useEffect, useRef, useState } from "react";

import { badge, bingeNote, countdown, formatDate, watchTime } from "./format";
import type { Release } from "./format";

/**
 * A single <dialog> shared by the whole grid.
 *
 * Native <dialog> + showModal() gives focus trapping, Escape-to-close and a
 * ::backdrop for free. Doing this by hand is where most modals get
 * accessibility wrong.
 */
export function ReleaseDialog({
  release,
  onClose,
}: {
  release: Release | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (release && !el.open) el.showModal();
    if (!release && el.open) el.close();
    setPlaying(false); // never leave a video running behind a closed dialog
  }, [release]);

  if (!release) return <dialog ref={ref} className="sheet" />;

  const { media } = release;
  const { text, kind } = badge(release);
  const note = bingeNote(release);
  const runtime = watchTime(release.watchTimeMinutes);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      // Clicking the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet__inner">
        <button className="sheet__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="sheet__hero">
          {playing && media.trailer?.embedUrl ? (
            <iframe
              className="sheet__video"
              src={`${media.trailer.embedUrl}?autoplay=1&rel=0`}
              title={media.trailer.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              {media.backdropUrl ? (
                <img src={media.backdropUrl} alt="" />
              ) : (
                <div className="sheet__hero--empty" />
              )}
              {media.trailer?.embedUrl && (
                // Facade: the iframe is not mounted until this is pressed,
                // which keeps a megabyte of player off the initial open.
                <button
                  className="sheet__play"
                  onClick={() => setPlaying(true)}
                >
                  <span aria-hidden="true">▶</span> Play trailer
                </button>
              )}
            </>
          )}
        </div>

        <div className="sheet__body">
          <div className="sheet__badges">
            <span className={`badge badge--${kind}`}>{text}</span>
            {release.isFullDrop === false && <span className="badge badge--weekly">Weekly</span>}
          </div>

          <h2 className="sheet__title">{media.title}</h2>

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

          {media.overview ? (
            <p className="sheet__overview">{media.overview}</p>
          ) : (
            <p className="sheet__overview sheet__overview--empty">
              No synopsis published yet.
            </p>
          )}

          {media.trailer && (
            // Kept even when the embed is available: not every video permits
            // embedding, and rights can change after we cached the record.
            <a
              className="sheet__link"
              href={media.trailer.url}
              target="_blank"
              rel="noreferrer"
            >
              Watch on YouTube →
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}
