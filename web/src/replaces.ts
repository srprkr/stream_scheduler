interface Service {
  slug: string;
  name: string;
}

export interface ServiceShare<P extends Service> {
  provider: P;
  /** Owned titles this service streams. */
  titles: number;
}

export interface Replacement<P extends Service> {
  /** Services the library overlaps, most titles first. */
  services: ServiceShare<P>[];
  /** Owned titles on none of the tracked services. */
  unhosted: number;
}

/**
 * Which subscriptions the owned library stands in for. A title on two
 * services counts toward both: the copy replaces each of them. Titles on none
 * are counted separately - owning them is the only way to watch.
 */
export function replacementSummary<P extends Service>(
  availability: readonly (readonly P[])[],
): Replacement<P> {
  const shares = new Map<string, ServiceShare<P>>();
  let unhosted = 0;
  for (const services of availability) {
    if (services.length === 0) unhosted++;
    for (const provider of services) {
      const share = shares.get(provider.slug);
      if (share) share.titles++;
      else shares.set(provider.slug, { provider, titles: 1 });
    }
  }
  const services = [...shares.values()].sort(
    (a, b) => b.titles - a.titles || a.provider.name.localeCompare(b.provider.name),
  );
  return { services, unhosted };
}
