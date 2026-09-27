/** An owned title and the tracked services that stream it today. */
export interface OwnedTitle {
  title: string;
  availableOn: readonly { slug: string }[];
}

export interface Replacement {
  /** Owned titles each service streams, alphabetical, keyed by slug. */
  bySlug: Map<string, string[]>;
  /** Owned titles on none of the tracked services, alphabetical. */
  unhosted: string[];
}

/**
 * Which of the user's owned titles each service streams. A title on two
 * services is listed under both: the copy stands in for each of them. Titles
 * on none are kept apart - owning them is the only way to watch.
 */
export function replacementSummary(owned: readonly OwnedTitle[]): Replacement {
  const bySlug = new Map<string, string[]>();
  const unhosted: string[] = [];
  for (const { title, availableOn } of owned) {
    if (availableOn.length === 0) unhosted.push(title);
    for (const { slug } of availableOn) {
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), title]);
    }
  }
  const byTitle = (a: string, b: string) => a.localeCompare(b);
  for (const titles of bySlug.values()) titles.sort(byTitle);
  return { bySlug, unhosted: unhosted.sort(byTitle) };
}

/** "A, B and C", or "A, B and 4 more" past `max` titles. */
export function listTitles(titles: readonly string[], max = 5): string {
  if (titles.length <= 1) return titles.join("");
  if (titles.length > max) {
    return `${titles.slice(0, max - 1).join(", ")} and ${titles.length - (max - 1)} more`;
  }
  return `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
}
