import type { Release } from "./format";

type Provider = Release["provider"];

/**
 * A row of service logos. The alt text is the service's name, not "logo":
 * for a screen reader the image IS the information, so it must say which
 * service. Falls back to the name as text when TMDB has no logo.
 */
export function ProviderLogos({ providers }: { providers: readonly Provider[] }) {
  return (
    <ul className="logos">
      {providers.map((p) => (
        <li key={p.id}>
          {p.logoUrl ? (
            <img className="logos__img" src={p.logoUrl} alt={p.name} title={p.name} />
          ) : (
            <span className="logos__name">{p.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
