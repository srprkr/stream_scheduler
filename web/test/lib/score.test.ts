import { describe, expect, it } from "vitest";

import { passesFilters, scoreText, votesText } from "../../src/lib/score";

const any = { minScore: null, fromYear: null, toYear: null };

describe("scoreText", () => {
  it("shows one decimal, and nothing on too few votes to trust", () => {
    expect(scoreText({ average: 7.84, votes: 1200 })).toBe("7.8");
    expect(scoreText({ average: 10, votes: 3 })).toBeNull();
    expect(scoreText(null)).toBeNull();
  });

  it("counts votes in words", () => {
    expect(votesText(12345)).toBe("12,345 votes");
    expect(votesText(1)).toBe("1 vote");
  });
});

describe("passesFilters", () => {
  const heat = { score: { average: 7.9, votes: 7000 }, releaseYear: 1995 };

  it("passes anything with no filters set, even a title with no score or year", () => {
    expect(passesFilters({}, any)).toBe(true);
  });

  it("holds a minimum score to the same vote floor the lists use", () => {
    expect(passesFilters(heat, { ...any, minScore: 7 })).toBe(true);
    expect(passesFilters(heat, { ...any, minScore: 8 })).toBe(false);
    // A 9.0 from 20 votes isn't a 9.
    expect(passesFilters({ score: { average: 9, votes: 20 } }, { ...any, minScore: 8 })).toBe(
      false,
    );
  });

  it("keeps a decade's years, and drops titles with no year", () => {
    expect(passesFilters(heat, { ...any, fromYear: 1990, toYear: 1999 })).toBe(true);
    expect(passesFilters(heat, { ...any, fromYear: 2000, toYear: 2009 })).toBe(false);
    expect(passesFilters({ releaseYear: null }, { ...any, toYear: 1969 })).toBe(false);
  });
});
