// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ReleaseFeed } from "../../src/components/ReleaseFeed";
import {
  CatalogDocument,
  DiscCatalogDocument,
  DiscReleasesDocument,
  ReleaseFeedDocument,
  SearchEverywhereDocument,
  SearchMyServicesDocument,
} from "../../src/generated/graphql";
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
      variables: { providerSlugs: ["hulu", "netflix"], kind: "MOVIE", sort: "POPULAR" },
    },
    result: { data: { catalog: page([film("movie:1", "Heat", [netflix])]) } },
  },
  {
    request: {
      query: CatalogDocument,
      variables: { providerSlugs: ["hulu", "netflix"], kind: "SERIES", sort: "POPULAR" },
    },
    result: { data: { catalog: page([]) } },
  },
  {
    request: { query: DiscCatalogDocument, variables: { sort: "POPULAR" } },
    result: { data: { discCatalog: page([film("movie:2", "Paper Lanterns")]) } },
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
    expect(
      within(tile("Paper Lanterns")).getByRole("img", { name: "On disc" }),
    ).toBeInTheDocument();
    // Heat is listed for Netflix, not for its disc.
    expect(within(tile("Heat")).queryByRole("img", { name: "On disc" })).not.toBeInTheDocument();
    expect(screen.getByText(/and films out on disc that no service streams/)).toBeInTheDocument();
  });

  it("shows only films out on disc when it's picked alone, and asks for Films if they're off", async () => {
    const user = userEvent.setup();
    renderApp(<WhatsOnPage />, { mocks: whatsOnMocks, route: "/whats-on" });
    await screen.findByText("Paper Lanterns");

    await user.click(within(services()).getByRole("button", { name: "Clear All" }));
    await user.click(within(services()).getByRole("button", { name: "On disc" }));
    await waitFor(() => expect(screen.queryByText("Heat")).not.toBeInTheDocument());
    expect(screen.getByText("Paper Lanterns")).toBeInTheDocument();
    expect(screen.getByText(/owning a copy is the way to watch them/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Films", pressed: true }));
    expect(await screen.findByText(/On disc lists films only/)).toBeInTheDocument();
    expect(screen.queryByText("Paper Lanterns")).not.toBeInTheDocument();
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
  {
    request: { query: DiscReleasesDocument, variables: { timezone } },
    result: {
      data: {
        discReleases: [
          {
            __typename: "DiscRelease",
            id: "disc:movie:2",
            availableFrom: "2026-10-21",
            daysUntilRelease: 20,
            media: media("movie:2", "The Long Weekend", "Movie"),
          },
        ],
      },
    },
  },
];

function Feed({ disc }: { disc: boolean }) {
  return (
    <ReleaseFeed slugs={["netflix"]} disc={disc} kinds={["SERIES", "MOVIE"]} ready filters={null} />
  );
}

describe("Coming Soon: On disc", () => {
  it("lists a film coming out on disc in date order, marked and badged On disc", async () => {
    renderApp(<Feed disc />, { mocks: feedMocks });
    // Two queries, landing in either order: wait for a title from each.
    await screen.findByText("The Long Weekend");
    await screen.findByText("Late Film");
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(["The Quiet Harbor", "The Long Weekend", "Late Film"]);

    const card = tile("The Long Weekend");
    expect(within(card).getByRole("img", { name: "On disc" })).toBeInTheDocument();
    expect(within(card).getByText("On disc", { selector: ".badge" })).toBeInTheDocument();
  });

  it("says in its dialog that it's coming out on disc, not on a service", async () => {
    const user = userEvent.setup();
    renderApp(<Feed disc />, { mocks: feedMocks });
    await user.click(await screen.findByRole("button", { name: "The Long Weekend" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Out on disc")).toBeInTheDocument();
    expect(within(dialog).getByText("DVD or Blu-ray")).toBeInTheDocument();
    expect(within(dialog).queryByText("Service")).not.toBeInTheDocument();
  });

  it("filters every arrival when set to Everywhere, past the selected services and On disc", async () => {
    const user = userEvent.setup();
    // Selected: Max only, which has nothing in this feed.
    renderApp(
      <ReleaseFeed slugs={["max"]} disc={false} kinds={["SERIES", "MOVIE"]} ready filters={null} />,
      { mocks: feedMocks },
    );
    await user.type(screen.getByRole("searchbox", { name: "Filter by title" }), "the");
    await user.click(await screen.findByRole("button", { name: "Search everywhere instead" }));

    expect(await screen.findByText("The Long Weekend")).toBeInTheDocument();
    expect(screen.getByText("The Quiet Harbor")).toBeInTheDocument();
    expect(screen.getByText(/2 matches for “the” everywhere/)).toBeInTheDocument();
  });

  it("leaves disc releases out when On disc isn't picked", async () => {
    renderApp(<Feed disc={false} />, { mocks: feedMocks });
    await screen.findByText("The Quiet Harbor");
    expect(screen.queryByText("The Long Weekend")).not.toBeInTheDocument();
  });
});
