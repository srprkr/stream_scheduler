// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { WatchlistDetailsDocument } from "../../src/generated/graphql";
import { LIBRARY_KEY } from "../../src/lib/library";
import { addDays } from "../../src/lib/renewals";
import { localToday } from "../../src/lib/seasons";
import { WatchlistPage } from "../../src/pages/WatchlistPage";
import { netflix, peacock, planServicesMock, saveSubscriptions } from "./mocks";
import { renderApp } from "./render";

const today = localToday();

const entry = (id: string, kind: "Movie" | "Series", title: string) => ({
  id,
  kind,
  title,
  posterUrl: null,
  shelf: "watchlist",
  addedAt: `${today}T00:00:00.000Z`,
});

beforeEach(() => {
  window.localStorage.setItem(
    LIBRARY_KEY,
    JSON.stringify({
      version: 1,
      entries: [
        entry("tv:1", "Series", "Airing Show"),
        entry("movie:2", "Movie", "Coming Film"),
        entry("tv:3", "Series", "Next Year Show"),
      ],
    }),
  );
});

const series = (id: string, title: string, premieresOn: string, fullyOutOn: string | null) => ({
  __typename: "Series" as const,
  id,
  onDisc: false,
  totalRuntime: { __typename: "Runtime" as const, minutes: 600, estimated: false },
  availableOn: [peacock],
  otherServices: [],
  upcoming: [],
  madeFor: [peacock],
  nextSeason: {
    __typename: "SeasonSchedule" as const,
    seasonNumber: 2,
    premieresOn,
    fullyOutOn,
    expectedFullyOutOn: null,
    isFullDrop: false,
    watchTime: { __typename: "Runtime" as const, minutes: 400, estimated: true },
  },
});

const details = {
  request: { query: WatchlistDetailsDocument, variables: { ids: ["movie:2", "tv:1", "tv:3"] } },
  result: {
    data: {
      mediaItems: [
        // Not on any service yet: arriving on Netflix in two weeks.
        {
          __typename: "Movie" as const,
          id: "movie:2",
          onDisc: false,
          totalRuntime: { __typename: "Runtime" as const, minutes: 100, estimated: false },
          availableOn: [],
          otherServices: [],
          upcoming: [
            {
              __typename: "Release" as const,
              id: "release:netflix:movie:2",
              availableFrom: addDays(today, 14),
              bingeableFrom: addDays(today, 14),
              provider: netflix,
            },
          ],
        },
        // Premiered a week ago, airing weekly until next month.
        series("tv:1", "Airing Show", addDays(today, -7), addDays(today, 30)),
        // Its next season starts in a few months.
        series("tv:3", "Next Year Show", addDays(today, 120), null),
      ],
    },
  },
};

describe("Watchlist page", () => {
  it("splits titles into what's premiered and what hasn't", async () => {
    renderApp(<WatchlistPage />, { mocks: [details, planServicesMock()], route: "/watchlist" });

    const now = (await screen.findByRole("heading", { name: /Available now/ })).closest("section");
    const coming = screen.getByRole("heading", { name: /Coming soon/ }).closest("section");

    // Premiered and airing weekly counts as available now.
    expect(within(now as HTMLElement).getByText("Airing Show")).toBeInTheDocument();
    // Not yet arrived, or next season not yet started: coming soon.
    expect(within(coming as HTMLElement).getByText("Coming Film")).toBeInTheDocument();
    expect(within(coming as HTMLElement).getByText("Next Year Show")).toBeInTheDocument();
  });

  it("shows where a coming film is going, and when", async () => {
    renderApp(<WatchlistPage />, { mocks: [details, planServicesMock()], route: "/watchlist" });
    const coming = (await screen.findByRole("heading", { name: /Coming soon/ })).closest(
      "section",
    ) as HTMLElement;
    const film = within(coming).getByText("Coming Film").closest("li") as HTMLElement;
    expect(within(film).getByText(/^Arrives /)).toBeInTheDocument();
  });

  it("still shows renewals when the watchlist is empty", async () => {
    // Paying for a yearly plan with nothing on the watchlist is when the
    // renewal advice matters most.
    window.localStorage.removeItem(LIBRARY_KEY);
    saveSubscriptions([
      {
        slug: "peacock",
        choice: { planId: "premium" },
        billing: { cycle: "annual", renewsOn: addDays(today, 200), cents: 13999 },
      },
    ]);
    renderApp(<WatchlistPage />, { mocks: [planServicesMock()], route: "/watchlist" });

    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Renewals" })).toBeInTheDocument();
    expect(screen.getByText("Go monthly")).toBeInTheDocument();
  });
});
