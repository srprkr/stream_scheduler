import { useQuery } from "@apollo/client/react";
import { useState } from "react";

import { graphql } from "../generated";
import type { MyServicesQuery } from "../generated/graphql";
import { subscriptions, useSubscriptions } from "../hooks/useSubscriptions";
import { formatDate } from "../lib/format";
import { formatDollars, parseDollars } from "../lib/money";
import { monthlySpend, type PlanChoice, type Subscription } from "../lib/subscriptions";
import { Modal } from "./Modal";

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
        leaveOutByDefault
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
 * Which services the user pays for, and on which plan. Tapping a grey logo
 * subscribes on the service's default plan and opens its options, so the
 * total means something straight away; the ⋯ on a subscribed logo reopens
 * them. Custom covers bundles, discounts and plans the app doesn't list.
 */
export function MyServices() {
  const { data } = useQuery(SERVICES);
  const services = data?.providers ?? [];
  const mine = useSubscriptions();
  const bySlug = new Map(mine.map((s) => [s.slug, s]));
  const plansFor = (slug: string) => services.find((s) => s.slug === slug)?.plans ?? [];
  const spend = monthlySpend(mine, plansFor);
  const checkedOn = services.find((s) => s.pricesCheckedOn)?.pricesCheckedOn;

  // The service whose options dialog is open. It only shows while that
  // service is still subscribed, so removing it closes the dialog too.
  const [editing, setEditing] = useState<string | null>(null);
  const editingService = services.find((s) => s.slug === editing);
  const editingSubscription = editing ? bySlug.get(editing) : undefined;

  const toggle = (service: Service, on: boolean) => {
    subscriptions.setSubscribed(
      service.slug,
      !on,
      service.plans.find((p) => p.isDefault),
    );
    // Turning one on asks for its plan right away; turning one off doesn't.
    setEditing(on ? null : service.slug);
  };

  return (
    <section className="services" aria-labelledby="services-title">
      <h2 id="services-title" className="services__title">
        Your services
      </h2>
      <p className="services__lede">Tap the services you pay for now. Use ⋯ to change a plan.</p>

      {/* One toggle per service: colour when it's yours, grey when not. The
          ⋯ button is a sibling of the tile, not inside it - a button can't
          hold another button. */}
      <ul className="service-grid">
        {services.map((service) => {
          const on = bySlug.has(service.slug);
          return (
            <li key={service.id} className="service-grid__cell">
              <button
                type="button"
                className="service-tile"
                data-active={on}
                aria-pressed={on}
                title={service.name}
                onClick={() => toggle(service, on)}
              >
                {service.logoUrl ? (
                  <img src={service.logoUrl} alt="" />
                ) : (
                  <span className="service-tile__initial">{service.name.slice(0, 1)}</span>
                )}
                <span className="sr-only">{service.name}</span>
              </button>
              {on && (
                <button
                  type="button"
                  className="service-tile__more"
                  aria-label={`${service.name} plan and options`}
                  aria-haspopup="dialog"
                  onClick={() => setEditing(service.slug)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {mine.length > 0 && (
        <p className="services__total">
          <span>
            {mine.length} {mine.length === 1 ? "service" : "services"}
            {spend.cents > 0 && (
              <>
                {" "}
                · <strong>{formatDollars(spend.cents)}</strong>/month
              </>
            )}
            {spend.unpriced > 0 && (
              <span className="services__unpriced"> ({spend.unpriced} without a price)</span>
            )}
            {spend.leftOutCents > 0 && (
              <span className="services__unpriced">
                {" "}
                · plus {formatDollars(spend.leftOutCents)} left out of estimates
              </span>
            )}
          </span>
          {/* Twelve months of the same total: what staying subscribed to all
              of it costs over a year. Left-out services stay out here too. */}
          {spend.cents > 0 && (
            // The asterisk is visual; aria-describedby reads the note itself.
            <span className="services__annual" aria-describedby="annual-note">
              <strong>{formatDollars(spend.cents * 12)}</strong>/year
              <span aria-hidden="true">*</span>
            </span>
          )}
        </p>
      )}
      {/* The small print, on one row: where prices come from on the left,
          the note on the yearly total under it on the right. */}
      <div className="services__notes">
        {checkedOn && (
          <p className="services__checked">
            Published US prices, checked {formatDate(checkedOn, true)}. Choose Custom for bundles,
            annual plans or discounts.
          </p>
        )}
        {mine.length > 0 && spend.cents > 0 && (
          <p id="annual-note" className="services__footnote">
            *Prices fluctuate throughout the year.
          </p>
        )}
      </div>

      <Modal
        open={editingService !== undefined && editingSubscription !== undefined}
        onClose={() => setEditing(null)}
        labelledBy="service-options-title"
      >
        {editingService && editingSubscription && (
          <>
            <header className="modal__head">
              {editingService.logoUrl && <img src={editingService.logoUrl} alt="" />}
              <h2 id="service-options-title">{editingService.name}</h2>
            </header>
            <PlanPicker service={editingService} subscription={editingSubscription} />
            <div className="modal__actions">
              <button
                type="button"
                className="button button--quiet"
                onClick={() => subscriptions.setSubscribed(editingService.slug, false)}
              >
                Remove service
              </button>
              <button type="button" className="button" onClick={() => setEditing(null)}>
                Done
              </button>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}

/**
 * The plan dropdown, a price box when the user chooses Custom, the plan's
 * note, and whether the service counts toward estimates. Laid out as a small
 * form for the options dialog.
 */
function PlanPicker({ service, subscription }: { service: Service; subscription: Subscription }) {
  const { choice } = subscription;
  const selected = "planId" in choice ? choice.planId : CUSTOM;
  const plan = service.plans.find((p) => p.id === selected);
  const change = (next: PlanChoice) =>
    subscriptions.setChoice(
      service.slug,
      next,
      "planId" in next ? service.plans.find((p) => p.id === next.planId) : null,
    );

  return (
    <div className="services__plan">
      <label className="services__field" htmlFor={`plan-${service.slug}`}>
        Plan
      </label>
      <select
        id={`plan-${service.slug}`}
        value={selected}
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
      <label className="services__leave-out">
        <input
          type="checkbox"
          checked={subscription.leftOut ?? false}
          onChange={(e) => subscriptions.setLeftOut(service.slug, e.target.checked)}
        />
        Leave out of estimates
      </label>
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
