import { useQuery } from "@apollo/client/react";
import { useState } from "react";

import { graphql } from "../generated";
import { subscriptions, useSubscriptions } from "../hooks/useSubscriptions";
import { formatDollars, parseDollars } from "../lib/money";
import { monthlySpend } from "../lib/subscriptions";

const SERVICES = graphql(`
  query MyServices {
    providers {
      id
      slug
      name
      logoUrl(size: SMALL)
    }
  }
`);

/**
 * Which services the user pays for, and optionally what each costs. Ticking
 * is enough for What's On; prices are what make the cost views possible.
 */
export function MyServices() {
  const { data } = useQuery(SERVICES);
  const mine = useSubscriptions();
  const bySlug = new Map(mine.map((s) => [s.slug, s]));
  const spend = monthlySpend(mine);

  return (
    <section className="services" aria-labelledby="services-title">
      <h2 id="services-title" className="services__title">
        Your services
      </h2>
      <p className="services__lede">
        Tick the ones you pay for now. Prices are optional; they power the
        cost comparisons.
      </p>

      <ul className="services__list">
        {(data?.providers ?? []).map((p) => {
          const mineNow = bySlug.get(p.slug);
          return (
            <li key={p.id} className="services__row">
              <label className="services__pick">
                <input
                  type="checkbox"
                  checked={mineNow !== undefined}
                  onChange={(e) => subscriptions.setSubscribed(p.slug, e.target.checked)}
                />
                {p.logoUrl && <img className="logos__img" src={p.logoUrl} alt="" />}
                {p.name}
              </label>
              {mineNow && (
                <PriceInput
                  service={p.name}
                  cents={mineNow.monthlyCents}
                  onChange={(cents) => subscriptions.setPrice(p.slug, cents)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {mine.length > 0 && (
        <p className="services__total">
          {mine.length} {mine.length === 1 ? "service" : "services"}
          {spend.cents > 0 && <> · <strong>{formatDollars(spend.cents)}</strong>/month</>}
          {spend.unpriced > 0 && (
            <span className="services__unpriced">
              {" "}
              ({spend.unpriced} without a price)
            </span>
          )}
        </p>
      )}
    </section>
  );
}

/**
 * Keeps what the user typed as text, and saves cents whenever it reads as a
 * price. Reformatting while typing would fight the cursor: "12." is a fine
 * thing to have typed on the way to "12.99".
 */
function PriceInput({
  service,
  cents,
  onChange,
}: {
  service: string;
  cents: number | null;
  onChange: (cents: number | null) => void;
}) {
  const [text, setText] = useState(cents === null ? "" : (cents / 100).toFixed(2));
  const invalid = parseDollars(text) === undefined;

  return (
    <label className="services__price">
      <span aria-hidden="true">$</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={text}
        aria-label={`${service} monthly price in dollars`}
        aria-invalid={invalid}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseDollars(e.target.value);
          if (parsed !== undefined) onChange(parsed);
        }}
      />
      <span aria-hidden="true">/mo</span>
    </label>
  );
}
