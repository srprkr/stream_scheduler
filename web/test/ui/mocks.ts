import {
  MyServicesDocument,
  PlanServicesDocument,
  ServiceNamesDocument,
} from "../../src/generated/graphql";

/** A tracked service as every provider selection returns it. */
export const provider = (slug: string, name: string) => ({
  __typename: "Provider" as const,
  id: `provider:${slug}`,
  slug,
  name,
  logoUrl: null,
});

export const hulu = provider("hulu", "Hulu");
export const netflix = provider("netflix", "Netflix");
export const peacock = provider("peacock", "Peacock");

/** The service list behind the browse filters. */
export const serviceNames = (...providers: ReturnType<typeof provider>[]) => ({
  request: { query: ServiceNamesDocument },
  result: { data: { providers } },
});

/** A saved subscription, written straight to storage before render. */
export function saveSubscriptions(subscriptions: unknown[]) {
  window.localStorage.setItem(
    "stream-scheduler:subscriptions",
    JSON.stringify({ version: 2, subscriptions }),
  );
}

const plan = (id: string, name: string, monthlyCents: number, extra: object = {}) => ({
  __typename: "Plan" as const,
  id,
  leaveOutByDefault: false,
  name,
  monthlyCents,
  hasAds: true,
  isDefault: false,
  note: null,
  yearlyCents: null,
  ...extra,
});

/** Netflix (monthly only) and Peacock (also sold yearly), with prices. */
export const pricedServices = [
  { ...netflix, plans: [plan("standard-ads", "Standard with ads", 899, { isDefault: true })] },
  {
    ...peacock,
    plans: [plan("premium", "Premium", 1299, { isDefault: true, yearlyCents: 13999 })],
  },
];

const cancellation = (url: string) => ({
  __typename: "Cancellation" as const,
  url,
  steps: ["Open your account and choose Cancel."],
  keepsAccessUntilPeriodEnd: true,
  cancelHoursBefore: null,
  pause: null,
  refunds: "No refunds.",
  gotchas: [],
  checkedOn: "2026-10-05",
});

/** What Your services asks for. */
export const myServicesMock = () => ({
  request: { query: MyServicesDocument },
  result: {
    data: {
      providers: pricedServices.map((p) => ({ ...p, pricesCheckedOn: "2026-09-26" })),
    },
  },
});

/** What the rotation plan asks for: prices plus how to cancel. */
export const planServicesMock = () => ({
  request: { query: PlanServicesDocument },
  result: {
    data: {
      providers: pricedServices.map((p) => ({
        ...p,
        cancellation: cancellation(`https://${p.slug}.example/cancel`),
      })),
    },
  },
});
