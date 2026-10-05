import { describe, expect, it } from "vitest";

import {
  comingLevel,
  LEVELS,
  ownedHoursLevel,
  ownedTitlesLevel,
  spendLevel,
} from "../../src/lib/levels";

const MONTH = 20 * 60; // 20 hours a month, in minutes

describe("spendLevel", () => {
  it("is red past $20, orange above nothing, plain at zero", () => {
    expect(spendLevel(2001)).toBe("bad");
    expect(spendLevel(2000)).toBe("warn");
    expect(spendLevel(1)).toBe("warn");
    expect(spendLevel(0)).toBeNull();
  });
});

describe("comingLevel", () => {
  it("is green under half a month, orange past half, red at a month", () => {
    expect(comingLevel(MONTH * 0.4, MONTH)).toBe("good");
    expect(comingLevel(MONTH * 0.5, MONTH)).toBe("warn");
    expect(comingLevel(MONTH, MONTH)).toBe("bad");
    expect(comingLevel(0, MONTH)).toBeNull();
  });
});

describe("ownedHoursLevel", () => {
  it("is green at three months of viewing, orange past halfway", () => {
    expect(ownedHoursLevel(MONTH * 3, MONTH)).toBe("good");
    expect(ownedHoursLevel(MONTH * 1.5, MONTH)).toBe("warn");
    expect(ownedHoursLevel(MONTH, MONTH)).toBeNull();
  });
});

describe("ownedTitlesLevel", () => {
  it("is green past 15 titles, orange approaching", () => {
    expect(ownedTitlesLevel(16)).toBe("good");
    expect(ownedTitlesLevel(15)).toBe("warn");
    expect(ownedTitlesLevel(8)).toBe("warn");
    expect(ownedTitlesLevel(7)).toBeNull();
  });

  it("follows changed thresholds", () => {
    expect(ownedTitlesLevel(11, { ...LEVELS, ownedGoodTitles: 10 })).toBe("good");
  });
});
