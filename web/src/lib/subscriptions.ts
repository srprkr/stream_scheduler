/** A service the user pays for now. */
export interface Subscription {
  slug: string;
  /** What they pay each month, in cents. Null until they say. */
  monthlyCents: number | null;
}

export interface SubscriptionStore {
  subscriptions(): readonly Subscription[];
  /** Ticks a service on or off. Unticking forgets its price. */
  setSubscribed(slug: string, subscribed: boolean): void;
  /** Sets or clears a subscribed service's price; ignored for any other. */
  setPrice(slug: string, monthlyCents: number | null): void;
  subscribe(listener: () => void): () => void;
}

export const SUBSCRIPTIONS_KEY = "stream-scheduler:subscriptions";
const VERSION = 1;

function load(raw: string | null): Subscription[] {
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw) as { version: number; subscriptions: Subscription[] };
    return saved.version === VERSION && Array.isArray(saved.subscriptions)
      ? saved.subscriptions
      : [];
  } catch {
    return [];
  }
}

/**
 * The user's services in browser storage. The same shape as the library's
 * store - snapshot, subscribe, write-through - for the same reasons: React
 * reads it with useSyncExternalStore, and every change is a new array.
 *
 * Two stores now share this pattern. A third would be the time to pull it
 * into a generic helper; two is not yet a pattern worth abstracting.
 */
export function localSubscriptions(
  storage: Pick<Storage, "getItem" | "setItem">,
): SubscriptionStore & { reload(): void } {
  let snapshot = load(storage.getItem(SUBSCRIPTIONS_KEY));
  const listeners = new Set<() => void>();

  const commit = (next: Subscription[]) => {
    snapshot = next;
    try {
      storage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify({ version: VERSION, subscriptions: next }));
    } catch {
      // Quota exceeded or storage disabled: keep working from memory.
    }
    listeners.forEach((listener) => listener());
  };

  return {
    subscriptions: () => snapshot,

    setSubscribed(slug, subscribed) {
      const has = snapshot.some((s) => s.slug === slug);
      if (subscribed && !has) commit([...snapshot, { slug, monthlyCents: null }]);
      if (!subscribed && has) commit(snapshot.filter((s) => s.slug !== slug));
    },

    setPrice(slug, monthlyCents) {
      if (!snapshot.some((s) => s.slug === slug)) return;
      commit(snapshot.map((s) => (s.slug === slug ? { ...s, monthlyCents } : s)));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reload() {
      snapshot = load(storage.getItem(SUBSCRIPTIONS_KEY));
      listeners.forEach((listener) => listener());
    },
  };
}

/** The monthly total of the prices the user has given, and how many are missing. */
export function monthlySpend(subscriptions: readonly Subscription[]): {
  cents: number;
  unpriced: number;
} {
  let cents = 0;
  let unpriced = 0;
  for (const s of subscriptions) {
    if (s.monthlyCents === null) unpriced++;
    else cents += s.monthlyCents;
  }
  return { cents, unpriced };
}
