import { useQuery } from "@apollo/client/react";

import { graphql } from "../generated";
import { useStored } from "../hooks/useStored";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { useWatchlist } from "../hooks/useWatchlist";
import { icsCalendar, type CalendarEvent } from "../lib/calendar";
import { listTitles } from "../lib/replaces";
import { addDays, renewalAdvice, renewalsBetween, type RenewalAdvice } from "../lib/renewals";
import { localToday, when } from "../lib/seasons";
import { monthlyCents } from "../lib/subscriptions";
import { watchlistByService } from "../lib/watchlist";
import { Panel } from "./Panel";
import { ServiceLogo } from "./ServiceLogo";

// The same plan fields as MyServices: see the note in ComingSoonStats.
const RENEWAL_SERVICES = graphql(`
  query RenewalServices {
    providers {
      ...ServiceLogo
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

/** The horizon the release feed covers, and so the one advice can see. */
const WINDOW_DAYS = 90;
const DEFAULT_LEAD_DAYS = 3;

interface Upcoming {
  slug: string;
  name: string;
  logoUrl: string | null | undefined;
  renewsOn: string;
  yearly: boolean;
  advice: RenewalAdvice;
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
  const providers = useQuery(RENEWAL_SERVICES).data?.providers ?? [];
  const { titles } = useWatchlist();
  const [lead, setLead] = useStored(
    "stream-scheduler:reminder-lead-days",
    DEFAULT_LEAD_DAYS,
    (s) => {
      const n = Number(s);
      return Number.isInteger(n) && n >= 0 && n <= 30 ? n : undefined;
    },
  );

  if (mine.length === 0) return null;

  const subscribed = new Set(mine.map((s) => s.slug));
  const { services } = watchlistByService([...titles.values()], subscribed, today);

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
    const onService = services.find((s) => s.key === sub.slug)?.titles ?? [];
    for (const renewsOn of renewalsBetween(sub.billing, today, until)) {
      renewals.push({
        slug: sub.slug,
        name,
        logoUrl: provider?.logoUrl,
        renewsOn,
        yearly: sub.billing.cycle === "annual",
        advice: renewalAdvice({
          service: name,
          billing: sub.billing,
          renewsOn,
          titles: onService,
          monthlyCents: monthly,
          today,
        }),
      });
    }
  }
  renewals.sort((a, b) => a.renewsOn.localeCompare(b.renewsOn));
  const next = renewals.filter((r, i) => renewals.findIndex((x) => x.slug === r.slug) === i);

  const download = () => {
    const events: CalendarEvent[] = renewals.map((r) => {
      const remindOn = addDays(r.renewsOn, -lead);
      return {
        uid: `${r.slug}-${r.renewsOn}@streamhopper`,
        // A reminder already due fires today rather than in the past.
        date: remindOn < today ? today : remindOn,
        summary: summary(r, today),
        description: `${r.advice.text} Renews ${when(r.renewsOn, today)}.`,
      };
    });
    const blob = new Blob([icsCalendar(events, new Date())], { type: "text/calendar" });
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
        When each service renews, and whether your watchlist says to keep it or pause it first.
      </p>

      <ul className="renewals__list">
        {next.map((r) => (
          <li key={r.slug} className="renewals__row">
            <ServiceLogo name={r.name} logoUrl={r.logoUrl} active size="row" />
            <div>
              <p className="renewals__head">
                <strong>{r.name}</strong> renews {when(r.renewsOn, today)}
                <span className="renewals__action" data-action={r.advice.action}>
                  {r.advice.action === "keep"
                    ? "Keep"
                    : r.advice.action === "pause"
                      ? "Pause"
                      : "Decide"}
                </span>
              </p>
              <p className="renewals__advice">{r.advice.text}</p>
            </div>
          </li>
        ))}
      </ul>

      {unset.length > 0 && (
        <p className="renewals__note">
          No renewal day yet for {listTitles(unset)}: set one with ⋯ in Your services.
        </p>
      )}

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
                if (Number.isInteger(n) && n >= 0 && n <= 30) setLead(n);
              }}
            />
            {lead === 1 ? "day" : "days"} before
          </label>
          <button type="button" className="button" onClick={download}>
            Add to calendar (.ics)
          </button>
          <p className="renewals__note">
            Covers every renewal in the next {WINDOW_DAYS} days, with today's advice. Download it
            again after your watchlist changes; it updates the same events.
          </p>
        </div>
      )}
    </Panel>
  );
}

/** The calendar event's title: the decision first, then the date. */
function summary(r: Upcoming, today: string): string {
  const date = when(r.renewsOn, today);
  if (r.advice.action === "pause") return `Pause ${r.name} before it renews ${date}`;
  if (r.advice.action === "keep") return `${r.name} renews ${date}: keep it`;
  if (r.yearly) return `${r.name}'s yearly plan renews ${date}`;
  return `${r.name} renews ${date}: keep or pause?`;
}
