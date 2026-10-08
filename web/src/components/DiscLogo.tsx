/**
 * The mark for "On disc": a disc on a dark tile, the shape and size of a
 * service logo so it sits in a row of them. Drawn here rather than borrowed
 * from the DVD or Blu-ray logos, which are trademarks - and too fine to read
 * at 22px. A highlight arc each side is what makes it a disc, not a ring.
 */
export function DiscGlyph({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {label && <title>{label}</title>}
      <rect width="24" height="24" rx="5" fill="#2a2a34" />
      <circle cx="12" cy="12" r="8.5" fill="#c9ccd8" />
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="#9fa3b3" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="2.2" fill="#2a2a34" />
      <g fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round">
        <path d="M12 5.6a6.4 6.4 0 0 1 6.4 6.4" />
        <path d="M12 18.4A6.4 6.4 0 0 1 5.6 12" opacity="0.6" />
      </g>
    </svg>
  );
}

/** The filter chip's version: sized and greyed like a ServiceLogo chip. */
export function DiscLogo({ active }: { active: boolean }) {
  return (
    <span className="service-logo service-logo--chip" data-active={active} aria-hidden="true">
      <DiscGlyph className="service-logo__img" />
    </span>
  );
}
