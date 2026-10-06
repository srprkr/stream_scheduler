/**
 * How the user pays for a service: one of its published plans, or a price
 * they type themselves (a bundle, a discount, a plan the app doesn't list).
 */
export type PlanChoice = { planId: string } | { customCents: number | null };

/**
 * When a subscription bills. Monthly plans renew on a day of the month -
 * the 31st falls back to a short month's last day. Annual plans renew on a
 * date, at a yearly price the user types: published plans are monthly.
 */
export type Billing =
  { cycle: "monthly"; day: number } | { cycle: "annual"; renewsOn: string; cents: number | null };

/** A service the user pays for now. */
export interface Subscription {
  slug: string;
  choice: PlanChoice;
  /**
   * "Always keep (bundled or shared)" in the app: kept whatever the plan
   * says, like Prime with shipping. Named leftOut in storage from when it
   * meant "leave out of estimates"; renaming it would orphan saved data.
   */
  leftOut?: boolean;
  /**
   * Unset for services saved before renewal dates existed: their real
   * billing day can't be known, so they get no reminders until it's set.
   * Optional, so no version bump - older saves stay valid.
   */
  billing?: Billing;
}

/** The fields of a published plan that pricing needs. */
export interface PricedPlan {
  id: string;
  monthlyCents: number;
}

/** A published plan as the store needs it when the user picks one. */
export interface PlanDefaults {
  id: string;
  leaveOutByDefault: boolean;
}

export interface SubscriptionStore {
  subscriptions(): readonly Subscription[];
  /** Ticks a service on, on its default plan if it has one, or off. */
  setSubscribed(slug: string, subscribed: boolean, defaultPlan?: PlanDefaults | null): void;
  /**
   * Changes how a subscribed service is paid for. Picking a published plan
   * also resets leftOut to that plan's default; ignored for other services.
   */
  setChoice(slug: string, choice: PlanChoice, plan?: PlanDefaults | null): void;
  /** Keeps a subscribed service out of cost estimates, or brings it back. */
  setLeftOut(slug: string, leftOut: boolean): void;
  /** Sets when a subscribed service bills; ignored for other services. */
  setBilling(slug: string, billing: Billing): void;
  /** Swaps every subscription at once - for restoring a backup. */
  replaceAll(subscriptions: readonly Subscription[]): void;

  subscribe(listener: () => void): () => void;
}

export const SUBSCRIPTIONS_KEY = "stream-scheduler:subscriptions";
const VERSION = 2;

/**
 * Reads the saved subscriptions. Anything unreadable, or saved under another
 * version, is treated as none: there are no earlier versions worth keeping.
 */
function load(raw: string | null): Subscription[] {
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw) as { version: number; subscriptions: unknown };
    return saved.version === VERSION && Array.isArray(saved.subscriptions)
      ? (saved.subscriptions as Subscription[])
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
  now: () => Date = () => new Date(),
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

    setSubscribed(slug, subscribed, defaultPlan = null) {
      const has = snapshot.some((s) => s.slug === slug);
      if (subscribed && !has) {
        const choice: PlanChoice = defaultPlan ? { planId: defaultPlan.id } : { customCents: null };
        commit([
          ...snapshot,
          {
            slug,
            choice,
            leftOut: defaultPlan?.leaveOutByDefault ?? false,
            // A starting guess the user is asked to correct: ticked today,
            // so billed on today's day of the month.
            billing: { cycle: "monthly", day: now().getDate() },
          },
        ]);
      }
      if (!subscribed && has) commit(snapshot.filter((s) => s.slug !== slug));
    },

    setChoice(slug, choice, plan = null) {
      if (!snapshot.some((s) => s.slug === slug)) return;
      commit(
        snapshot.map((s) =>
          s.slug === slug
            ? { ...s, choice, leftOut: plan ? plan.leaveOutByDefault : (s.leftOut ?? false) }
            : s,
        ),
      );
    },

    setLeftOut(slug, leftOut) {
      if (!snapshot.some((s) => s.slug === slug)) return;
      commit(snapshot.map((s) => (s.slug === slug ? { ...s, leftOut } : s)));
    },

    setBilling(slug, billing) {
      if (!snapshot.some((s) => s.slug === slug)) return;
      commit(snapshot.map((s) => (s.slug === slug ? { ...s, billing } : s)));
    },

    replaceAll(subscriptions) {
      commit([...subscriptions]);
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
 * What a subscription costs a month, in cents. An annual plan with a price
 * counts as a twelfth of it. Null when the user chose a custom price and
 * hasn't given one, or picked a plan the app no longer lists.
 */
export function monthlyCents(
  subscription: Subscription,
  plans: readonly PricedPlan[],
): number | null {
  const { choice, billing } = subscription;
  if (billing?.cycle === "annual" && billing.cents !== null) return Math.round(billing.cents / 12);
  if ("planId" in choice) {
    return plans.find((p) => p.id === choice.planId)?.monthlyCents ?? null;
  }
  return choice.customCents;
}

/**
 * The monthly total of the prices that count, how many services have no
 * price, and what the left-out services cost - shown, but kept apart.
 */
export function monthlySpend(
  subscriptions: readonly Subscription[],
  plansFor: (slug: string) => readonly PricedPlan[],
): { cents: number; unpriced: number; leftOutCents: number } {
  let cents = 0;
  let unpriced = 0;
  let leftOutCents = 0;
  for (const s of subscriptions) {
    const price = monthlyCents(s, plansFor(s.slug));
    if (price === null) unpriced++;
    else if (s.leftOut) leftOutCents += price;
    else cents += price;
  }
  return { cents, unpriced, leftOutCents };
}
