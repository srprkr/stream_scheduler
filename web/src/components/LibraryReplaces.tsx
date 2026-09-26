import { ProviderLogos, type LogoProvider } from "./ProviderLogos";
import { replacementSummary } from "../lib/replaces";

/**
 * The services the owned library overlaps, and the titles no service carries.
 * Current availability only: it says what a subscription would be paying for
 * today, not what it might carry later.
 */
export function LibraryReplaces({
  availability,
}: {
  /** One entry per owned title whose details have loaded. */
  availability: readonly (readonly (LogoProvider & { slug: string })[])[];
}) {
  if (availability.length === 0) return null;
  const { services, unhosted } = replacementSummary(availability);

  return (
    <section className="replaces" aria-labelledby="replaces-title">
      <h2 id="replaces-title" className="replaces__title">
        What your library replaces
      </h2>
      <p className="replaces__lede">
        Titles you own that these services stream today. For these, your copy
        does the job the subscription would.
      </p>
      <ul className="replaces__list">
        {services.map(({ provider, titles }) => (
          <li key={provider.slug} className="replaces__row">
            <ProviderLogos providers={[provider]} />
            <span className="replaces__name">{provider.name}</span>
            <span className="replaces__count">
              {titles} {titles === 1 ? "title" : "titles"} you own
            </span>
          </li>
        ))}
        {unhosted > 0 && (
          <li className="replaces__row replaces__row--unhosted">
            <span className="replaces__mark" aria-hidden="true">◆</span>
            <span className="replaces__name">Not on any tracked service</span>
            <span className="replaces__count">
              {unhosted} {unhosted === 1 ? "title" : "titles"}: only your copy plays{" "}
              {unhosted === 1 ? "it" : "these"}
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
