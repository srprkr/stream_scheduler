import type {
  CatalogSource,
  ImageSize,
  MediaRecord,
  ProviderRecord,
  ReleaseQuery,
  ReleaseRecord,
  VideoRecord,
} from "./types.js";

import { addDays, isoDate } from "../dates.js";

/**
 * An in-memory CatalogSource used until the TMDB adapter lands.
 *
 * This is NOT a mock in the test-double sense - it is a real implementation of
 * the interface that happens to read from an array. The resolvers, the loaders
 * and the schema are all exercised for real against it, so swapping in TMDB
 * changes one constructor argument and nothing else.
 *
 * Dates are generated relative to "now" rather than hardcoded, so the fixture
 * never silently rots into a list of past releases that makes the feed look
 * broken.
 */

const NETFLIX: ProviderRecord = {
  id: "provider:netflix",
  slug: "netflix",
  name: "Netflix",
  logoPath: "/netflix.png",
};

/** A second service, wired up to prove nothing in the stack assumes one. */
const MAX: ProviderRecord = {
  id: "provider:max",
  slug: "max",
  name: "Max",
  logoPath: "/max.png",
};

const PROVIDERS: ProviderRecord[] = [NETFLIX, MAX];

function trailer(key: string, name: string): VideoRecord {
  return { id: `video:${key}`, name, site: "YouTube", key, type: "Trailer" };
}

const MEDIA: MediaRecord[] = [
  {
    id: "media:1",
    kind: "SERIES",
    title: "The Quiet Harbor",
    overview:
      "A marine biologist returns to the fishing town she left at eighteen, and finds the water has been keeping a record of everything she tried to forget.",
    posterPath: "/quiet-harbor-poster.jpg",
    backdropPath: "/quiet-harbor-backdrop.jpg",
    trailer: trailer("dQw4w9WgXcQ", "The Quiet Harbor | Official Trailer"),
    runtimeMinutes: null,
    seasonCount: 2,
  },
  {
    id: "media:2",
    kind: "MOVIE",
    title: "Nightshift at the Museum of Failure",
    overview:
      "A security guard on his first week discovers the exhibits are arguing about whose fault it all was.",
    posterPath: "/nightshift-poster.jpg",
    backdropPath: "/nightshift-backdrop.jpg",
    trailer: trailer("aqz-KE-bpKQ", "Nightshift | Teaser"),
    runtimeMinutes: 108,
    seasonCount: null,
  },
  {
    id: "media:3",
    kind: "SERIES",
    title: "Ledger",
    overview:
      "Four accountants at a failing firm find an entry that should not balance, and decide to follow it.",
    posterPath: "/ledger-poster.jpg",
    backdropPath: "/ledger-backdrop.jpg",
    trailer: null,
    runtimeMinutes: null,
    seasonCount: 1,
  },
  {
    id: "media:4",
    kind: "MOVIE",
    title: "Cold Open",
    overview: null,
    posterPath: null,
    backdropPath: "/cold-open-backdrop.jpg",
    trailer: trailer("ScMzIvxBSi4", "Cold Open | Trailer"),
    runtimeMinutes: 94,
    seasonCount: null,
  },
  {
    id: "media:5",
    kind: "SERIES",
    title: "The Understudy",
    overview:
      "She has covered the same role for six years. Tonight the lead does not show up, and neither does anyone else.",
    posterPath: "/understudy-poster.jpg",
    backdropPath: null,
    trailer: trailer("ktvTqknDobU", "The Understudy | Official Trailer"),
    runtimeMinutes: null,
    seasonCount: 3,
  },
];

/** (mediaId, providerSlug, days from today, seasonNumber) */
const RELEASE_PLAN: ReadonlyArray<readonly [string, string, number, number | null]> = [
  ["media:1", "netflix", 3, 2],
  ["media:2", "netflix", 12, null],
  ["media:3", "netflix", 28, 1],
  ["media:4", "max", 45, null],
  ["media:5", "netflix", 71, 3],
];

export class FixtureSource implements CatalogSource {
  readonly name = "fixture";

  /** Injected so tests can pin the feed to a fixed day. */
  constructor(private readonly now: () => Date = () => new Date()) {}

  private releases(): ReleaseRecord[] {
    const today = this.now();
    return RELEASE_PLAN.map(([mediaId, providerSlug, offset, seasonNumber]) => ({
      availableFrom: isoDate(addDays(today, offset)),
      // media:5 airs weekly, so the fixture exercises the non-full-drop path.
      episodeCount: seasonNumber === null ? null : 8,
      id: `release:${providerSlug}:${mediaId}`,
      mediaId,
      isFullDrop: mediaId !== "media:5",
      bingeableFrom: isoDate(addDays(today, mediaId === "media:5" ? offset + 63 : offset)),
      providerSlug,
      seasonNumber,
      watchTimeMinutes: seasonNumber === null ? null : 8 * 52,
    }));
  }

  async listProviders(): Promise<ProviderRecord[]> {
    return PROVIDERS;
  }

  async getProviders(
    slugs: readonly string[],
  ): Promise<(ProviderRecord | null)[]> {
    return slugs.map((s) => PROVIDERS.find((p) => p.slug === s) ?? null);
  }

  async listReleases(query: ReleaseQuery): Promise<ReleaseRecord[]> {
    const from = query.from ?? isoDate(this.now());
    return this.releases()
      .filter((r) => !query.providerSlug || r.providerSlug === query.providerSlug)
      .filter((r) => r.availableFrom >= from)
      .filter((r) => !query.to || r.availableFrom <= query.to)
      .sort((a, b) => a.availableFrom.localeCompare(b.availableFrom))
      .slice(0, query.first);
  }

  async getRelease(id: string): Promise<ReleaseRecord | null> {
    return this.releases().find((r) => r.id === id) ?? null;
  }

  async getMedia(ids: readonly string[]): Promise<(MediaRecord | null)[]> {
    return ids.map((id) => MEDIA.find((m) => m.id === id) ?? null);
  }

  async searchMedia(query: string, first: number): Promise<MediaRecord[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MEDIA.filter((m) => m.title.toLowerCase().includes(q)).slice(0, first);
  }


  imageUrl(path: string | null, size: ImageSize): string | null {
    if (!path) return null;
    const width = { SMALL: 154, MEDIUM: 342, LARGE: 780, ORIGINAL: 1280 }[size];
    return `https://placehold.co/${width}x${Math.round(width * 1.5)}/1a1a1a/eee?text=${encodeURIComponent(path)}`;
  }

  videoUrl(video: VideoRecord): string {
    return `https://www.youtube.com/watch?v=${video.key}`;
  }
  videoEmbedUrl(video: VideoRecord): string | null {
    if (video.site !== "YouTube") return null;
    return `https://www.youtube-nocookie.com/embed/${video.key}`;
  }

}
