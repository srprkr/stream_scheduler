// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ReleaseFeed } from "../../src/components/ReleaseFeed";
import {
  CatalogDocument,
  DiscCatalogDocument,
  ReleaseFeedDocument,
  SearchEverywhereDocument,
  SearchMyServicesDocument,
} from "../../src/generated/graphql";
import { library } from "../../src/hooks/useLibrary";
import { WhatsOnPage } from "../../src/pages/WhatsOnPage";
import { hulu, netflix, serviceNames } from "./mocks";
import { renderApp } from "./render";

const film = (id: string, title: string, availableOn: (typeof netflix)[] = []) => ({
  __typename: "Movie" as const,
  id,
  title,
  posterUrl: null,
  onDisc: true,
  availableOn,
  score: null,
  releaseYear: null,
});

const page = (items: unknown[]) => ({
  __typename: "CatalogPage" as const,
  nextCursor: null,
  items,
});

const whatsOnMocks = [
  serviceNames(hulu, netflix),
  {
    request: {
      query: CatalogDocument,
      variables: {
        providerSlugs: ["hulu", "netflix"],
        kind: "MOVIE",
        sort: "POPULAR",
        minScore: null,
        fromYear: null,
        toYear: null,
      },
    },
    result: { data: { catalog: page([film("movie:1", "Heat", [netflix])]) } },
  },
  {
    request: {
      query: CatalogDocument,
      variables: {
        providerSlugs: ["hulu", "netflix"],
        kind: "SERIES",
        sort: "POPULAR",
        minScore: null,
        fromYear: null,
        toYear: null,
      },
    },
    result: { data: { catalog: page([]) } },
  },
  {
    request: {
      query: DiscCatalogDocument,
      variables: { kind: "MOVIE", sort: "POPULAR", minScore: null, fromYear: null, toYear: null },
    },
    result: { data: { discCatalog: page([film("movie:2", "Paper Lanterns")]) } },
  },
  {
    request: {
      query: DiscCatalogDocument,
      variables: { kind: "SERIES", sort: "POPULAR", minScore: null, fromYear: null, toYear: null },
    },
    result: {
      data: {
        discCatalog: page([
          {
            __typename: "Series" as const,
            id: "tv:8",
            title: "Lighthouse Keepers",
            posterUrl: null,
            onDisc: true,
            availableOn: [],
            score: null,
            releaseYear: null,
            nextSeason: null,
          },
        ]),
      },
    },
  },
];

const services = () => screen.getByRole("group", { name: "Services" });
/** A tile, found by its poster button. */
const tile = (title: string) =>
  screen.getByRole("button", { name: title }).closest("li") as HTMLElement;

describe("What's On: On disc", () => {
  it("weaves films out on disc in with the services' titles, marked On disc", async () => {
    // No services saved, so everything is selected - On disc included.
    renderApp(<WhatsOnPage />, { mocks: whatsOnMocks, route: "/whats-on" });
    expect(await screen.findByText("Paper Lanterns")).toBeInTheDocument();
    expect(await screen.findByText("Heat")).toBeInTheDocument();
    expect(await screen.findByText("Lighthouse Keepers")).toBeInTheDocument();
    expect(
      within(tile("Paper Lanterns")).getByRole("img", { name: "On disc" }),
    ).toBeInTheDocument();
    // Heat is listed for Netflix, not for its disc.
    expect(within(tile("Heat")).queryByRole("img", { name: "On disc" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/and films and series out on disc that no service streams/),
    ).toBeInTheDocument();
  });

  it("shows only titles out on disc when it's picked alone - series too, with Films off", async () => {
    const user = userEvent.setup();
    renderApp(<WhatsOnPage />, { mocks: whatsOnMocks, route: "/whats-on" });
    await screen.findByText("Paper Lanterns");

    await user.click(within(services()).getByRole("button", { name: "Clear All" }));
    await user.click(within(services()).getByRole("button", { name: "On disc" }));
    await waitFor(() => expect(screen.queryByText("Heat")).not.toBeInTheDocument());
    expect(screen.getByText("Paper Lanterns")).toBeInTheDocument();
    expect(screen.getByText(/owning a copy is the way to watch them/)).toBeInTheDocument();

    expect(screen.getByText("Lighthouse Keepers")).toBeInTheDocument();
    expect(
      within(tile("Lighthouse Keepers")).getByRole("img", { name: "On disc" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Films", pressed: true }));
    await waitFor(() => expect(screen.queryByText("Paper Lanterns")).not.toBeInTheDocument());
    expect(screen.getByText("Lighthouse Keepers")).toBeInTheDocument();
    expect(
      screen.getByText(/^Series out on DVD or Blu-ray that no service streams/),
    ).toBeInTheDocument();
  });
});

const hit = (id: string, title: string, onDisc: boolean, availableOn: (typeof netflix)[] = []) => ({
  ...film(id, title, availableOn),
  onDisc,
});

const searchMocks = [
  ...whatsOnMocks,
  // Selected, On disc alone: no services, disc-only titles kept.
  {
    request: {
      query: SearchMyServicesDocument,
      variables: { query: "lanterns", providerSlugs: [], onDisc: true },
    },
    result: { data: { searchMedia: [hit("movie:2", "Paper Lanterns", true)] } },
  },
  // Selected, every service and On disc: nothing matches.
  {
    request: {
      query: SearchMyServicesDocument,
      variables: { query: "toonami", providerSlugs: ["hulu", "netflix"], onDisc: true },
    },
    result: { data: { searchMedia: [] } },
  },
  {
    request: { query: SearchEverywhereDocument, variables: { query: "toonami" } },
    result: {
      data: {
        searchMedia: [
          hit("movie:8", "Toonami: The Movie", true),
          hit("movie:9", "Toonami Rewind", false),
        ],
      },
    },
  },
];

const searchBox = () => screen.getByRole("searchbox", { name: "Search titles" });
const selectedOnly = () => screen.getByRole("switch", { name: "Search only what's selected" });

describe("What's On: the watchlist box with On disc", () => {
  it("leaves the watchlist box out when On disc is all that's picked", async () => {
    const user = userEvent.setup();
    library.shelve(
      { id: "tv:1", kind: "Series", title: "The Quiet Harbor", posterUrl: null },
      "watchlist",
    );
    renderApp(<WhatsOnPage />, { mocks: whatsOnMocks, route: "/whats-on" });
    await screen.findByText("Paper Lanterns");
    // Services and On disc together: still partly streaming, so it stays.
    expect(await screen.findByRole("heading", { name: "Your watchlist" })).toBeInTheDocument();

    await user.click(within(services()).getByRole("button", { name: "Clear All" }));
    await user.click(within(services()).getByRole("button", { name: "On disc" }));
    await screen.findByText(/owning a copy is the way to watch them/);
    expect(screen.queryByRole("heading", { name: "Your watchlist" })).not.toBeInTheDocument();
  });
});

describe("What's On: search, Selected or Everywhere", () => {
  it("searches titles out on disc when On disc is selected", async () => {
    const user = userEvent.setup();
    renderApp(<WhatsOnPage />, { mocks: searchMocks, route: "/whats-on" });
    await screen.findByText("Paper Lanterns");
    await user.click(within(services()).getByRole("button", { name: "Clear All" }));
    await user.click(within(services()).getByRole("button", { name: "On disc" }));

    await user.type(searchBox(), "lanterns");
    expect(await screen.findByText(/1 result for “lanterns” on disc/)).toBeInTheDocument();
    expect(
      within(tile("Paper Lanterns")).getByRole("img", { name: "On disc" }),
    ).toBeInTheDocument();
  });

  it("offers Everywhere when Selected finds nothing, and remembers the choice", async () => {
    const user = userEvent.setup();
    renderApp(<WhatsOnPage />, { mocks: searchMocks, route: "/whats-on" });
    await screen.findByText("Paper Lanterns");
    expect(selectedOnly()).toBeChecked();

    await user.type(searchBox(), "toonami");
    await user.click(await screen.findByRole("button", { name: "Search everywhere instead" }));

    expect(await screen.findByText(/2 results for “toonami” everywhere/)).toBeInTheDocument();
    expect(selectedOnly()).not.toBeChecked();
    // Where each can be watched: a disc, or nowhere at all.
    expect(
      within(tile("Toonami: The Movie")).getByRole("img", { name: "On disc" }),
    ).toBeInTheDocument();
    expect(within(tile("Toonami Rewind")).getByText("Not streaming")).toBeInTheDocument();
    expect(window.localStorage.getItem("stream-scheduler:search-scope")).toBe("everywhere");
  });
});

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const media = (id: string, title: string, typename: "Movie" | "Series") => ({
  __typename: typename,
  id,
  title,
  onDisc: true,
  overview: null,
  posterUrl: null,
  backdropUrl: null,
  trailer: null,
  score: null,
  releaseYear: null,
  ...(typename === "Movie" ? { runtimeMinutes: 101 } : { seasonCount: 2 }),
});

const feedMocks = [
  {
    request: { query: ReleaseFeedDocument, variables: { first: 150, timezone } },
    result: {
      data: {
        releases: [
          {
            __typename: "Release",
            id: "release:netflix:tv:1",
            availableFrom: "2026-10-04",
            daysUntilRelease: 3,
            seasonNumber: 2,
            bingeableFrom: "2026-10-04",
            isFullDrop: true,
            episodeCount: 8,
            watchTimeMinutes: 400,
            provider: netflix,
            media: media("tv:1", "The Quiet Harbor", "Series"),
          },
          {
            __typename: "Release",
            id: "release:netflix:movie:3",
            availableFrom: "2026-11-20",
            daysUntilRelease: 50,
            seasonNumber: null,
            bingeableFrom: "2026-11-20",
            isFullDrop: true,
            episodeCount: null,
            watchTimeMinutes: 110,
            provider: netflix,
            media: media("movie:3", "Late Film", "Movie"),
          },
        ],
      },
    },
  },
];

function Feed({ slugs }: { slugs: string[] }) {
  return <ReleaseFeed slugs={slugs} kinds={["SERIES", "MOVIE"]} ready filters={null} />;
}

describe("Coming Soon: services only", () => {
  it("filters every arrival when the search covers more than what's selected", async () => {
    const user = userEvent.setup();
    // Selected: Max only, which has nothing in this feed.
    renderApp(<Feed slugs={["max"]} />, { mocks: feedMocks });
    await user.type(screen.getByRole("searchbox", { name: "Filter by title" }), "the");
    await user.click(await screen.findByRole("button", { name: "Search everywhere instead" }));

    expect(await screen.findByText("The Quiet Harbor")).toBeInTheDocument();
    expect(screen.getByText(/1 match for “the” everywhere/)).toBeInTheDocument();
  });

  it("asks for a service when none is picked - On disc doesn't count here", async () => {
    renderApp(<Feed slugs={[]} />, { mocks: feedMocks });
    expect(
      await screen.findByText(/^Pick a service to see what's coming to it\./),
    ).toBeInTheDocument();
  });
});
