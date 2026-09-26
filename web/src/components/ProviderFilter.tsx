import { useQuery } from "@apollo/client/react";

import { graphql } from "../generated";

const PROVIDERS = graphql(`
  query ProviderTags {
    providers {
      id
      slug
      name
    }
  }
`);

/**
 * Single-select, because the schema's `releases(providerSlug:)` takes one slug.
 * Multi-select would need `providerSlugs: [String!]` server-side - worth doing
 * when there are eight services, not two.
 */
export function ProviderFilter({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const { data } = useQuery(PROVIDERS);
  const providers = data?.providers ?? [];

  return (
    <div className="tags" role="group" aria-label="Filter by service">
      <button
        className={`tag${selected === null ? " tag--on" : ""}`}
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
      >
        All services
      </button>
      {providers.map((p) => (
        <button
          key={p.id}
          className={`tag${selected === p.slug ? " tag--on" : ""}`}
          aria-pressed={selected === p.slug}
          onClick={() => onSelect(p.slug)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
