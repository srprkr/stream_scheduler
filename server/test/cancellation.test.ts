import { describe, expect, it } from "vitest";

import { CANCELLATION } from "../src/cancellation.js";
import { PLANS } from "../src/plans.js";

/**
 * Typed in by hand, so these check what a slip could break: every priced
 * service has a record, links are https, and each record has steps and
 * says how refunds work.
 */
describe("CANCELLATION", () => {
  it("covers every service with plans", () => {
    expect(Object.keys(CANCELLATION).sort()).toEqual(Object.keys(PLANS).sort());
  });

  for (const [slug, record] of Object.entries(CANCELLATION)) {
    it(`gives ${slug} an https link, steps and a refund line`, () => {
      expect(record.url).toMatch(/^https:\/\//);
      expect(record.steps.length).toBeGreaterThan(0);
      expect(record.refunds.length).toBeGreaterThan(0);
    });
  }
});
