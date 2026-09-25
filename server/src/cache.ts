import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

interface Entry<T> {
  fetchedAt: number;
  body: T;
}

/**
 * A read-through cache on disk, keyed by request URL.
 *
 * This exists for development, not production: it keeps `tsx watch` restarts
 * from re-pulling the same pages and keeps iteration off TMDB's rate limit.
 * A deployed server would put a TTL cache in front of the HTTP client instead.
 */
export class FileCache {
  constructor(
    private readonly dir: string,
    private readonly ttlMs: number,
  ) {}

  private path(key: string): string {
    const hash = createHash("sha1").update(key).digest("hex");
    return `${this.dir}/${hash}.json`
  }

  async read<T>(key: string): Promise<T | null> {
    try {
      const raw = await readFile(this.path(key), "utf8");
      const entry = JSON.parse(raw) as Entry<T>;
      if (Date.now() - entry.fetchedAt > this.ttlMs) return null;
      return entry.body;
    } catch {
      // A miss, unreadable file or bad JSON are all just "not cached".
      return null;
    }
  }

  async write<T>(key: string, body: T): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const entry: Entry<T> = { fetchedAt: Date.now(), body };
    await writeFile(this.path(key), JSON.stringify(entry), "utf8");
  }
}

/**
 * The same cache with reads switched off: every request goes upstream and the
 * fresh response overwrites the entry. The feed refresher runs through this,
 * so it replaces entries before they expire instead of reading them back.
 */
export function writeOnly(cache: FileCache): Pick<FileCache, "read" | "write"> {
  return {
    read: async () => null,
    write: (key, body) => cache.write(key, body),
  };
}
