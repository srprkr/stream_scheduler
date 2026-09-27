import { useEffect, useRef, type ReactNode } from "react";

/**
 * A small modal on the browser's own <dialog>: showModal() brings focus
 * trapping, Escape-to-close and a ::backdrop with it. Sheet is the large,
 * media-shaped version of the same idea; this one holds a form.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Id of the heading inside, which names the dialog for screen readers. */
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // The dialog stays mounted; `open` only decides whether it is showing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={labelledBy}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && <div className="modal__body">{children}</div>}
    </dialog>
  );
}
