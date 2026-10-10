import { useRef } from "react";

import type { LibraryEntry } from "../lib/library";

/**
 * A list as a view shows it, with anything that drops out of it during the
 * visit kept in place, marked `removed`. Un-owning a title by mistake then
 * doesn't whisk its tile away before the user can see what they did - it
 * greys out where it was, with its toggles still there to put it back. The
 * memory lasts as long as the view: leaving the page clears it.
 *
 * New items take their place in the list's own order; a kept one holds its
 * spot, so nothing shifts under the pointer. `keep` says whether a vanished
 * item stays: false drops it as usual - for one that has only moved to
 * another part of the same page, which shows it there.
 */
export function useKeptOnScreen<T extends { id: string }>(
  items: readonly T[],
  keep: (id: string) => boolean = () => true,
): { item: T; removed: boolean }[] {
  const memory = useRef<{ order: string[]; byId: Map<string, T> }>({
    order: [],
    byId: new Map(),
  });
  const { order, byId } = memory.current;
  const present = new Set(items.map((i) => i.id));

  // Gone, and not to be kept: forget it.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i] as string;
    if (!present.has(id) && !keep(id)) {
      order.splice(i, 1);
      byId.delete(id);
    }
  }
  // New: in before the next item the list already had, or at the end.
  items.forEach((item, i) => {
    byId.set(item.id, item);
    if (order.includes(item.id)) return;
    const next = items.slice(i + 1).find((n) => order.includes(n.id));
    order.splice(next ? order.indexOf(next.id) : order.length, 0, item.id);
  });

  return order.map((id) => ({ item: byId.get(id) as T, removed: !present.has(id) }));
}

/** What a kept-but-gone tile says: where the title went, if anywhere. */
export function removedLabel(entry: LibraryEntry | undefined): string {
  if (entry?.shelf === "owned") return "Now owned";
  if (entry?.shelf === "wanted") return "Now on wishlist";
  if (entry?.shelf === "watchlist") return "Now on watchlist";
  return "Removed";
}
