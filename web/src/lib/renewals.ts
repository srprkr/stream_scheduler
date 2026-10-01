import { formatDollars } from "./money";
import { listTitles } from "./replaces";
import { roughly, when, type Readiness } from "./seasons";
import type { Billing } from "./subscriptions";

// Dates here are YYYY-MM-DD calendar dates, worked on in UTC so no timezone
// can move one across midnight.

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y as number, m as number, d as number];
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Days in a month, 1-based: daysIn(2027, 2) is 28. */
function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** A day of the month that a short month doesn't have becomes its last. */
function onDay(y: number, m: number, day: number): string {
  return iso(y, m, Math.min(day, daysIn(y, m)));
}

/** `iso` moved by whole days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The first renewal on or after `from`. A monthly plan billed on the 31st
 * renews on the 30th in a 30-day month; an annual plan renewed on Feb 29
 * renews on Feb 28 in other years.
 */
export function nextRenewal(billing: Billing, from: string): string {
  const [y, m] = parts(from);
  if (billing.cycle === "monthly") {
    const thisMonth = onDay(y, m, billing.day);
    if (thisMonth >= from) return thisMonth;
    return m === 12 ? onDay(y + 1, 1, billing.day) : onDay(y, m + 1, billing.day);
  }
  const [, rm, rd] = parts(billing.renewsOn);
  if (billing.renewsOn >= from) return billing.renewsOn;
  const thisYear = onDay(y, rm, rd);
  return thisYear >= from ? thisYear : onDay(y + 1, rm, rd);
}

/** Every renewal from `from` up to and including `until`, soonest first. */
export function renewalsBetween(billing: Billing, from: string, until: string): string[] {
  const dates: string[] = [];
  for (let next = nextRenewal(billing, from); next <= until;) {
    dates.push(next);
    next = nextRenewal(billing, addDays(next, 1));
  }
  return dates;
}

/** A watchlist title on one service, with when it can be watched through. */
export interface AdviceTitle {
  title: string;
  ready: Readiness;
}

export interface RenewalAdvice {
  /**
   * keep: something on the watchlist finishes inside the month this renewal
   * pays for. pause: nothing does, so the renewal can be skipped. decide:
   * either titles already out by then, which only the user knows whether
   * they've watched, or an annual renewal - a yearly choice the numbers can
   * only inform.
   */
  action: "keep" | "pause" | "decide";
  text: string;
}

/**
 * What to do about one renewal, from the user's watchlist on that service.
 *
 * A monthly renewal pays for the month up to the next one. If something on
 * the watchlist finishes inside that month, keep it. If something is
 * already out by the renewal, ask - it may have been watched. Otherwise
 * pausing saves the month, and the advice says until when. An annual renewal shows the break-even against paying monthly: the
 * yearly price only wins if the service would be kept that many months.
 */
export function renewalAdvice({
  service,
  billing,
  renewsOn,
  titles,
  monthlyCents,
  today,
}: {
  service: string;
  billing: Billing;
  renewsOn: string;
  titles: readonly AdviceTitle[];
  /** What it costs a month: the plan's price, or the user's own. */
  monthlyCents: number | null;
  today: string;
}): RenewalAdvice {
  const outNow = titles.filter((t) => t.ready.state === "now").map((t) => t.title);
  const dated = titles
    .flatMap((t) => (t.ready.state === "on" ? [{ title: t.title, ready: t.ready }] : []))
    .sort((a, b) => a.ready.date.localeCompare(b.ready.date));
  const undated = titles.filter((t) => t.ready.state === "unknown").map((t) => t.title);

  if (billing.cycle === "annual") {
    const lines = [`${service}'s annual plan renews ${when(renewsOn, today)}.`];
    if (billing.cents !== null && monthlyCents) {
      const months = billing.cents / monthlyCents;
      lines.push(
        `At ${formatDollars(billing.cents)} a year against ${formatDollars(monthlyCents)} a month, ` +
          `the annual plan only saves money if you'd keep ${service} about ` +
          `${Math.round(months)} months or more a year.`,
      );
    }
    if (titles.length > 0) {
      lines.push(`On your watchlist: ${listTitles(titles.map((t) => t.title))}.`);
    } else {
      lines.push(`Nothing on your watchlist is on ${service}.`);
    }
    return { action: "decide", text: lines.join(" ") };
  }

  const paidUntil = nextRenewal(billing, addDays(renewsOn, 1));
  const saves = monthlyCents ? ` Pausing saves ${formatDollars(monthlyCents)}.` : "";

  // Judged from the renewal's own date, not today's: a film out next week
  // is "coming" now but already out by a renewal two months away.
  const outBy = [...outNow, ...dated.filter((t) => t.ready.date < renewsOn).map((t) => t.title)];
  const inside = dated.filter((t) => t.ready.date >= renewsOn && t.ready.date < paidUntil);
  const later = dated.filter((t) => t.ready.date >= paidUntil);

  if (inside.length > 0) {
    const first = inside[0] as (typeof inside)[number];
    return {
      action: "keep",
      text: `Keep it: ${first.title} is all out ${dateText(first.ready, today)}, inside the month this renewal pays for.`,
    };
  }

  // What comes after, for the pause advice: the next dated title, or the
  // undated ones still to come.
  const next = later[0];
  const waiting = next
    ? `nothing else on your watchlist is all out until ${dateText(next.ready, today)} (${next.title})`
    : undated.length > 0
      ? `${listTitles(undated)} ${undated.length === 1 ? "has" : "have"} no dates yet`
      : `nothing else on your watchlist is on ${service}`;

  // Already out by the renewal: the app can't know whether they've been
  // watched, so it asks rather than tells.
  if (outBy.length > 0) {
    return {
      action: "decide",
      text: `Still watching ${listTitles(outBy)}? Keep it. Otherwise pause: ${waiting}.${saves}`,
    };
  }
  if (next) {
    return {
      action: "pause",
      text: `Pause it: nothing on your watchlist is all out until ${dateText(next.ready, today)} (${next.title}). Resubscribe then.${saves}`,
    };
  }
  if (undated.length > 0) {
    return {
      action: "pause",
      text: `Pause it: ${listTitles(undated)} ${undated.length === 1 ? "has" : "have"} no dates yet.${saves}`,
    };
  }
  return {
    action: "pause",
    text: `Nothing on your watchlist is on ${service}. Pause or cancel it?${saves}`,
  };
}

/** "Nov 25", or "around December" for an estimate. */
function dateText(ready: { date: string; estimated: boolean }, today: string): string {
  return ready.estimated ? `around ${roughly(ready.date, today)}` : when(ready.date, today);
}
