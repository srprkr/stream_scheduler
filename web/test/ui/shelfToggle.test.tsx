// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ShelfToggle } from "../../src/components/ShelfToggle";
import { library } from "../../src/hooks/useLibrary";
import { renderApp } from "./render";

const heat = { id: "movie:949", kind: "Movie" as const, title: "Heat", posterUrl: null };
const shelfOf = (id: string) => library.entries().find((e) => e.id === id)?.shelf ?? null;

describe("Own / Want / Watchlist", () => {
  it("puts a title on one shelf at a time", async () => {
    const user = userEvent.setup();
    renderApp(<ShelfToggle item={heat} />);

    await user.click(screen.getByRole("checkbox", { name: "I own Heat" }));
    expect(shelfOf("movie:949")).toBe("owned");

    await user.click(screen.getByRole("button", { name: "Want Heat" }));
    expect(shelfOf("movie:949")).toBe("wanted");
    expect(screen.getByRole("checkbox", { name: "I own Heat" })).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Add Heat to your watchlist" }));
    expect(shelfOf("movie:949")).toBe("watchlist");
    expect(screen.getByRole("button", { name: "Want Heat" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("takes a title off its shelf when its toggle is pressed again", async () => {
    const user = userEvent.setup();
    renderApp(<ShelfToggle item={heat} />);
    const want = screen.getByRole("button", { name: "Want Heat" });
    await user.click(want);
    await user.click(want);
    expect(shelfOf("movie:949")).toBeNull();
  });

  it("offers only the watchlist for a streaming-only title", () => {
    renderApp(<ShelfToggle item={heat} ownable={false} />);
    expect(screen.queryByRole("checkbox", { name: "I own Heat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Heat to your watchlist" })).toBeInTheDocument();
  });

  it("on a library shelf, shows Own only - and the star while wanted", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp(<ShelfToggle item={heat} inLibrary />);
    expect(screen.queryByRole("button", { name: "Want Heat" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Heat to your watchlist" }),
    ).not.toBeInTheDocument();
    unmount();

    library.shelve(heat, "wanted");
    renderApp(<ShelfToggle item={heat} inLibrary />);
    await user.click(screen.getByRole("button", { name: "Want Heat" }));
    expect(shelfOf("movie:949")).toBeNull();
  });
});
