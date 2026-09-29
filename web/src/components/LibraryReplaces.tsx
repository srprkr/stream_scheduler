import { useQuery } from "@apollo/client/react";
import { useState } from "react";

import { graphql } from "../generated";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { Panel } from "./Panel";
import { ServiceLogo } from "./ServiceLogo";
import { listTitles, replacementSummary, type OwnedTitle } from "../lib/replaces";

const TRACKED_SERVICES = graphql(`
  query TrackedServices {
    providers {
      id
      slug
      name
      logoUrl(size: SMALL)
    }
  }
`);

/**
 * Every tracked service, each with the number of the user's owned titles it
 * streams today. Services they pay for are in colour; the rest are greyed but
 * keep their counts - "14 on a service you don't pay for" is worth seeing too.
 *
 * The titles behind a count show in the line under the row, for whichever
 * service is hovered, focused or tapped. A line under the row, not a tooltip,
 * so it works the same on a phone, where nothing hovers.
 */
export function LibraryReplaces({ owned }: { owned: readonly OwnedTitle[] }) {
  const providers = useQuery(TRACKED_SERVICES).data?.providers ?? [];
  const subscribed = new Set(useSubscriptions().map((s) => s.slug));
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  if (owned.length === 0) return null;
  const { bySlug, unhosted } = replacementSummary(owned);
  const shown = providers.find((p) => p.slug === (hovered ?? picked));
  const shownTitles = shown ? (bySlug.get(shown.slug) ?? []) : [];

  return (
    <Panel id="replaces" className="replaces" title="What your library replaces">
      <p className="panel__lede">
        How many titles you own each service streams today. Greyed services are ones you don't pay
        for.
      </p>

      <ul className="service-grid">
        {providers.map((p) => {
          const count = bySlug.get(p.slug)?.length ?? 0;
          const mine = subscribed.has(p.slug);
          return (
            <li key={p.id}>
              <button
                type="button"
                className="service-tile"
                data-active={mine}
                aria-pressed={picked === p.slug}
                aria-controls="replaces-detail"
                title={p.name}
                onClick={() => setPicked(picked === p.slug ? null : p.slug)}
                onMouseEnter={() => setHovered(p.slug)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(p.slug)}
                onBlur={() => setHovered(null)}
              >
                <ServiceLogo name={p.name} logoUrl={p.logoUrl} active={mine} count={count} />
                <span className="sr-only">
                  {p.name}: {count} of your titles{mine ? "" : ", not subscribed"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Announced as it changes, so keyboard users hear what focus reveals. */}
      <p id="replaces-detail" className="replaces__detail" aria-live="polite">
        {!shown
          ? "Hover or tap a service to see which of your titles it streams."
          : shownTitles.length === 0
            ? `None of your titles stream on ${shown.name}.`
            : `${shown.name}${subscribed.has(shown.slug) ? "" : " (not subscribed)"}: ${listTitles(shownTitles)}`}
      </p>

      {unhosted.length > 0 && (
        <p className="replaces__unhosted">
          <span className="replaces__mark" aria-hidden="true">
            ◆
          </span>
          <span>
            <strong>Not on any tracked service:</strong> {listTitles(unhosted)}.{" "}
            {unhosted.length === 1 ? "Only your copy plays it." : "Only your copies play these."}
          </span>
        </p>
      )}
    </Panel>
  );
}
