import { LEVELS, type Levels } from "../lib/levels";
import { useStored } from "./useStored";

/**
 * Every per-user setting in one place: its saved key, its default, and the
 * values it accepts. The Settings page edits them; the controls elsewhere
 * (Home's hours a month, the "Wait at most" box, the reminder lead time)
 * read and write the same saved values, so each shows the other's change
 * the next time it's opened.
 *
 * Anything saved that falls outside the accepted values - typed by hand, or
 * saved by an older version - reads as the default.
 */

const whole = (min: number, max: number) => (saved: string) => {
  const n = Number(saved);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};

export const HOURS_PER_MONTH = {
  key: "stream-scheduler:hours-per-month",
  /** A starting point the user is asked to change, not a claim about them. */
  fallback: 20,
  min: 1,
  max: 300,
};

export const MAX_WAIT = {
  key: "stream-scheduler:max-wait-months",
  /** The feed's 90-day window: as far ahead as release dates are known. */
  fallback: 3,
  choices: [1, 2, 3, 4, 6] as const,
};

export const LEAD_DAYS = {
  key: "stream-scheduler:reminder-lead-days",
  fallback: 3,
  min: 0,
  max: 30,
};

const LEVELS_KEY = "stream-scheduler:levels";

/** The user's viewing pace, which every plan and estimate works from. */
export function useHoursPerMonth() {
  return useStored(
    HOURS_PER_MONTH.key,
    HOURS_PER_MONTH.fallback,
    whole(HOURS_PER_MONTH.min, HOURS_PER_MONTH.max),
  );
}

/** How long the plan may leave a title that's out waiting for a fuller month. */
export function useMaxWaitMonths() {
  return useStored(MAX_WAIT.key, MAX_WAIT.fallback, (saved) => {
    const n = Number(saved);
    return (MAX_WAIT.choices as readonly number[]).includes(n) ? n : undefined;
  });
}

/** Days before a renewal its calendar reminder fires. */
export function useLeadDays() {
  return useStored(LEAD_DAYS.key, LEAD_DAYS.fallback, whole(LEAD_DAYS.min, LEAD_DAYS.max));
}

/**
 * The Insights colour thresholds. Saved as one object; each field that's
 * missing or out of range falls back to its default on its own, so a
 * partly-bad save still keeps the good parts.
 */
export function useLevels() {
  return useStored<Levels>(
    LEVELS_KEY,
    LEVELS,
    (saved) => {
      try {
        const raw = JSON.parse(saved) as Partial<Record<keyof Levels, unknown>>;
        const pick = (field: keyof Levels, ok: (n: number) => boolean) => {
          const n = raw[field];
          return typeof n === "number" && ok(n) ? n : LEVELS[field];
        };
        return {
          spendHighCents: pick("spendHighCents", (n) => Number.isInteger(n) && n >= 0),
          ownedGoodMonths: pick("ownedGoodMonths", (n) => n > 0),
          ownedGoodTitles: pick("ownedGoodTitles", (n) => Number.isInteger(n) && n > 0),
          approaching: pick("approaching", (n) => n > 0 && n < 1),
        };
      } catch {
        return undefined;
      }
    },
    (levels) => JSON.stringify(levels),
  );
}
