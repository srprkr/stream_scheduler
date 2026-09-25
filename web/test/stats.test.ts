import { describe, expect, it } from "vitest";

import { formatHours, formatMonths, libraryStats } from "../src/stats";

describe("libraryStats", () => {
  it("totals runtimes and converts them to months of viewing", () => {
    const stats = libraryStats(
      [{ minutes: 4601, estimated: false }, { minutes: 199, estimated: false }],
      20,
    );
    expect(stats).toEqual({ minutes: 4800, estimated: false, missing: 0, months: 4 });
  });

  it("carries an estimate through to the total", () => {
    const stats = libraryStats(
      [{ minutes: 60, estimated: false }, { minutes: 60, estimated: true }],
      10,
    );
    expect(stats.estimated).toBe(true);
  });

  it("counts titles without a runtime instead of guessing them", () => {
    const stats = libraryStats([{ minutes: 120, estimated: false }, null, undefined], 10);
    expect(stats).toMatchObject({ minutes: 120, missing: 2 });
  });

  it("does not divide by a zero watch rate", () => {
    expect(libraryStats([{ minutes: 600, estimated: false }], 0).months).toBe(0);
  });
});

describe("formatting", () => {
  it("formats minutes as hours and minutes", () => {
    expect(formatHours(4601)).toBe("76 h 41 m");
    expect(formatHours(45)).toBe("45 m");
  });

  it("formats months at a precision that suits their size", () => {
    expect(formatMonths(0.4)).toBe("less than a month");
    expect(formatMonths(3.84)).toBe("3.8 months");
    expect(formatMonths(15.6)).toBe("16 months");
    expect(formatMonths(30)).toBe("30 months (about 2.5 years)");
  });
});
