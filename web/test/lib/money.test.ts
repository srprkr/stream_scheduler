import { describe, expect, it } from "vitest";

import { formatDollars, parseDollars } from "../../src/lib/money";

describe("money", () => {
  it("formats cents as dollars", () => {
    expect(formatDollars(1549)).toBe("$15.49");
    expect(formatDollars(250000)).toBe("$2,500.00");
  });

  it("reads what people type as a price", () => {
    expect(parseDollars("15.49")).toBe(1549);
    expect(parseDollars("$8")).toBe(800);
    expect(parseDollars("12.")).toBe(1200);
    expect(parseDollars(" 0.5 ")).toBe(50);
  });

  it("treats empty as no price, and nonsense as unreadable", () => {
    expect(parseDollars("")).toBeNull();
    expect(parseDollars("abc")).toBeUndefined();
    expect(parseDollars("1.999")).toBeUndefined();
    expect(parseDollars("-5")).toBeUndefined();
  });

  it("avoids float drift on prices like 0.29", () => {
    expect(parseDollars("0.29")).toBe(29);
    expect(parseDollars("19.99")).toBe(1999);
  });
});
