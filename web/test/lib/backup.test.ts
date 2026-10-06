import { describe, expect, it } from "vitest";

import {
  backupDue,
  describeBackup,
  mergeLibrary,
  mergeSubscriptions,
  parseBackup,
  serializeBackup,
  type Backup,
} from "../../src/lib/backup";
import type { LibraryEntry } from "../../src/lib/library";

const backup: Omit<Backup, "exportedAt"> = {
  library: [
    { id: "tv:84773", kind: "Series", shelf: "watchlist", addedAt: "2026-09-30" },
    { id: "movie:949", kind: "Movie", shelf: "owned", addedAt: "2026-09-12" },
  ],
  subscriptions: [
    {
      slug: "peacock",
      choice: { planId: "premium" },
      billing: { cycle: "annual", renewsOn: "2027-03-02", cents: 13999 },
    },
  ],
  settings: { "hours-per-month": "25", levels: '{"spendHighCents":3000}' },
  pathsDone: ["pause:hulu@2026-10-10"],
};

describe("serializeBackup and parseBackup", () => {
  it("round-trips everything", () => {
    const parsed = parseBackup(serializeBackup(backup, "2026-10-06"));
    expect(parsed).toEqual({ ok: true, backup: { ...backup, exportedAt: "2026-10-06" } });
  });

  it("stays small: no titles, short codes", () => {
    const text = serializeBackup(backup, "2026-10-06");
    expect(text).toContain('["tv:84773","l","S","2026-09-30"]');
    expect(text).not.toContain("title");
  });

  it("refuses text that isn't a whole backup, saying why", () => {
    const text = serializeBackup(backup, "2026-10-06");
    expect(parseBackup(text.slice(0, -20))).toEqual({
      ok: false,
      error: "This isn't a backup: it couldn't be read. Was all of it copied?",
    });
    expect(parseBackup('{"app":"other"}')).toMatchObject({ ok: false });
    expect(parseBackup(text.replace('"v":1', '"v":2'))).toMatchObject({
      ok: false,
      error: "This backup is from a different version of the app.",
    });
  });

  it("refuses a damaged library or services rather than importing part of it", () => {
    const text = serializeBackup(backup, "2026-10-06");
    expect(parseBackup(text.replace('"l","S"', '"x","S"'))).toMatchObject({
      error: "The library in this backup is damaged.",
    });
    expect(parseBackup(text.replace('"cycle":"annual"', '"cycle":"weekly"'))).toMatchObject({
      error: "The services in this backup are damaged.",
    });
  });

  it("skips settings it doesn't know, for backups from a newer app", () => {
    const text = serializeBackup(
      { ...backup, settings: { ...backup.settings, ["future-thing" as "levels"]: "1" } },
      "2026-10-06",
    );
    const parsed = parseBackup(text);
    expect(parsed.ok && parsed.backup.settings).toEqual(backup.settings);
  });

  it("takes surrounding whitespace from a paste in its stride", () => {
    expect(parseBackup(`  \n${serializeBackup(backup, "2026-10-06")}\n`).ok).toBe(true);
  });
});

describe("describeBackup", () => {
  it("counts what's in it", () => {
    expect(describeBackup({ ...backup, exportedAt: "2026-10-06" })).toBe(
      "2 titles (1 owned, 0 on your wishlist, 1 on your watchlist) · 1 service",
    );
  });
});

describe("mergeLibrary", () => {
  const here: LibraryEntry[] = [
    {
      id: "movie:949",
      kind: "Movie",
      shelf: "wanted",
      title: "Heat",
      posterUrl: "heat.jpg",
      addedAt: "2026-09-01T10:00:00.000Z",
    },
    {
      id: "tv:1",
      kind: "Series",
      shelf: "owned",
      title: "The Office",
      posterUrl: null,
      addedAt: "2026-08-01T10:00:00.000Z",
    },
  ];
  const details = new Map([["tv:84773", { title: "The Rings of Power", posterUrl: "rop.jpg" }]]);

  it("replaces the library with the backup, filling titles from details or what's here", () => {
    const result = mergeLibrary(here, backup.library, "replace", details);
    expect(result.map((e) => [e.id, e.shelf, e.title])).toEqual([
      ["tv:84773", "watchlist", "The Rings of Power"],
      ["movie:949", "owned", "Heat"],
    ]);
  });

  it("merges: keeps what's here, adds what's new, and the later move wins", () => {
    const result = mergeLibrary(here, backup.library, "merge", details);
    expect(result.map((e) => [e.id, e.shelf])).toEqual([
      ["tv:84773", "watchlist"],
      // Owned in the backup on Sep 12, wanted here since Sep 1: owned wins.
      ["movie:949", "owned"],
      ["tv:1", "owned"],
    ]);
  });

  it("keeps a title's id as its name when nothing else is known", () => {
    const [entry] = mergeLibrary([], backup.library, "replace", new Map());
    expect(entry?.title).toBe("tv:84773");
  });
});

describe("mergeSubscriptions", () => {
  const here = [{ slug: "netflix", choice: { planId: "standard" } }];
  it("replaces, or adds only the services not here yet", () => {
    expect(mergeSubscriptions(here, backup.subscriptions, "replace")).toEqual(backup.subscriptions);
    expect(mergeSubscriptions(here, backup.subscriptions, "merge").map((s) => s.slug)).toEqual([
      "netflix",
      "peacock",
    ]);
  });
});

describe("backupDue", () => {
  it("suggests a first backup once there's something worth keeping", () => {
    expect(backupDue(null, "2026-10-01", 5, "2026-10-06")).toBe(true);
    expect(backupDue(null, "2026-10-01", 2, "2026-10-06")).toBe(false);
  });

  it("suggests another only after changes and two weeks", () => {
    expect(backupDue("2026-09-01", "2026-09-20", 10, "2026-10-06")).toBe(true);
    expect(backupDue("2026-10-01", "2026-10-03", 10, "2026-10-06")).toBe(false);
    expect(backupDue("2026-09-01", "2026-08-20", 10, "2026-10-06")).toBe(false);
  });
});
