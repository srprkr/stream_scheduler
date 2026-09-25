/** The fields grouping reads. The generated Release type fits it. */
interface Arrival {
  media: { id: string };
  availableFrom: string;
  seasonNumber?: number | null;
  provider: unknown;
}

export interface ArrivalGroup<R extends Arrival> {
  /** The first release in the group; everything but `provider` is shared. */
  release: R;
  providers: R["provider"][];
}

/**
 * One tile per title arriving on a date, however many services it arrives on.
 *
 * The server keeps one Release per service, which is what lets a title reach
 * different services on different dates. Merging them for display is the
 * client's job, and only when the arrival is the same event: same title, same
 * season, same day. A film that reaches HBO Max in March and Hulu in October
 * stays two tiles, because those are two decisions.
 *
 * Order is preserved: a Map iterates in insertion order, so a feed sorted by
 * date stays sorted by date.
 */
export function groupByArrival<R extends Arrival>(
  releases: readonly R[],
): ArrivalGroup<R>[] {
  const groups = new Map<string, ArrivalGroup<R>>();
  for (const release of releases) {
    const key = [release.media.id, release.seasonNumber ?? "", release.availableFrom].join("|");
    const group = groups.get(key);
    if (group) group.providers.push(release.provider);
    else groups.set(key, { release, providers: [release.provider] });
  }
  return [...groups.values()];
}
