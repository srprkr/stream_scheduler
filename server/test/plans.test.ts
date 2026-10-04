import { describe, expect, it } from "vitest";

import { PLANS } from "../src/plans.js";

/**
 * The price table is typed in by hand, so these check what a typo could
 * break rather than any logic: every service has exactly one default, ids are
 * unique within a service, plans run cheapest first, and prices are whole
 * cents.
 */
describe("PLANS", () => {
  for (const [slug, plans] of Object.entries(PLANS)) {
    describe(slug, () => {
      it("has exactly one default plan", () => {
        expect(plans.filter((p) => p.isDefault)).toHaveLength(1);
      });

      it("has unique plan ids", () => {
        expect(new Set(plans.map((p) => p.id)).size).toBe(plans.length);
      });

      it("prices a yearly plan in whole cents, below twelve months of the monthly", () => {
        for (const p of plans.filter((p) => p.yearlyCents !== null)) {
          expect(Number.isInteger(p.yearlyCents)).toBe(true);
          expect(p.yearlyCents).toBeLessThan(p.monthlyCents * 12);
        }
      });

      it("lists plans cheapest first, in whole cents", () => {
        const prices = plans.map((p) => p.monthlyCents);
        expect(prices).toEqual([...prices].sort((a, b) => a - b));
        expect(prices.every(Number.isInteger)).toBe(true);
      });
    });
  }
});
