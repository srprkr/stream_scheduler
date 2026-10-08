// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CatalogTile } from "../../src/components/CatalogTile";
import { ScoreFact } from "../../src/components/ScoreBadge";
import { CatalogDocument, DiscCatalogDocument } from "../../src/generated/graphql";
import { WhatsOnPage } from "../../src/pages/WhatsOnPage";
import { netflix, saveSubscriptions, serviceNames } from "./mocks";
import { renderApp } from "./render";

const item = (title: string, score: { average: number; votes: number } | null) => ({
  __typename: "Movie" as const,
  id: `movie:${title}`,
  title,
  posterUrl: null,
  onDisc: false,
  availableOn: [netflix],
  score,
  releaseYear: 1995,
});

describe("A tile's score", () => {
  it("shows TMDB's score, with the votes in its name", () => {
    renderApp(
      <CatalogTile item={item("Heat", { average: 7.94, votes: 7012 })} onOpen={() => {}} />,
    );
    expect(
      screen.getByRole("img", { name: "TMDB score 7.9 out of 10, from 7,012 votes" }),
    ).toHaveTextContent("★ 7.9");
  });

  it("sits at the end of the Own / Want / Watchlist row, not with the logos", () => {
    const onDisc = { ...item("Heat", { average: 7.94, votes: 7012 }), onDisc: true };
    renderApp(<CatalogTile item={onDisc} onOpen={() => {}} />);
    const score = screen.getByRole("img", { name: /TMDB score/ });
    const row = score.closest(".tile-actions") as HTMLElement;
    expect(within(row).getByRole("button", { name: "I own Heat" })).toBeInTheDocument();
    expect(score.closest(".shelf__services")).toBeNull();
  });

  it("shows nothing when too few have voted to trust it", () => {
    renderApp(<CatalogTile item={item("Obscure", { average: 10, votes: 2 })} onOpen={() => {}} />);
    expect(screen.queryByRole("img", { name: /TMDB score/ })).not.toBeInTheDocument();
  });
});

describe("A dialog's score", () => {
  it("leads with the same amber star as the tiles", () => {
    renderApp(
      <dl>
        <ScoreFact score={{ average: 7.94, votes: 7012 }} />
      </dl>,
    );
    const fact = screen.getByText("Score").nextElementSibling as HTMLElement;
    expect(fact).toHaveTextContent("★ 7.9 / 10 · 7,012 votes on TMDB");
    expect(fact.querySelector(".score__star")).toHaveTextContent("★");
  });
});

const page = (titles: string[]) => ({
  catalog: {
    __typename: "CatalogPage" as const,
    nextCursor: null,
    items: titles.map((t) => item(t, { average: 8.1, votes: 900 })),
  },
});
const catalog = (kind: "SERIES" | "MOVIE", extra: Record<string, unknown>, titles: string[]) => ({
  request: {
    query: CatalogDocument,
    variables: {
      providerSlugs: ["netflix"],
      kind,
      sort: "POPULAR",
      minScore: null,
      fromYear: null,
      toYear: null,
      ...extra,
    },
  },
  result: { data: page(titles) },
});

describe("What's On: sort, score and year", () => {
  it("asks the server for the chosen sort, minimum score and decade", async () => {
    const user = userEvent.setup();
    saveSubscriptions([{ slug: "netflix", choice: { planId: "x" } }]);
    const mocks = [
      serviceNames(netflix),
      catalog("MOVIE", {}, ["Anything"]),
      catalog("SERIES", {}, []),
      catalog("MOVIE", { sort: "OLDEST" }, ["Psycho"]),
      catalog("SERIES", { sort: "OLDEST" }, []),
      catalog("MOVIE", { sort: "OLDEST", minScore: 8 }, ["Psycho"]),
      catalog("SERIES", { sort: "OLDEST", minScore: 8 }, []),
      catalog("MOVIE", { sort: "OLDEST", minScore: 8, fromYear: 1990, toYear: 1999 }, ["Heat"]),
      catalog("SERIES", { sort: "OLDEST", minScore: 8, fromYear: 1990, toYear: 1999 }, []),
      {
        request: {
          query: DiscCatalogDocument,
          variables: { sort: "POPULAR", minScore: null, fromYear: null, toYear: null },
        },
        result: {
          data: { discCatalog: { __typename: "CatalogPage", nextCursor: null, items: [] } },
        },
      },
    ];
    renderApp(<WhatsOnPage />, { mocks, route: "/whats-on" });
    await screen.findByText("Anything");

    await user.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "Oldest");
    await user.selectOptions(screen.getByRole("combobox", { name: "Score" }), "8+");
    await user.selectOptions(screen.getByRole("combobox", { name: "Released" }), "1990s");

    // Only a request with all three answers with Heat.
    const heat = await screen.findByText("Heat");
    expect(within(heat.closest("li") as HTMLElement).getByText("★", { exact: false })).toBeTruthy();
    expect(screen.queryByText("Anything")).not.toBeInTheDocument();
  });
});
