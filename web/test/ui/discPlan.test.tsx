// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscPlan } from "../../src/components/DiscPlan";
import { LibraryDetailsDocument } from "../../src/generated/graphql";
import { library } from "../../src/hooks/useLibrary";
import { planServicesMock, saveSubscriptions } from "./mocks";
import { renderApp } from "./render";

const detail = (id: string, hours: number | null) => ({
  __typename: id.startsWith("tv") ? ("Series" as const) : ("Movie" as const),
  id,
  score: null,
  releaseYear: null,
  totalRuntime:
    hours === null ? null : { __typename: "Runtime", minutes: hours * 60, estimated: false },
  availableOn: [],
});

type Shelved = { id: string; title: string; hours: number | null; shelf?: "wanted" | "owned" };

/** Shelves titles (wishlist unless said), and answers the details query for exactly those ids. */
function wishlist(titles: Shelved[]) {
  // The store outlives each test; storage is already cleared, so start from it.
  library.reload();
  for (const t of titles) {
    library.shelve(
      {
        id: t.id,
        kind: t.id.startsWith("tv") ? "Series" : "Movie",
        title: t.title,
        posterUrl: null,
      },
      t.shelf ?? "wanted",
    );
  }
  return {
    request: {
      query: LibraryDetailsDocument,
      variables: { ids: titles.map((t) => t.id).sort() },
    },
    result: { data: { mediaItems: titles.map((t) => detail(t.id, t.hours)) } },
  };
}

const panel = () => screen.getByRole("region", { name: "Content to own for your paused months" });

/** A paragraph of the panel by its whole text - the figures are their own elements. */
const paragraph = (text: RegExp) =>
  within(panel()).findByText((_, el) => el?.tagName === "P" && text.test(el.textContent ?? ""));

describe("Insights: discs for your pause months", () => {
  it("shows the wishlist as tiles in buying order, series first, each by when it's needed", async () => {
    // No watchlist, so every month pauses: six months of 20 h = 120 h.
    const details = wishlist([
      { id: "movie:1", title: "Heat", hours: 3 },
      { id: "tv:2", title: "The Wire", hours: 60 },
    ]);
    renderApp(<DiscPlan />, { mocks: [details, planServicesMock()] });

    const tiles = within(
      await within(panel()).findByRole("list", { name: "Your wishlist, in buying order" }),
    ).getAllByRole("listitem");
    expect(
      tiles.map((t) =>
        within(t)
          .getByRole("button", { name: /^(Heat|The Wire)$/ })
          .getAttribute("aria-label"),
      ),
    ).toEqual(["The Wire", "Heat"]);
    expect(within(tiles[0] as HTMLElement).getByText("Buy now · 60 h 0 m")).toBeInTheDocument();
    expect(within(tiles[1] as HTMLElement).getByText(/^Buy by .+ · 3 h 0 m$/)).toBeInTheDocument();
    // Own, to mark it bought; no watchlist on a library tile.
    expect(
      within(tiles[0] as HTMLElement).getByRole("button", { name: "I own The Wire" }),
    ).toBeInTheDocument();
    expect(within(panel()).getByText("120 h 0 m")).toBeInTheDocument();
  });

  it("marks a title not needed in the window, after the ones to buy", async () => {
    // 120 h of gaps: The Wire fills them all, so Heat isn't needed yet.
    const details = wishlist([
      { id: "movie:1", title: "Heat", hours: 3 },
      { id: "tv:2", title: "The Wire", hours: 200 },
    ]);
    renderApp(<DiscPlan />, { mocks: [details, planServicesMock()] });
    expect(await within(panel()).findByText("Not needed yet · 3 h 0 m")).toBeInTheDocument();
  });

  it("says how far short the wishlist falls, and suggests series", async () => {
    const details = wishlist([{ id: "movie:1", title: "Heat", hours: 3 }]);
    renderApp(<DiscPlan />, { mocks: [details, planServicesMock()] });
    expect(
      await paragraph(/your wishlist covers 3 h 0 m of it - 117 h 0 m short/),
    ).toBeInTheDocument();
    expect(within(panel()).getByRole("link", { name: "What's On" })).toHaveAttribute(
      "href",
      "/whats-on",
    );
  });

  it("gives the owned library's runtime its own figure, apart from the wishlist", async () => {
    const details = wishlist([
      { id: "tv:9", title: "The Office", hours: 60, shelf: "owned" },
      { id: "movie:1", title: "Heat", hours: 3 },
    ]);
    renderApp(<DiscPlan />, { mocks: [details, planServicesMock()] });
    expect(
      await paragraph(/library runtime covers that much of it - 60 h 0 m short/),
    ).toBeInTheDocument();
    // The wishlist is judged against the whole gap, not what's left after the library.
    expect(
      await paragraph(/your wishlist covers 3 h 0 m of it - 117 h 0 m short/),
    ).toBeInTheDocument();
  });

  it("says when the library covers it all", async () => {
    const details = wishlist([{ id: "tv:9", title: "The Office", hours: 200, shelf: "owned" }]);
    renderApp(<DiscPlan />, { mocks: [details, planServicesMock()] });
    expect(await paragraph(/library runtime covers it\./)).toBeInTheDocument();
    // The library's figure goes green; the gap's stays as it is.
    expect(within(panel()).getByText("200 h 0 m")).toHaveClass("disc-plan__figure--good");
    expect(within(panel()).getByText("120 h 0 m")).not.toHaveClass("disc-plan__figure--good");
  });

  it("keeps the library's figure plain when it falls short", async () => {
    const details = wishlist([{ id: "tv:9", title: "The Office", hours: 50, shelf: "owned" }]);
    renderApp(<DiscPlan />, { mocks: [details, planServicesMock()] });
    await paragraph(/library runtime covers that much of it/);
    expect(within(panel()).getByText("50 h 0 m")).not.toHaveClass("disc-plan__figure--good");
  });

  it("caps what the discs are worth at what pausing saves over the same months", async () => {
    // Netflix with ads at $8.99, nothing on the watchlist: six pause months.
    saveSubscriptions([{ slug: "netflix", choice: { planId: "standard-ads" } }]);
    const details = wishlist([{ id: "movie:1", title: "Heat", hours: 3 }]);
    renderApp(<DiscPlan />, { mocks: [details, planServicesMock()] });
    expect(
      await paragraph(/saved from pausing subscriptions for the next 6 months/),
    ).toHaveTextContent("Keep what you spend on discs lower than $53.94");
  });

  it("asks for the services paid for before it can set a budget", async () => {
    const details = wishlist([{ id: "movie:1", title: "Heat", hours: 3 }]);
    renderApp(<DiscPlan />, { mocks: [details, planServicesMock()] });
    expect(
      await within(panel()).findByText(/Tell us what you pay for in Your services below/),
    ).toBeInTheDocument();
  });
});
