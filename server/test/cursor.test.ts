import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "../src/cursor.js";

describe("cursors", () => {
  it("round-trips a page", () => {
    expect(decodeCursor(encodeCursor(7))).toBe(7);
  });

  it("starts at page one without a cursor", () => {
    expect(decodeCursor(undefined)).toBe(1);
    expect(decodeCursor(null)).toBe(1);
  });

  it("rejects a cursor it did not make", () => {
    expect(() => decodeCursor("not-a-cursor")).toThrow("Invalid cursor");
    expect(() => decodeCursor(Buffer.from("page:0").toString("base64url"))).toThrow();
  });
});
