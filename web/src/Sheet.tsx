import { useEffect, useRef, useState, type ReactNode } from "react";

/** The media fields the sheet itself renders. Both dialogs' query types fit it. */
export interface SheetMedia {
  title: string;
  overview?: string | null;
  backdropUrl?: string | null;
  trailer?: { name: string; url: string; embedUrl?: string | null } | null;
}

/**
 * The shell shared by every detail dialog: native <dialog>, hero art, trailer
 * facade, synopsis and the YouTube fallback. Callers supply only what differs,
 * the badges and the facts.
 *
 * Native <dialog> + showModal() gives focus trapping, Escape-to-close and a
 * ::backdrop for free. Doing this by hand is where most modals get
 * accessibility wrong.
 */
export function Sheet({
  open,
  media,
  onClose,
  badges,
  children,
}: {
  open: boolean;
  /** Null while the caller is still loading; the sheet opens anyway. */
  media: SheetMedia | null;
  onClose: () => void;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    setPlaying(false); // never leave a video running behind a closed dialog
  }, [open, media]);

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
      {open && (
        <div className="sheet__inner">
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>

          <div className="sheet__hero">
            {playing && media?.trailer?.embedUrl ? (
              <iframe
                className="sheet__video"
                src={`${media.trailer.embedUrl}?autoplay=1&rel=0`}
                title={media.trailer.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
                {media?.backdropUrl ? (
                  <img src={media.backdropUrl} alt="" />
                ) : (
                  <div className="sheet__hero--empty" />
                )}
                {media?.trailer?.embedUrl && (
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
            {!media ? (
              <p className="state">Loading…</p>
            ) : (
              <>
                {badges && <div className="sheet__badges">{badges}</div>}

                <h2 className="sheet__title">{media.title}</h2>

                {children}

                {media.overview ? (
                  <p className="sheet__overview">{media.overview}</p>
                ) : (
                  <p className="sheet__overview sheet__overview--empty">
                    No synopsis published yet.
                  </p>
                )}

                {media.trailer && (
                  // Kept even when the embed is available: not every video
                  // permits embedding, and rights can change after we cached
                  // the record.
                  <a
                    className="sheet__link"
                    href={media.trailer.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Watch on YouTube →
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
