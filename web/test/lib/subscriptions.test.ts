import { describe, expect, it } from "vitest";

import {
  localSubscriptions,
  monthlyCents,
  monthlySpend,
} from "../../src/lib/subscriptions";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const standardAds = { id: "standard-ads", leaveOutByDefault: false };
const huluAds = { id: "ads", leaveOutByDefault: false };
const amazonPrime = { id: "with-prime", leaveOutByDefault: true };

const netflixPlans = [
  { id: "standard-ads", monthlyCents: 899 },
  { id: "standard", monthlyCents: 1999 },
];

describe("localSubscriptions", () => {
  it("ticks a service onto its default plan, and off again", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true, standardAds);
    store.setSubscribed("hulu", true, huluAds);
    store.setSubscribed("netflix", false);
    expect(store.subscriptions()).toEqual([
      { slug: "hulu", choice: { planId: "ads" }, leftOut: false },
    ]);
  });

  it("starts on a blank custom price when a service has no plans", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("mystery", true);
    expect(store.subscriptions()).toEqual([
      { slug: "mystery", choice: { customCents: null }, leftOut: false },
    ]);
  });

  it("does not duplicate a service ticked twice", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true, standardAds);
    store.setSubscribed("netflix", true, standardAds);
    expect(store.subscriptions()).toHaveLength(1);
  });

  it("changes the plan only for services the user has", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true, standardAds);
    store.setChoice("netflix", { planId: "standard" }, { id: "standard", leaveOutByDefault: false });
    store.setChoice("hulu", { planId: "ads" }, huluAds);
    expect(store.subscriptions()).toEqual([
      { slug: "netflix", choice: { planId: "standard" }, leftOut: false },
    ]);
  });

  it("survives a reload from the same storage", () => {
    const storage = memoryStorage();
    const first = localSubscriptions(storage);
    first.setSubscribed("peacock", true, { id: "premium", leaveOutByDefault: false });
    first.setChoice("peacock", { customCents: 799 });
    expect(localSubscriptions(storage).subscriptions()).toEqual([
      { slug: "peacock", choice: { customCents: 799 }, leftOut: false },
    ]);
  });
});

describe("leaving a service out of estimates", () => {
  it("starts a plan that pays for more than streaming left out", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("prime", true, amazonPrime);
    expect(store.subscriptions()[0]?.leftOut).toBe(true);
  });

  it("lets the user bring it back in, or leave any service out", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("prime", true, amazonPrime);
    store.setSubscribed("netflix", true, standardAds);
    store.setLeftOut("prime", false);
    store.setLeftOut("netflix", true);
    expect(store.subscriptions().map((s) => [s.slug, s.leftOut])).toEqual([
      ["prime", false],
      ["netflix", true],
    ]);
  });

  it("follows the new plan's default when the plan changes", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("prime", true, amazonPrime);
    store.setChoice("prime", { planId: "standalone" }, { id: "standalone", leaveOutByDefault: false });
    expect(store.subscriptions()[0]?.leftOut).toBe(false);
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
    expect(spend).toEqual({ cents: 899 + 1249, unpriced: 1, leftOutCents: 0 });
  });

  it("keeps left-out services apart from the counted total", () => {
    const spend = monthlySpend(
      [
        { slug: "netflix", choice: { planId: "standard-ads" } },
        { slug: "prime", choice: { customCents: 1499 }, leftOut: true },
      ],
      (slug) => (slug === "netflix" ? netflixPlans : []),
    );
    expect(spend).toEqual({ cents: 899, unpriced: 0, leftOutCents: 1499 });
  });
});
