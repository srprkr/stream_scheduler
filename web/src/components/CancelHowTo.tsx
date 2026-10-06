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
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p>
        <a href={c.url} target="_blank" rel="noreferrer">
          Open {name}'s cancel page
        </a>
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
