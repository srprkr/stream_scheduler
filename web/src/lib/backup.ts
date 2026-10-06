import type { LibraryEntry, Shelf } from "./library";
import type { Subscription } from "./subscriptions";

/**
 * A backup of everything the app keeps in this browser, as one small piece
 * of text: to save as a file, or paste into a password manager's notes so
 * it travels with the user. With no accounts, it's how a library moves to a
 * new device or survives cleared site data.
 *
 * Compact by design - a password manager's notes field is small (Bitwarden
 * caps it at 10,000 characters). Library titles and posters are left out and
 * fetched again on import, so each title costs about 30 characters:
 *
 *   {"app":"streamhopper","v":1,"at":"2026-10-06",
 *    "lib":[["tv:84773","l","S","2026-09-30"], ...],
 *    "subs":[...], "set":{"hours-per-month":"20", ...}, "done":[...]}
 */

export const BACKUP_APP = "streamhopper";

/**
 * Past this length, a copied backup may not fit a password manager's notes
 * - Bitwarden's cap is 10,000 characters - and a cut-off paste can't be
 * restored. A little under the cap, to leave room. About 200 titles.
 */
export const LONG_BACKUP_CHARS = 9000;
const VERSION = 1;

/** The settings a backup carries, by storage key without its prefix. */
export const BACKUP_SETTINGS = [
  "hours-per-month",
  "max-wait-months",
  "reminder-lead-days",
  "levels",
] as const;
export type BackupSetting = (typeof BACKUP_SETTINGS)[number];

/** A library entry as a backup holds it: everything but title and poster. */
export interface BackupEntry {
  id: string;
  kind: LibraryEntry["kind"];
  shelf: Shelf;
  /** YYYY-MM-DD. */
  addedAt: string;
}

export interface Backup {
  exportedAt: string;
  library: BackupEntry[];
  subscriptions: Subscription[];
  /** Raw saved values, as each setting stores them. */
  settings: Partial<Record<BackupSetting, string>>;
  /** Paths forward steps ticked off. */
  pathsDone: string[];
}

const SHELF_CODE: Record<Shelf, string> = { owned: "o", wanted: "w", watchlist: "l" };
const KIND_CODE: Record<LibraryEntry["kind"], string> = { Movie: "M", Series: "S" };
const fromCode = <T extends string>(codes: Record<T, string>, code: unknown) =>
  (Object.keys(codes) as T[]).find((k) => codes[k] === code);

/** The backup as text: compact JSON, one line. */
export function serializeBackup(backup: Omit<Backup, "exportedAt">, today: string): string {
  return JSON.stringify({
    app: BACKUP_APP,
    v: VERSION,
    at: today,
    lib: backup.library.map((e) => [e.id, SHELF_CODE[e.shelf], KIND_CODE[e.kind], e.addedAt]),
    subs: backup.subscriptions,
    set: backup.settings,
    done: backup.pathsDone,
  });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function validSubscription(s: unknown): s is Subscription {
  if (!isObject(s) || typeof s["slug"] !== "string" || !isObject(s["choice"])) return false;
  const choice = s["choice"];
  const planOk =
    typeof choice["planId"] === "string" ||
    choice["customCents"] === null ||
    (typeof choice["customCents"] === "number" && choice["customCents"] >= 0);
  if (!planOk) return false;
  if (s["leftOut"] !== undefined && typeof s["leftOut"] !== "boolean") return false;
  const b = s["billing"];
  if (b === undefined) return true;
  if (!isObject(b)) return false;
  if (b["cycle"] === "monthly") {
    return Number.isInteger(b["day"]) && (b["day"] as number) >= 1 && (b["day"] as number) <= 31;
  }
  return (
    b["cycle"] === "annual" &&
    typeof b["renewsOn"] === "string" &&
    DATE.test(b["renewsOn"]) &&
    (b["cents"] === null || (typeof b["cents"] === "number" && b["cents"] >= 0))
  );
}

/**
 * Reads a backup back, strictly: anything not exactly as written is refused
 * with a reason, rather than half-imported. Pasted text often picks up a
 * stray character or loses its end, and a partial import would quietly lose
 * part of a library.
 */
export function parseBackup(
  text: string,
): { ok: true; backup: Backup } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return { ok: false, error: "This isn't a backup: it couldn't be read. Was all of it copied?" };
  }
  if (!isObject(raw) || raw["app"] !== BACKUP_APP) {
    return { ok: false, error: "This isn't a backup from this app." };
  }
  if (raw["v"] !== VERSION) {
    return { ok: false, error: "This backup is from a different version of the app." };
  }
  if (typeof raw["at"] !== "string" || !DATE.test(raw["at"])) {
    return { ok: false, error: "This backup has no valid date." };
  }

  const library: BackupEntry[] = [];
  if (!Array.isArray(raw["lib"]))
    return { ok: false, error: "The library in this backup is damaged." };
  for (const row of raw["lib"]) {
    const [id, shelfCode, kindCode, addedAt] = Array.isArray(row) ? row : [];
    const shelf = fromCode(SHELF_CODE, shelfCode);
    const kind = fromCode(KIND_CODE, kindCode);
    if (
      typeof id !== "string" ||
      !id ||
      !shelf ||
      !kind ||
      typeof addedAt !== "string" ||
      !DATE.test(addedAt)
    ) {
      return { ok: false, error: "The library in this backup is damaged." };
    }
    library.push({ id, kind, shelf, addedAt });
  }

  const subs = raw["subs"];
  if (!Array.isArray(subs) || !subs.every(validSubscription)) {
    return { ok: false, error: "The services in this backup are damaged." };
  }

  const settings: Backup["settings"] = {};
  const set = raw["set"];
  if (!isObject(set)) return { ok: false, error: "The settings in this backup are damaged." };
  for (const [key, value] of Object.entries(set)) {
    // Unknown settings are skipped, not refused: a newer app may add some.
    if ((BACKUP_SETTINGS as readonly string[]).includes(key) && typeof value === "string") {
      settings[key as BackupSetting] = value;
    }
  }

  const done = raw["done"];
  if (!Array.isArray(done) || !done.every((d) => typeof d === "string")) {
    return { ok: false, error: "The checklist in this backup is damaged." };
  }

  return {
    ok: true,
    backup: { exportedAt: raw["at"], library, subscriptions: subs, settings, pathsDone: done },
  };
}

/** "42 titles (30 owned, 8 on your wishlist, 4 on your watchlist) · 3 services". */
export function describeBackup(backup: Backup): string {
  const count = (shelf: Shelf) => backup.library.filter((e) => e.shelf === shelf).length;
  const n = backup.library.length;
  const s = backup.subscriptions.length;
  return (
    `${n} ${n === 1 ? "title" : "titles"} (${count("owned")} owned, ${count("wanted")} on your wishlist, ` +
    `${count("watchlist")} on your watchlist) · ${s} ${s === 1 ? "service" : "services"}`
  );
}

/**
 * The library after an import. Replace takes the backup as it is. Merge
 * keeps everything here and adds what the backup has that this browser
 * doesn't; where both have a title on different shelves, the later move
 * wins. Titles and posters come from `details` - fetched for the backup's
 * ids - or from what's already here; a title with neither keeps its id.
 */
export function mergeLibrary(
  current: readonly LibraryEntry[],
  backup: readonly BackupEntry[],
  mode: "replace" | "merge",
  details: ReadonlyMap<string, { title: string; posterUrl: string | null }>,
): LibraryEntry[] {
  const restore = (e: BackupEntry): LibraryEntry => {
    const here = current.find((c) => c.id === e.id);
    const found = details.get(e.id);
    return {
      id: e.id,
      kind: e.kind,
      shelf: e.shelf,
      title: found?.title ?? here?.title ?? e.id,
      posterUrl: found?.posterUrl ?? here?.posterUrl ?? null,
      addedAt: `${e.addedAt}T00:00:00.000Z`,
    };
  };
  if (mode === "replace") return backup.map(restore);

  const merged = new Map(current.map((e) => [e.id, e]));
  for (const e of backup) {
    const here = merged.get(e.id);
    if (!here || (here.shelf !== e.shelf && e.addedAt > here.addedAt.slice(0, 10))) {
      merged.set(e.id, restore(e));
    }
  }
  // Newest first, as the shelves list them.
  return [...merged.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/** Subscriptions after an import: replace, or add the services not here yet. */
export function mergeSubscriptions(
  current: readonly Subscription[],
  backup: readonly Subscription[],
  mode: "replace" | "merge",
): Subscription[] {
  if (mode === "replace") return [...backup];
  const here = new Set(current.map((s) => s.slug));
  return [...current, ...backup.filter((s) => !here.has(s.slug))];
}

/**
 * Whether to suggest a backup: the library has changed since the last one -
 * or there's never been one and there's something worth keeping - and at
 * least `days` have passed.
 */
export function backupDue(
  lastBackup: string | null,
  lastChange: string | null,
  entries: number,
  today: string,
  days = 14,
): boolean {
  if (!lastBackup) return entries >= 5;
  if (!lastChange || lastChange <= lastBackup) return false;
  const since = (Date.parse(today) - Date.parse(lastBackup)) / 86_400_000;
  return since >= days;
}
