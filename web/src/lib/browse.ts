import type { Kind } from "../hooks/useBrowseFilters";

/**
 * The folded button's text, so the selection shows without opening it:
 * "Your services · Series & films", "Netflix, Hulu · Films", "4 services · Series".
 */
export function summary({
  providers,
  slugs,
  kinds,
  allServices,
  allSubscribed,
}: {
  providers: readonly { slug: string; name: string }[];
  slugs: readonly string[];
  kinds: readonly Kind[];
  allServices: boolean;
  allSubscribed: boolean;
}): string {
  const services = allServices
    ? "All services"
    : allSubscribed
      ? "Your services"
      : slugs.length === 0
        ? "No services"
        : slugs.length <= 2
          ? slugs.map((s) => providers.find((p) => p.slug === s)?.name ?? s).join(", ")
          : `${slugs.length} services`;
  const types =
    kinds.length === 2
      ? "Series & films"
      : kinds[0] === "SERIES"
        ? "Series"
        : kinds[0] === "MOVIE"
          ? "Films"
          : "No type";
  return `${services} · ${types}`;
}
