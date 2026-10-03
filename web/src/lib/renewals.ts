import { formatDollars } from "./money";
import { listTitles } from "./replaces";
import { monthOn, type Plan } from "./planner";
import { when } from "./seasons";
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

export interface RenewalAdvice {
  /**
   * keep: this renewal falls in the plan's month for this service. pause:
   * it doesn't, so the renewal can be skipped. decide: an annual renewal - a
   * yearly choice the plan can only inform.
   */
  action: "keep" | "pause" | "decide";
  text: string;
}

/**
 * What to do about one renewal, read off the rotation plan (planner.ts):
 * one service a month, each getting its turn when it has a month's viewing
 * ready. A monthly renewal inside this service's month: keep it. Anywhere
 * else: pause, and say when its turn comes and what for. An annual renewal
 * shows the break-even against paying monthly, and how many months the plan
 * actually needs the service.
 */
export function renewalAdvice({
  service,
  key,
  billing,
  renewsOn,
  plan,
  nameOf,
  monthlyCents,
  today,
}: {
  service: string;
  /** The plan's key for this service: its slug. */
  key: string;
  billing: Billing;
  renewsOn: string;
  plan: Plan;
  /** A plan key's display name, for "this month is for Netflix". */
  nameOf: (key: string) => string;
  /** What it costs a month: the plan's price, or the user's own. */
  monthlyCents: number | null;
  today: string;
}): RenewalAdvice {
  const turns = plan.months.filter((m) => m.service === key);
  const waiting = plan.unplaced.filter((u) => u.key === key).map((u) => u.title);

  if (billing.cycle === "annual") {
    const lines = [`${service}'s annual plan renews ${when(renewsOn, today)}.`];
    const used = turns.length;
    lines.push(
      used === 0
        ? `The plan doesn't need ${service} in the year ahead.`
        : `The plan needs ${service} for ${used} ${used === 1 ? "month" : "months"} of the year ahead.`,
    );
    if (billing.cents !== null && monthlyCents) {
      const months = Math.round(billing.cents / monthlyCents);
      lines.push(
        `At ${formatDollars(billing.cents)} a year against ${formatDollars(monthlyCents)} a month, ` +
          `the annual plan only saves money if you'd keep it about ${months} months or more.`,
      );
    }
    return { action: "decide", text: lines.join(" ") };
  }

  const saves = monthlyCents ? ` Pausing saves ${formatDollars(monthlyCents)}.` : "";
  const month = monthOn(plan, renewsOn);

  if (month?.service === key) {
    return {
      action: "keep",
      text: `Keep it: this is ${service}'s month in your plan, for ${listTitles(month.watched.map((w) => w.title))}.`,
    };
  }

  const elsewhere = month?.service ? ` This month is for ${nameOf(month.service)}.` : "";
  const next = turns.find((m) => m.start > renewsOn);
  if (next) {
    return {
      action: "pause",
      text: `Pause it: ${service}'s next month in your plan starts ${when(next.start, today)}, for ${listTitles(next.watched.map((w) => w.title))}.${elsewhere}${saves}`,
    };
  }
  if (waiting.length > 0) {
    return {
      action: "pause",
      text: `Pause it: ${listTitles(waiting)} ${waiting.length === 1 ? "isn't" : "aren't"} enough for a month yet, or ${waiting.length === 1 ? "has" : "have"} no dates.${elsewhere}${saves}`,
    };
  }
  return {
    action: "pause",
    text: `Nothing on your watchlist needs ${service}. Pause or cancel it?${saves}`,
  };
}
