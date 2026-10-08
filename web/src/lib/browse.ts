import type { Kind } from "../hooks/useBrowseFilters";

/**
 * The folded button's text, so the selection shows without opening it:
 * "Your services · Series & films", "Netflix, On disc · Films",
 * "4 services + On disc · Series".
 */
export function summary({
  providers,
  slugs,
  disc,
  kinds,
  allServices,
  allSubscribed,
}: {
  providers: readonly { slug: string; name: string }[];
  slugs: readonly string[];
  disc: boolean;
  kinds: readonly Kind[];
  allServices: boolean;
  allSubscribed: boolean;
}): string {
  const names = [
    ...slugs.map((s) => providers.find((p) => p.slug === s)?.name ?? s),
    ...(disc ? ["On disc"] : []),
  ];
  const services = allServices
    ? "All services"
    : allSubscribed
      ? "Your services"
      : names.length === 0
        ? "No services"
        : names.length <= 2
          ? names.join(", ")
          : `${slugs.length} services${disc ? " + On disc" : ""}`;
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
