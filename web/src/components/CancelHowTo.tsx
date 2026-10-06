import type React from "react";

import { formatDate } from "../lib/format";

/** A service's cancellation record, as the GraphQL API serves it. */
export interface Cancellation {
  url: string;
  steps: readonly string[];
  keepsAccessUntilPeriodEnd: boolean;
  cancelHoursBefore?: number | null;
  pause?: string | null;
  refunds: string;
  gotchas: readonly string[];
  checkedOn: string;
}

/**
 * How to cancel one service, folded away under a disclosure until wanted:
 * the steps and a link to the service's own cancel page, the pause if it
 * has one, refunds, and the contract gotchas worth knowing first. Dated,
 * since these flows change - the app never cancels anything itself.
 */
export function CancelHowTo({ name, cancellation }: { name: string; cancellation: Cancellation }) {
  const c = cancellation;
  return (
    <details className="howto">
      <summary>How to cancel {name}</summary>
      <ol className="howto__steps">
        {c.steps.map((step) => (
          <li key={step}>{linkify(step)}</li>
        ))}
      </ol>
      <p>
        <NewTab href={c.url}>Open {name}'s cancel page</NewTab>
        {c.keepsAccessUntilPeriodEnd &&
          " - you keep what you've paid for until it runs out, so cancelling early costs nothing."}
      </p>
      {c.pause && (
        <p>
          <strong>Pause:</strong> {c.pause}
        </p>
      )}
      <p>
        <strong>Refunds:</strong> {c.refunds}
      </p>
      {c.gotchas.length > 0 && (
        <>
          <p>
            <strong>Watch out for:</strong>
          </p>
          <ul className="howto__gotchas">
            {c.gotchas.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </>
      )}
      <p className="howto__checked">
        Checked {formatDate(c.checkedOn, true)} against {name}'s help pages.
      </p>
    </details>
  );
}

/**
 * A link that opens in a new tab, so the user keeps their place here while
 * they cancel there - and says so, to screen readers and with an arrow.
 * noopener stops the service's page from reaching back into this one.
 */
function NewTab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** "netflix.com/cancelplan", "account.apple.com" and the like, inside a step. */
const ADDRESS = /\b((?:[a-z0-9-]+\.)+(?:com|tv)(?:\/[a-z0-9/_-]*)?)/gi;

/** A step's text with any web address in it turned into a new-tab link. */
function linkify(text: string): React.ReactNode[] {
  return text.split(ADDRESS).map((part, i) =>
    i % 2 === 1 ? (
      <NewTab key={i} href={`https://${part}`}>
        {part}
      </NewTab>
    ) : (
      part
    ),
  );
}
