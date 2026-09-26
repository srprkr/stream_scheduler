/**
 * Published US monthly prices for each tracked service. No API publishes
 * these, so they are checked by hand against each service's own pages and
 * dated. They live here rather than in a CatalogSource: prices are the app's
 * own data, not TMDB's, and every source serves the same ones.
 *
 * Money is whole cents throughout. Each service marks one plan `isDefault`,
 * the one assumed when a user ticks it without choosing: the cheapest tier
 * that carries the full catalogue, so estimates lean low, not high.
 */

export interface PlanRecord {
  /** Stable within its service. */
  id: string;
  name: string;
  monthlyCents: number;
  hasAds: boolean;
  isDefault: boolean;
  /**
   * Starts outside the estimates: the plan pays for more than streaming,
   * so pausing it is rarely the question. The user can bring it back in.
   */
  leaveOutByDefault: boolean;

  /** What sets the plan apart beyond price and ads, when anything does. */
  note: string | null;
}

/** When every price below was last checked. */
export const PRICES_CHECKED_ON = "2026-09-26";

const plan = (
  id: string,
  name: string,
  monthlyCents: number,
  hasAds: boolean,
  extra: { isDefault?: boolean; leaveOutByDefault?: boolean; note?: string } = {},
): PlanRecord => ({
  id,
  name,
  monthlyCents,
  hasAds,
  isDefault: extra.isDefault ?? false,
  leaveOutByDefault: extra.leaveOutByDefault ?? false,
  note: extra.note ?? null,
});

export const PLANS: Record<string, PlanRecord[]> = {
  netflix: [
    plan("standard-ads", "Standard with ads", 899, true, { isDefault: true }),
    plan("standard", "Standard", 1999, false),
    plan("premium", "Premium", 2699, false),
  ],
  peacock: [
    plan("select", "Select", 899, true, {
      note: "NBC and Bravo shows only: no movies, sports, live TV or Peacock originals",
    }),
    plan("premium", "Premium", 1299, true, { isDefault: true }),
    plan("premium-plus", "Premium Plus", 1999, false),
  ],
  hulu: [
    plan("ads", "With ads", 1249, true, { isDefault: true }),
    plan("no-ads", "No ads", 2149, false),
  ],
  prime: [
    plan("standalone", "Prime Video only", 899, true),
    plan("standalone-ad-free", "Prime Video only, ad-free", 1398, false),
    plan("with-prime", "Amazon Prime", 1499, true, {
      isDefault: true,
      leaveOutByDefault: true,
      note: "Includes Prime shipping and other Prime benefits",
    }),
    plan("with-prime-ad-free", "Amazon Prime + ad-free add-on", 1998, false, {
      leaveOutByDefault: true,
      note: "Includes Prime shipping and other Prime benefits",
    }),
  ],

  appletv: [plan("monthly", "Apple TV", 1499, false, { isDefault: true })],
  disney: [
    plan("ads", "With ads", 1249, true, { isDefault: true }),
    plan("premium", "Premium", 2149, false),
  ],
  hbomax: [
    plan("basic-ads", "Basic with ads", 1099, true, { isDefault: true }),
    plan("standard", "Standard", 1849, false),
    plan("premium", "Premium", 2299, false),
  ],
  paramount: [
    plan("essential", "Essential", 899, true, { isDefault: true }),
    plan("premium", "Premium", 1399, false),
  ],
};
