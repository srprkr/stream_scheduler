/**
 * How the user pays for a service: one of its published plans, or a price
 * they type themselves (a bundle, a discount, a plan the app doesn't list).
 */
export type PlanChoice = { planId: string } | { customCents: number | null };

/** A service the user pays for now. */
export interface Subscription {
  slug: string;
  choice: PlanChoice;
}

/** The fields of a published plan that pricing needs. */
export interface PricedPlan {
  id: string;
  monthlyCents: number;
}

export interface SubscriptionStore {
  subscriptions(): readonly Subscription[];
  /** Ticks a service on, on its default plan if it has one, or off. */
  setSubscribed(slug: string, subscribed: boolean, defaultPlanId?: string | null): void;
  /** Changes how a subscribed service is paid for; ignored for any other. */
  setChoice(slug: string, choice: PlanChoice): void;
  subscribe(listener: () => void): () => void;
}

export const SUBSCRIPTIONS_KEY = "stream-scheduler:subscriptions";
const VERSION = 2;

/** Version 1 stored a bare price, before plans existed. */
interface SubscriptionV1 {
  slug: string;
  monthlyCents: number | null;
}

/**
 * Reads any saved version and returns the current shape. A version-1 price
 * becomes a custom price: it was typed by hand, and there is no telling
 * which plan it was.
 */
function load(raw: string | null): Subscription[] {
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw) as { version: number; subscriptions: unknown };
    if (!Array.isArray(saved.subscriptions)) return [];
    if (saved.version === VERSION) return saved.subscriptions as Subscription[];
    if (saved.version === 1) {
      return (saved.subscriptions as SubscriptionV1[]).map((s) => ({
        slug: s.slug,
        choice: { customCents: s.monthlyCents },
      }));
    }
    return [];
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

    setSubscribed(slug, subscribed, defaultPlanId = null) {
      const has = snapshot.some((s) => s.slug === slug);
      if (subscribed && !has) {
        const choice: PlanChoice = defaultPlanId
          ? { planId: defaultPlanId }
          : { customCents: null };
        commit([...snapshot, { slug, choice }]);
      }
      if (!subscribed && has) commit(snapshot.filter((s) => s.slug !== slug));
    },

    setChoice(slug, choice) {
      if (!snapshot.some((s) => s.slug === slug)) return;
      commit(snapshot.map((s) => (s.slug === slug ? { ...s, choice } : s)));
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

/**
 * What a subscription costs a month, in cents. Null when the user chose a
 * custom price and hasn't given one, or picked a plan the app no longer lists.
 */
export function monthlyCents(
  subscription: Subscription,
  plans: readonly PricedPlan[],
): number | null {
  const { choice } = subscription;
  if ("planId" in choice) {
    return plans.find((p) => p.id === choice.planId)?.monthlyCents ?? null;
  }
  return choice.customCents;
}

/** The monthly total of the known prices, and how many are unknown. */
export function monthlySpend(
  subscriptions: readonly Subscription[],
  plansFor: (slug: string) => readonly PricedPlan[],
): { cents: number; unpriced: number } {
  let cents = 0;
  let unpriced = 0;
  for (const s of subscriptions) {
    const price = monthlyCents(s, plansFor(s.slug));
    if (price === null) unpriced++;
    else cents += price;
  }
  return { cents, unpriced };
}
