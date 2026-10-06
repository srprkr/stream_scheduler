// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { InsightsSummary } from "../../src/components/InsightsSummary";
import { PlanServicesDocument } from "../../src/generated/graphql";
import { SUBSCRIPTIONS_KEY } from "../../src/lib/subscriptions";
import { renderApp } from "./render";

// Netflix, priced, with a cancellation record - what Paths forward reads.
const mocks = [
  {
    request: { query: PlanServicesDocument },
    result: {
      data: {
        providers: [
          {
            __typename: "Provider" as const,
            id: "provider:netflix",
            slug: "netflix",
            name: "Netflix",
            logoUrl: null,
            cancellation: {
              __typename: "Cancellation" as const,
              url: "https://www.netflix.com/cancelplan",
              steps: ["Go to netflix.com/cancelplan and sign in."],
              keepsAccessUntilPeriodEnd: true,
              cancelHoursBefore: null,
              pause: null,
              refunds: "No refunds for part of a month.",
              gotchas: [],
              checkedOn: "2026-10-05",
            },
            plans: [
              {
                __typename: "Plan" as const,
                id: "standard-ads",
                leaveOutByDefault: false,
                name: "Standard with ads",
                monthlyCents: 899,
                hasAds: true,
                isDefault: true,
                note: null,
                yearlyCents: null,
              },
            ],
          },
        ],
      },
    },
  },
];

// The user pays for Netflix monthly; nothing on their watchlist needs it.
beforeEach(() => {
  window.localStorage.setItem(
    SUBSCRIPTIONS_KEY,
    JSON.stringify({
      version: 2,
      subscriptions: [
        {
          slug: "netflix",
          choice: { planId: "standard-ads" },
          billing: { cycle: "monthly", day: 10 },
        },
      ],
    }),
  );
});

describe("Paths forward checklist", () => {
  it("ticks a step off, moves it under Done and adds up what it saved", async () => {
    const user = userEvent.setup();
    renderApp(<InsightsSummary />, { mocks });

    const step = await screen.findByRole("checkbox", { name: "Cancel Netflix now" });
    expect(step).not.toBeChecked();
    expect(screen.getByText("0 of 1 done")).toBeInTheDocument();

    await user.click(step);

    expect(screen.getByRole("checkbox", { name: "Cancel Netflix now" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("1 of 1 done · $26.97 saved");
    const done = screen.getByRole("heading", { name: "Done" }).nextElementSibling as HTMLElement;
    expect(within(done).getByText("Cancel Netflix now")).toBeInTheDocument();
    // Done steps drop their working and their how-to.
    expect(screen.queryByText(/How to cancel Netflix/)).not.toBeInTheDocument();
  });

  it("remembers the tick on the next visit", async () => {
    const user = userEvent.setup();
    const first = renderApp(<InsightsSummary />, { mocks });
    await user.click(await screen.findByRole("checkbox", { name: "Cancel Netflix now" }));
    first.unmount();

    renderApp(<InsightsSummary />, { mocks });
    expect(await screen.findByRole("checkbox", { name: "Cancel Netflix now" })).toBeChecked();
  });

  it("unticks a step back into the list", async () => {
    const user = userEvent.setup();
    renderApp(<InsightsSummary />, { mocks });
    const step = await screen.findByRole("checkbox", { name: "Cancel Netflix now" });
    await user.click(step);
    await user.click(screen.getByRole("checkbox", { name: "Cancel Netflix now" }));

    expect(screen.getByRole("checkbox", { name: "Cancel Netflix now" })).not.toBeChecked();
    expect(screen.queryByRole("heading", { name: "Done" })).not.toBeInTheDocument();
  });
});
