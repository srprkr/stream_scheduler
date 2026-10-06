// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CatalogDocument, ServiceNamesDocument } from "../../src/generated/graphql";
import { WhatsOnPage } from "../../src/pages/WhatsOnPage";
import { renderApp } from "./render";

const provider = (slug: string, name: string) => ({
  __typename: "Provider" as const,
  id: `provider:${slug}`,
  slug,
  name,
  logoUrl: null,
});
const hulu = provider("hulu", "Hulu");
const netflix = provider("netflix", "Netflix");

const services = {
  request: { query: ServiceNamesDocument },
  result: { data: { providers: [hulu, netflix] } },
};

/** One catalogue page of a single type, as the server would send it. */
const catalog = (kind: "SERIES" | "MOVIE", titles: string[]) => ({
  request: {
    query: CatalogDocument,
    variables: { providerSlugs: ["hulu", "netflix"], kind, sort: "POPULAR" },
  },
  result: {
    data: {
      catalog: {
        __typename: "CatalogPage" as const,
        nextCursor: null,
        items: titles.map((title, i) =>
          kind === "SERIES"
            ? {
                __typename: "Series" as const,
                id: `tv:${i}`,
                title,
                posterUrl: null,
                onDisc: false,
                availableOn: [netflix],
                nextSeason: null,
              }
            : {
                __typename: "Movie" as const,
                id: `movie:${i}`,
                title,
                posterUrl: null,
                onDisc: false,
                availableOn: [hulu],
              },
        ),
      },
    },
  },
});

const mocks = [
  services,
  catalog("SERIES", ["Severance", "Slow Horses"]),
  catalog("MOVIE", ["Heat", "Ronin"]),
];

/** The type toggles are buttons that say whether they're on. */
const toggle = (name: "Series" | "Films") => screen.getByRole("button", { name, pressed: true });

describe("What's On: the Series / Films filter", () => {
  it("shows both types to start", async () => {
    renderApp(<WhatsOnPage />, { mocks, route: "/whats-on" });
    expect(await screen.findByText("Severance")).toBeInTheDocument();
    expect(await screen.findByText("Heat")).toBeInTheDocument();
  });

  it("hides films when Films is switched off, though they're still cached", async () => {
    const user = userEvent.setup();
    renderApp(<WhatsOnPage />, { mocks, route: "/whats-on" });
    await screen.findByText("Heat");

    await user.click(toggle("Films"));

    // The films query is now skipped - and in Apollo 4 a skipped query keeps
    // its last result. The page must not show it.
    await waitFor(() => expect(screen.queryByText("Heat")).not.toBeInTheDocument());
    expect(screen.queryByText("Ronin")).not.toBeInTheDocument();
    expect(screen.getByText("Severance")).toBeInTheDocument();
  });

  it("hides series when Series is switched off", async () => {
    const user = userEvent.setup();
    renderApp(<WhatsOnPage />, { mocks, route: "/whats-on" });
    await screen.findByText("Severance");

    await user.click(toggle("Series"));

    await waitFor(() => expect(screen.queryByText("Severance")).not.toBeInTheDocument());
    expect(screen.getByText("Heat")).toBeInTheDocument();
  });

  it("asks for a type when both are off", async () => {
    const user = userEvent.setup();
    renderApp(<WhatsOnPage />, { mocks, route: "/whats-on" });
    await screen.findByText("Heat");

    await user.click(toggle("Series"));
    await user.click(toggle("Films"));

    expect(await screen.findByText(/Pick at least one service and a type/)).toBeInTheDocument();
    expect(screen.queryByText("Heat")).not.toBeInTheDocument();
  });
});
