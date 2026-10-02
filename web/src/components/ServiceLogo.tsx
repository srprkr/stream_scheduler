/**
 * A service's logo, or its first letter when TMDB has none, greyed when it
 * isn't the user's, with an optional count pinned to its corner. Decorative
 * to screen readers: whatever wraps it says the name and the count in words.
 *
 * "tile" fills a .service-tile button; "row" sits at the start of a list
 * line; "chip" is a filter toggle, the height of a text tag.
 */
export function ServiceLogo({
  name,
  logoUrl,
  active,
  count = 0,
  size = "tile",
}: {
  name: string;
  logoUrl?: string | null | undefined;
  active: boolean;
  /** Shown only when above zero. */
  count?: number;
  size?: "tile" | "row" | "chip";
}) {
  return (
    <span className={`service-logo service-logo--${size}`} data-active={active} aria-hidden="true">
      {logoUrl ? (
        <img className="service-logo__img" src={logoUrl} alt="" />
      ) : (
        <span className="service-logo__initial">{name.slice(0, 1)}</span>
      )}
      {count > 0 && <span className="service-logo__count">{count}</span>}
    </span>
  );
}
