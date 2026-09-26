import { describe, expect, it } from "vitest";

import { localSubscriptions, monthlySpend } from "../../src/lib/subscriptions";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("localSubscriptions", () => {
  it("ticks services on and off", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true);
    store.setSubscribed("hulu", true);
    store.setSubscribed("netflix", false);
    expect(store.subscriptions().map((s) => s.slug)).toEqual(["hulu"]);
  });

  it("does not duplicate a service ticked twice", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true);
    store.setSubscribed("netflix", true);
    expect(store.subscriptions()).toHaveLength(1);
  });

  it("prices only services the user has", () => {
    const store = localSubscriptions(memoryStorage());
    store.setSubscribed("netflix", true);
    store.setPrice("netflix", 1549);
    store.setPrice("hulu", 999);
    expect(store.subscriptions()).toEqual([{ slug: "netflix", monthlyCents: 1549 }]);
  });

  it("survives a reload from the same storage", () => {
    const storage = memoryStorage();
    const first = localSubscriptions(storage);
    first.setSubscribed("peacock", true);
    first.setPrice("peacock", 799);
    expect(localSubscriptions(storage).subscriptions()).toEqual([
      { slug: "peacock", monthlyCents: 799 },
    ]);
  });
});

describe("monthlySpend", () => {
  it("adds the given prices and counts the missing ones", () => {
    expect(
      monthlySpend([
        { slug: "netflix", monthlyCents: 1549 },
        { slug: "hulu", monthlyCents: 999 },
        { slug: "peacock", monthlyCents: null },
      ]),
    ).toEqual({ cents: 2548, unpriced: 1 });
  });
});
