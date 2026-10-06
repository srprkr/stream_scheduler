import { Link } from "react-router";

import { useRotationPlan } from "../hooks/useRotationPlan";
import { LEAD_DAYS, useLeadDays } from "../hooks/useSettings";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { useWatchlist } from "../hooks/useWatchlist";
import { icsCalendar, type CalendarEvent } from "../lib/calendar";
import { listTitles } from "../lib/replaces";
import {
  addDays,
  nextRenewal,
  renewalAdvice,
  renewalsBetween,
  type RenewalAdvice,
} from "../lib/renewals";
import { localToday, when } from "../lib/seasons";
import { monthlyCents } from "../lib/subscriptions";
import { CancelHowTo, type Cancellation } from "./CancelHowTo";
import { MaxWait } from "./MaxWait";
import { Panel } from "./Panel";
import { ServiceLogo } from "./ServiceLogo";

/** The horizon the release feed covers, and so the one advice can see. */
const WINDOW_DAYS = 90;

interface Upcoming {
  slug: string;
  name: string;
  logoUrl: string | null | undefined;
  renewsOn: string;
  advice: RenewalAdvice;
  cancellation: Cancellation | null;
}

/**
 * Each service's next renewal with what to do about it, read off the
 * watchlist - keep it, or pause it until something is out - and a calendar
 * file of reminders a few days before each renewal in the next 90 days.
 *
 * The file is a snapshot: the advice in it is what the watchlist said when
 * it was downloaded. Re-importing a fresh one updates the same events, since
 * each keeps its id.
 */
export function Renewals() {
  const today = localToday();
  const until = addDays(today, WINDOW_DAYS);
  const mine = useSubscriptions();
  const rotation = useRotationPlan();
  const { plan, providers } = rotation;
  const { serviceInfo } = useWatchlist();
  const [lead, setLead] = useLeadDays();

  if (mine.length === 0) return null;

  const nameOf = (key: string) =>
    providers.find((p) => p.slug === key)?.name ?? serviceInfo.get(key)?.name ?? key;

  // Every renewal in the window, with its advice. The list shows each
  // service's next one; the calendar file gets them all.
  const renewals: Upcoming[] = [];
  const unset: string[] = [];
  for (const sub of mine) {
    const provider = providers.find((p) => p.slug === sub.slug);
    const name = provider?.name ?? sub.slug;
    if (!sub.billing) {
      unset.push(name);
      continue;
    }
    const plans = provider?.plans ?? [];
    // Pausing saves what a month costs. For a yearly plan, the break-even
    // compares against the published monthly price, not a twelfth of the year.
    const monthly =
      sub.billing.cycle === "annual"
        ? ((
            plans.find((p) => "planId" in sub.choice && p.id === sub.choice.planId) ??
            plans.find((p) => p.isDefault)
          )?.monthlyCents ?? null)
        : monthlyCents(sub, plans);
    // A yearly plan is always listed, however far off its renewal: getting
    // off it is the point, and its reminder can't wait for the window.
    const dates = renewalsBetween(sub.billing, today, until);
    if (sub.billing.cycle === "annual" && dates.length === 0) {
      dates.push(nextRenewal(sub.billing, today));
    }
    for (const renewsOn of dates) {
      renewals.push({
        slug: sub.slug,
        name,
        logoUrl: provider?.logoUrl,
        renewsOn,
        cancellation: provider?.cancellation ?? null,
        advice: renewalAdvice({
          service: name,
          key: sub.slug,
          billing: sub.billing,
          renewsOn,
          plan,
          nameOf,
          monthlyCents: monthly,
          today,
          cancelHoursBefore: provider?.cancellation?.cancelHoursBefore ?? null,
          alwaysKeep: sub.leftOut
            ? (rotation.anyTime.find((a) => a.key === sub.slug)?.titles.map((t) => t.title) ?? [])
            : null,
        }),
      });
    }
  }
  renewals.sort((a, b) => a.renewsOn.localeCompare(b.renewsOn));
  const next = renewals.filter((r, i) => renewals.findIndex((x) => x.slug === r.slug) === i);

  const download = () => {
    // Yearly plans get two extra reminders - a month out and a week out -
    // to turn off auto-renew before the year rolls over.
    const yearlyEvents: CalendarEvent[] = next
      .filter((r) => r.advice.action === "switch")
      .flatMap((r) =>
        [30, 7]
          .map((days) => ({ days, date: addDays(r.renewsOn, -days) }))
          .filter(({ date }) => date >= today)
          .map(({ days, date }) => ({
            uid: `${r.slug}-${r.renewsOn}-yearly-${days}@streamhopper`,
            date,
            summary: `Turn off ${r.name}'s yearly auto-renew: renews ${when(r.renewsOn, today)}`,
            description:
              `${r.advice.text}` +
              (r.cancellation
                ? ` How: ${r.cancellation.steps.join(" ")} ${r.cancellation.url} Refunds: ${r.cancellation.refunds}`
                : ""),
          })),
      );
    const events: CalendarEvent[] = renewals.map((r) => {
      const remindOn = addDays(r.renewsOn, -lead);
      return {
        uid: `${r.slug}-${r.renewsOn}@streamhopper`,
        // A reminder already due fires today rather than in the past.
        date: remindOn < today ? today : remindOn,
        summary: summary(r, today),
        description:
          `${r.advice.text} Renews ${when(r.renewsOn, today)}.` +
          (r.cancellation ? ` To cancel: ${r.cancellation.url}` : ""),
      };
    });
    const blob = new Blob([icsCalendar([...events, ...yearlyEvents], new Date())], {
      type: "text/calendar",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "streamhopper-renewals.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel id="renewals" className="renewals" title="Renewals">
      <p className="panel__lede">
        When each service renews, and whether to keep it or pause it first. The advice follows a
        plan: one service a month, each taking its turn when it has a month of your watchlist ready
        to binge.
      </p>

      <ul className="renewals__list">
        {next.map((r) => (
          <li key={r.slug} className="renewals__row" data-action={r.advice.action}>
            <ServiceLogo name={r.name} logoUrl={r.logoUrl} active size="row" />
            <div>
              <p className="renewals__head">
                <strong>{r.name}</strong> renews {when(r.renewsOn, today)}
                <span className="renewals__action" data-action={r.advice.action}>
                  {r.advice.action === "keep"
                    ? "Keep"
                    : r.advice.action === "pause"
                      ? "Cancel"
                      : "Go monthly"}
                </span>
              </p>
              <p className="renewals__advice">{r.advice.text}</p>
              {r.cancellation && <CancelHowTo name={r.name} cancellation={r.cancellation} />}
            </div>
          </li>
        ))}
      </ul>

      {unset.length > 0 && (
        <p className="renewals__note">
          No renewal day yet for {listTitles(unset)}: set one with the pencil in Your services on{" "}
          <Link to="/insights">Insights</Link>.
        </p>
      )}

      {/* The plan's one dial: how long a title may wait for a fuller month. */}
      <MaxWait rotation={rotation} />

      {renewals.length > 0 && (
        <div className="renewals__calendar">
          <label>
            Remind me
            <input
              type="number"
              min={0}
              max={30}
              value={lead}
              aria-label="Days before a renewal to remind you"
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= LEAD_DAYS.min && n <= LEAD_DAYS.max) setLead(n);
              }}
            />
            {lead === 1 ? "day" : "days"} before
          </label>
          <button type="button" className="button" onClick={download}>
            Add to calendar (.ics)
          </button>
          <p className="renewals__note">
            Covers every renewal in the next {WINDOW_DAYS} days, with today's advice, plus a
            reminder a month and a week before each yearly plan renews. Download it again after your
            watchlist changes; it updates the same events.
          </p>
        </div>
      )}
    </Panel>
  );
}

/** The calendar event's title: the decision first, then the date. */
function summary(r: Upcoming, today: string): string {
  const date = when(r.renewsOn, today);
  if (r.advice.action === "pause") return `Cancel ${r.name} before it renews ${date}`;
  if (r.advice.action === "keep") return `${r.name} renews ${date}: keep it`;
  return `Turn off ${r.name}'s yearly auto-renew: renews ${date}`;
}
