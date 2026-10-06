/**
 * How to cancel each tracked service, and what to know first. Like the plan
 * prices, no API publishes this: it's checked by hand against each service's
 * help pages and dated, since these flows change.
 *
 * The fact the app leans on most: every service here keeps a cancelled
 * subscription running to the end of the period already paid for. So
 * cancelling the day you subscribe costs nothing - you keep the month and it
 * simply doesn't renew - and turning off a yearly plan's renewal today keeps
 * the rest of the year. That's how the plan avoids forgotten renewals.
 *
 * Wording here is shown to users as written. Where a claim comes only from
 * third-party guides, not the service's own pages, it says so.
 */
export interface CancellationRecord {
  /** Where to cancel when billed by the service itself. */
  url: string;
  steps: string[];
  /** Access continues to the end of the paid period after cancelling. */
  keepsAccessUntilPeriodEnd: boolean;
  /** Cancel at least this long before renewal for it to take; null if any time. */
  cancelHoursBefore: number | null;
  /** A built-in pause, when the service has one. */
  pause: string | null;
  /** Refunds, monthly and yearly. */
  refunds: string;
  /** Contract gotchas: third-party billing, bundles, auto-resume, promos. */
  gotchas: string[];
}

/** When every record below was last checked. */
export const CANCELLATION_CHECKED_ON = "2026-10-05";

/** The same wording for every service that bills through app stores and partners. */
const THIRD_PARTY =
  "Billed through Apple, Google, Amazon, Roku, a phone carrier or a TV provider? Cancel there instead - the service can't cancel it for you.";

export const CANCELLATION: Record<string, CancellationRecord> = {
  netflix: {
    url: "https://www.netflix.com/cancelplan",
    steps: [
      "Go to netflix.com/cancelplan and sign in.",
      "Choose Cancel, then Finish Cancellation.",
    ],
    keepsAccessUntilPeriodEnd: true,
    cancelHoursBefore: null,
    pause: null,
    refunds: "No refunds for part of a month. No yearly plan.",
    gotchas: [
      THIRD_PARTY,
      "Deleting the app or signing out doesn't cancel.",
      "Your viewing history and profiles are kept for 24 months, so rejoining later picks up where you left off.",
    ],
  },
  hulu: {
    url: "https://secure.hulu.com/account/cancel",
    steps: ["Go to your Hulu Account page.", "Select Cancel under Your Subscription and confirm."],
    keepsAccessUntilPeriodEnd: true,
    cancelHoursBefore: null,
    pause:
      "Pause for up to 12 weeks from the Account page. It starts at your next billing date and resumes - and charges you - automatically. Not for yearly plans, Disney bundles, or most third-party billing.",
    refunds: "No refunds for part of a billing period.",
    gotchas: [
      THIRD_PARTY,
      "A pause ends by itself and bills you: cancelling is safer if you don't know when you'll be back.",
      "Part of a Disney bundle? It's managed - and cancelled - from your Disney+ account.",
    ],
  },
  disney: {
    url: "https://www.disneyplus.com/account/cancel-subscription",
    steps: [
      "Go to disneyplus.com/account/cancel-subscription and sign in.",
      "Select Cancel Subscription and confirm.",
    ],
    keepsAccessUntilPeriodEnd: true,
    cancelHoursBefore: null,
    pause: null,
    refunds:
      "No refunds or credits for part of a billing period, monthly or yearly (US terms). Refund requests are considered case by case.",
    gotchas: [
      THIRD_PARTY,
      "In a bundle (Hulu, HBO Max, ESPN)? Dropping one service changes the bundle's price - check before cancelling.",
    ],
  },
  hbomax: {
    url: "https://www.hbomax.com/subscription",
    steps: [
      "Go to hbomax.com/subscription and sign in.",
      "Choose Cancel Your Subscription and confirm.",
    ],
    keepsAccessUntilPeriodEnd: true,
    cancelHoursBefore: null,
    pause: null,
    refunds:
      "No refunds, including yearly plans - you keep access to the end of the term instead. (An Extra Member add-on is refunded pro rata.)",
    gotchas: [
      THIRD_PARTY,
      "Through Hulu, Amazon or a TV provider? It's billed - and cancelled - there.",
      "Cancelling can bring a discounted yearly offer. Tempting, but it's another year locked in.",
    ],
  },
  peacock: {
    url: "https://www.peacocktv.com/account/plans",
    steps: [
      "Sign in to the account that pays for Peacock.",
      "Open Plans & Payment, select Cancel Plan (or Cancel All Subscriptions) and confirm.",
    ],
    keepsAccessUntilPeriodEnd: true,
    cancelHoursBefore: 24,
    pause: null,
    refunds:
      "No refunds or credits for earlier payments, monthly or yearly, unless the law requires one.",
    gotchas: [
      THIRD_PARTY,
      "Included with Xfinity, Instacart+ or another bundle? Cancel with that provider.",
      "A yearly plan is non-refundable: once paid, the year is spent.",
    ],
  },
  paramount: {
    url: "https://www.paramountplus.com/account/",
    steps: ["Go to your Paramount+ Account page.", "Select Cancel Subscription and confirm."],
    keepsAccessUntilPeriodEnd: true,
    cancelHoursBefore: null,
    pause: "No pause in the account settings, though one is sometimes offered during cancelling.",
    refunds:
      "No refunds of fees paid, per Paramount+'s own policy. Guides report yearly subscribers getting a prorated refund through live chat - not in the official policy, so not guaranteed.",
    gotchas: [
      THIRD_PARTY,
      "Included with Walmart+ (Essential)? It's tied to that membership.",
      "If a refund is issued, access ends at once rather than at the end of the term.",
    ],
  },
  appletv: {
    url: "https://account.apple.com/account/manage/section/subscriptions",
    steps: [
      "On iPhone or iPad: Settings › your name › Subscriptions › Apple TV › Cancel.",
      "Or on the web: account.apple.com › Subscriptions.",
    ],
    keepsAccessUntilPeriodEnd: true,
    cancelHoursBefore: 24,
    pause: null,
    refunds: "No refunds for part of a period through the usual cancel flow.",
    gotchas: [
      "Apple renews about a day early: cancel at least 24 hours before the renewal date.",
      "Part of Apple One? Cancelling Apple TV alone means changing or leaving the bundle.",
      "A free trial that came with a device turns into a paid plan unless cancelled.",
    ],
  },
  prime: {
    url: "https://www.amazon.com/mc",
    steps: [
      "Go to Your Prime Membership (amazon.com/mc).",
      "Select Manage Membership › End Membership, and choose to end it at the end of the current period.",
      "Prime Video only, without Prime? Account & Settings › Your Account › End Subscription.",
    ],
    keepsAccessUntilPeriodEnd: true,
    cancelHoursBefore: null,
    pause: null,
    refunds:
      "Amazon asks whether to end now or at the period's end. If nobody in the household has used a Prime benefit, the current period is refunded in full; guides report a prorated refund of the unused part of a yearly plan.",
    gotchas: [
      "Ending Prime ends free shipping and every other Prime benefit too, not just Prime Video.",
      "Prime Video Channels (HBO Max, Paramount+ and others bought through Amazon) are billed separately - cancel each under Your Channels.",
      "The ad-free add-on is its own monthly charge on top of Prime.",
    ],
  },
};
