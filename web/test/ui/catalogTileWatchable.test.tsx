// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogTile } from "../../src/components/CatalogTile";
import { netflix } from "./mocks";
import { renderApp } from "./render";

const film = (
  availableOn: (typeof netflix)[] | undefined,
  comingTo: (typeof netflix)[] = [],
  otherServices: { id: string }[] = [],
) => ({
  __typename: "Movie" as const,
  id: "movie:1",
  title: "Heat",
  posterUrl: null,
  onDisc: true,
  availableOn,
  comingTo,
  otherServices,
});
const watchlistButton = () => screen.queryByRole("button", { name: "Add Heat to your watchlist" });

describe("A tile's watchlist toggle", () => {
  it("is there for a title a tracked service streams", () => {
    renderApp(<CatalogTile item={film([netflix])} onOpen={() => {}} />);
    expect(watchlistButton()).toBeInTheDocument();
  });

  it("is there for one a tracked service is getting", () => {
    renderApp(<CatalogTile item={film([], [netflix])} onOpen={() => {}} />);
    expect(watchlistButton()).toBeInTheDocument();
  });

  it("is there for one only an untracked service streams, which the plan covers too", () => {
    renderApp(<CatalogTile item={film([], [], [{ id: "other:starz" }])} onOpen={() => {}} />);
    expect(watchlistButton()).toBeInTheDocument();
  });

  it("is gone for a disc-only title", () => {
    renderApp(<CatalogTile item={film([])} onOpen={() => {}} />);
    expect(watchlistButton()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I own Heat" })).toBeInTheDocument();
  });

  it("stays while availability is still loading", () => {
    renderApp(<CatalogTile item={film(undefined)} onOpen={() => {}} />);
    expect(watchlistButton()).toBeInTheDocument();
  });
});
