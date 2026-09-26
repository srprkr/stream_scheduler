import { useQuery } from "@apollo/client/react";
import { useState } from "react";

import { graphql } from "../generated";
import type { MyServicesQuery } from "../generated/graphql";
import { subscriptions, useSubscriptions } from "../hooks/useSubscriptions";
import { formatDate } from "../lib/format";
import { formatDollars, parseDollars } from "../lib/money";
import { monthlySpend, type PlanChoice, type Subscription } from "../lib/subscriptions";

const SERVICES = graphql(`
  query MyServices {
    providers {
      id
      slug
      name
      logoUrl(size: SMALL)
      pricesCheckedOn
      plans {
        id
        name
        monthlyCents
        hasAds
        isDefault
        note
      }
    }
  }
`);

type Service = MyServicesQuery["providers"][number];

/** The <select> value for "type my own price". Plan ids never collide with it. */
const CUSTOM = "custom";

/**
 * Which services the user pays for, and on which plan. Ticking a service
 * assumes its default plan at the published price, so the totals mean
 * something without any typing; Custom covers bundles, discounts and plans
 * the app doesn't list.
 */
export function MyServices() {
  const { data } = useQuery(SERVICES);
  const services = data?.providers ?? [];
  const mine = useSubscriptions();
  const bySlug = new Map(mine.map((s) => [s.slug, s]));
  const plansFor = (slug: string) => services.find((s) => s.slug === slug)?.plans ?? [];
  const spend = monthlySpend(mine, plansFor);
  const checkedOn = services.find((s) => s.pricesCheckedOn)?.pricesCheckedOn;

  return (
    <section className="services" aria-labelledby="services-title">
      <h2 id="services-title" className="services__title">
        Your services
      </h2>
      <p className="services__lede">
        Tick the ones you pay for now, and pick your plan.
      </p>

      <ul className="services__list">
        {services.map((service) => {
          const subscription = bySlug.get(service.slug);
          return (
            <li key={service.id} className="services__row">
              <label className="services__pick">
                <input
                  type="checkbox"
                  checked={subscription !== undefined}
                  onChange={(e) =>
                    subscriptions.setSubscribed(
                      service.slug,
                      e.target.checked,
                      service.plans.find((p) => p.isDefault)?.id,
                    )
                  }
                />
                {service.logoUrl && <img className="logos__img" src={service.logoUrl} alt="" />}
                {service.name}
              </label>
              {subscription && <PlanPicker service={service} subscription={subscription} />}
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
      {checkedOn && (
        <p className="services__checked">
          Published US prices, checked {formatDate(checkedOn, true)}. Choose
          Custom for bundles, annual plans or discounts.
        </p>
      )}
    </section>
  );
}

/** A plan dropdown, plus a price box when the user chooses Custom. */
function PlanPicker({ service, subscription }: { service: Service; subscription: Subscription }) {
  const { choice } = subscription;
  const selected = "planId" in choice ? choice.planId : CUSTOM;
  const plan = service.plans.find((p) => p.id === selected);
  const change = (next: PlanChoice) => subscriptions.setChoice(service.slug, next);

  return (
    <div className="services__plan">
      <select
        value={selected}
        aria-label={`${service.name} plan`}
        onChange={(e) =>
          change(e.target.value === CUSTOM ? { customCents: null } : { planId: e.target.value })
        }
      >
        {service.plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {formatDollars(p.monthlyCents)}
          </option>
        ))}
        <option value={CUSTOM}>Custom price…</option>
      </select>
      {"customCents" in choice && (
        <PriceInput
          service={service.name}
          cents={choice.customCents}
          onChange={(cents) => change({ customCents: cents })}
        />
      )}
      {plan?.note && <p className="services__note">{plan.note}</p>}
    </div>
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
