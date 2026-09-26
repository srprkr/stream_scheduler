import { describe, expect, it } from "vitest";

import {
  localSubscriptions,
  monthlyCents,
  monthlySpend,
  SUBSCRIPTIONS_KEY,
} from "../../src/lib/subscriptions";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const netflixPlans = [
  { id: "standard-ads", monthlyCents: 899 },
  { id: "standard", monthlyCents: 1999 },
];

describe("localSubscriptions", () => {
  it("ticks a service onto its default plan, and off again", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true, "standard-ads");
    store.setSubscribed("hulu", true, "ads");
    store.setSubscribed("netflix", false);
    expect(store.subscriptions()).toEqual([{ slug: "hulu", choice: { planId: "ads" } }]);
  });

  it("starts on a blank custom price when a service has no plans", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("mystery", true);
    expect(store.subscriptions()).toEqual([{ slug: "mystery", choice: { customCents: null } }]);
  });

  it("does not duplicate a service ticked twice", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true, "standard-ads");
    store.setSubscribed("netflix", true, "standard-ads");
    expect(store.subscriptions()).toHaveLength(1);
  });

  it("changes the plan only for services the user has", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true, "standard-ads");
    store.setChoice("netflix", { planId: "standard" });
    store.setChoice("hulu", { planId: "ads" });
    expect(store.subscriptions()).toEqual([{ slug: "netflix", choice: { planId: "standard" } }]);
  });

  it("survives a reload from the same storage", () => {
    const storage = memoryStorage();
    const first = localSubscriptions(storage);
    first.setSubscribed("peacock", true, "premium");
    first.setChoice("peacock", { customCents: 799 });
    expect(localSubscriptions(storage).subscriptions()).toEqual([
      { slug: "peacock", choice: { customCents: 799 } },
    ]);
  });

  it("carries version-1 prices forward as custom prices", () => {
    const v1 = JSON.stringify({
      version: 1,
      subscriptions: [
        { slug: "netflix", monthlyCents: 1549 },
        { slug: "hulu", monthlyCents: null },
      ],
    });
    const store = localSubscriptions(memoryStorage({ [SUBSCRIPTIONS_KEY]: v1 }));
    expect(store.subscriptions()).toEqual([
      { slug: "netflix", choice: { customCents: 1549 } },
      { slug: "hulu", choice: { customCents: null } },
    ]);
  });
});

describe("pricing", () => {
  it("prices a plan choice from the published plans", () => {
    expect(monthlyCents({ slug: "netflix", choice: { planId: "standard" } }, netflixPlans)).toBe(1999);
  });

  it("has no price for a plan the app no longer lists", () => {
    expect(monthlyCents({ slug: "netflix", choice: { planId: "retired" } }, netflixPlans)).toBeNull();
  });

  it("adds known prices and counts the unknown ones", () => {
    const spend = monthlySpend(
      [
        { slug: "netflix", choice: { planId: "standard-ads" } },
        { slug: "hulu", choice: { customCents: 1249 } },
        { slug: "peacock", choice: { customCents: null } },
      ],
      (slug) => (slug === "netflix" ? netflixPlans : []),
    );
    expect(spend).toEqual({ cents: 899 + 1249, unpriced: 1 });
  });
});
