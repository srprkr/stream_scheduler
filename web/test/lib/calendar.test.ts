import { describe, expect, it } from "vitest";

import { escapeText, fold, icsCalendar } from "../../src/lib/calendar";

const STAMP = new Date("2026-09-30T12:34:56.789Z");

describe("icsCalendar", () => {
  const ics = icsCalendar(
    [
      {
        uid: "netflix-2026-10-14@streamhopper",
        date: "2026-10-11",
        summary: "Pause Netflix before it renews Oct 14",
        description: "Nothing on your watchlist is out until Nov 20, so pause it.",
      },
    ],
    STAMP,
  );
  const lines = ics.split("\r\n");

  it("writes an all-day event that ends the next day", () => {
    expect(lines).toContain("DTSTART;VALUE=DATE:20261011");
    expect(lines).toContain("DTEND;VALUE=DATE:20261012");
    expect(lines).toContain("DTSTAMP:20260930T123456Z");
    expect(lines).toContain("UID:netflix-2026-10-14@streamhopper");
  });

  it("alerts at 9am on the day", () => {
    expect(lines).toContain("TRIGGER:PT9H");
  });

  it("ends every line in CRLF, including the last", () => {
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
});

describe("escapeText", () => {
  it("escapes the characters iCalendar reserves", () => {
    expect(escapeText("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });
});

describe("fold", () => {
  it("leaves a short line alone", () => {
    expect(fold("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds at 75 octets, continuation lines starting with a space", () => {
    const folded = fold("X".repeat(160)).split("\r\n");
    expect(folded.map((l) => l.length)).toEqual([75, 75, 12]);
    expect(folded.slice(1).every((l) => l.startsWith(" "))).toBe(true);
  });

  it("never splits a multi-byte character", () => {
    // 74 ASCII octets, then a 2-octet "é" that would straddle the limit.
    const folded = fold(`${"a".repeat(74)}é`).split("\r\n");
    expect(folded).toEqual(["a".repeat(74), " é"]);
  });
});
