import { useEffect } from "react";
import { useLocation } from "react-router";

import { Backup } from "../components/Backup";
import { MaxWait } from "../components/MaxWait";
import { NumberInput } from "../components/NumberInput";
import { useRotationPlan } from "../hooks/useRotationPlan";
import {
  HOURS_PER_MONTH,
  LEAD_DAYS,
  MAX_WAIT,
  useHoursPerMonth,
  useLeadDays,
  useLevels,
} from "../hooks/useSettings";
import { LEVELS, type Levels } from "../lib/levels";

/**
 * Every figure the app works from that the user can change, in one place.
 * Each also has a home where it's used - hours a month on the Library, the
 * wait on Renewals and the Cost tab, the lead time on Renewals - and both
 * read and write the same saved value.
 */
export function SettingsPage() {
  // Home's backup reminder links to /settings#backup: the router doesn't
  // scroll to a hash by itself.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  const rotation = useRotationPlan();
  const [hours, setHours] = useHoursPerMonth();
  const [lead, setLead] = useLeadDays();
  const [levels, setLevels] = useLevels();
  const setLevel = (field: keyof Levels, value: number) => setLevels({ ...levels, [field]: value });

  const reset = () => {
    setHours(HOURS_PER_MONTH.fallback);
    setLead(LEAD_DAYS.fallback);
    rotation.setMaxWaitMonths(MAX_WAIT.fallback);
    setLevels(LEVELS);
  };

  return (
    <>
      <header className="masthead">
        <h1>Settings</h1>
        <p>The figures your plan, reminders and Insights work from. Saved in this browser only.</p>
      </header>

      <section className="panel settings" aria-labelledby="settings-viewing">
        <h2 id="settings-viewing" className="panel__title">
          Viewing
        </h2>
        <p className="panel__lede">
          How much you watch sets how long your watchlist and library last, and how the plan fills
          each month.
        </p>
        <Field
          label="Hours you watch a month"
          value={hours}
          min={HOURS_PER_MONTH.min}
          max={HOURS_PER_MONTH.max}
          onChange={setHours}
        />
        {/* The wait, with what each choice costs under your plan. */}
        <MaxWait rotation={rotation} />
      </section>

      <section className="panel settings" aria-labelledby="settings-reminders">
        <h2 id="settings-reminders" className="panel__title">
          Reminders
        </h2>
        <Field
          label="Days before a renewal to remind you"
          value={lead}
          min={LEAD_DAYS.min}
          max={LEAD_DAYS.max}
          onChange={setLead}
        />
      </section>

      <section className="panel settings" aria-labelledby="settings-levels">
        <h2 id="settings-levels" className="panel__title">
          Insights colours
        </h2>
        <p className="panel__lede">
          Where the figures at the top of Insights turn green, orange or red.
        </p>
        <Field
          label="Spending turns red above, in dollars a month"
          value={levels.spendHighCents / 100}
          min={0}
          max={500}
          onChange={(dollars) => setLevel("spendHighCents", dollars * 100)}
        />
        <Field
          label="A library is healthy at this many months of viewing"
          value={levels.ownedGoodMonths}
          min={1}
          max={24}
          onChange={(n) => setLevel("ownedGoodMonths", n)}
        />
        <Field
          label="A library is healthy at more than this many titles"
          value={levels.ownedGoodTitles}
          min={1}
          max={500}
          onChange={(n) => setLevel("ownedGoodTitles", n)}
        />
        <Field
          label="“Approaching” starts at this share of the way, in percent"
          value={Math.round(levels.approaching * 100)}
          min={10}
          max={90}
          onChange={(pct) => setLevel("approaching", pct / 100)}
        />
      </section>

      <button type="button" className="button button--quiet settings__reset" onClick={reset}>
        Reset all to defaults
      </button>

      {/* Backup sits last: it covers everything above, and the library. */}
      <Backup />
    </>
  );
}

/** A labelled whole-number field for a setting. */
function Field({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="settings__field">
      <span>{label}</span>
      <NumberInput value={value} min={min} max={max} onChange={onChange} />
    </label>
  );
}
