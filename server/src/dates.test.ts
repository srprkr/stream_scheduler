import { describe, expect, it } from "vitest";

import { daysUntil } from "./dates.js";

const NOW = new Date("2026-09-18T12:00:00Z");

describe("daysUntil", () => {
  it("counts calendar days in UTC", () => {
    expect(daysUntil("2026-09-21", "UTC", NOW)).toBe(3);
  });

  it("uses the caller's date, not UTC's, when they are ahead", () => {
    expect(daysUntil("2026-09-21", "Pacific/Auckland", NOW)).toBe(2);
  });

  it("uses the caller's date, not UTC's, when they are behind", () => {
    const earlyUtc = new Date("2026-09-18T03:00:00Z"); // Sep 17, 8pm in LA
    expect(daysUntil("2026-09-21", "America/Los_Angeles", earlyUtc)).toBe(4);
  });

  it("is zero on release day and negative afterwards", () => {
    expect(daysUntil("2026-09-18", "UTC", NOW)).toBe(0);
    expect(daysUntil("2026-09-10", "UTC", NOW)).toBe(-8);
  });

  it("rejects an unknown timezone", () => {
    expect(() => daysUntil("2026-09-21", "Mars/Olympus_Mons", NOW)).toThrow(
      RangeError,
    );
  });
});