import type { FileCache } from "../../cache.js";

export class TmdbError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`TMDB ${status} for ${path}`);
    this.name = "TmdbError";
  }
}

/**
 * Thin HTTP client for TMDB. Knows about auth, caching and retries; knows
 * nothing about releases or providers. The mapping to domain records lives
 * in TmdbSource, so this stays testable and replaceable on its own.
 */
export class TmdbClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly cache: FileCache,
  ) {}

  async get<T>(path: string): Promise<T> {
    const cached = await this.cache.read<T>(path);
    if (cached !== null) return cached;

    const body = await this.fetchWithRetry<T>(path);
    await this.cache.write(path, body);
    return body;
  }

  private async fetchWithRetry<T>(path: string, attempt = 0): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        accept: "application/json",
      },
    });

    // 429 is the one status worth retrying: TMDB tells us how long to wait.
    if (res.status === 429 && attempt < 3) {
      const wait = Number(res.headers.get("retry-after") ?? 1) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      return this.fetchWithRetry<T>(path, attempt + 1);
    }

    if (!res.ok) throw new TmdbError(res.status, path);
    return (await res.json()) as T;
  }
}
