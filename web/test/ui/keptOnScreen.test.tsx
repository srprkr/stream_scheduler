// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Shelf } from "../../src/components/Shelf";
import { library, useLibrary } from "../../src/hooks/useLibrary";
import { renderApp } from "./render";

const heat = { id: "movie:949", kind: "Movie" as const, title: "Heat", posterUrl: null };
const ronin = { id: "movie:8195", kind: "Movie" as const, title: "Ronin", posterUrl: null };

/** The library's two shelves, as Home shows them. */
function Shelves() {
  const entries = useLibrary();
  const on = (shelf: string) => entries.filter((e) => e.shelf === shelf);
  return (
    <>
      <Shelf title="Owned" entries={on("owned")} details={new Map()} onOpen={() => {}} />
      <Shelf title="Wishlist" entries={on("wanted")} details={new Map()} onOpen={() => {}} />
    </>
  );
}

const shelf = (title: string) =>
  screen.getByRole("heading", { name: new RegExp(`^${title}`) }).closest("section") as HTMLElement;
const tile = (within_: HTMLElement, title: string) =>
  within(within_).getByRole("button", { name: title }).closest("li") as HTMLElement;

describe("A tile taken off its shelf", () => {
  it("stays where it was, greyed and labelled, and says so aloud", async () => {
    const user = userEvent.setup();
    library.reload();
    library.shelve(heat, "owned");
    library.shelve(ronin, "owned");
    renderApp(<Shelves />);

    const order = () =>
      within(shelf("Owned"))
        .getAllByRole("listitem")
        .map((li) =>
          within(li)
            .getByRole("button", { name: /^(Heat|Ronin)$/ })
            .getAttribute("aria-label"),
        );
    const before = order();

    await user.click(screen.getByRole("button", { name: "I own Heat" }));

    const heatTile = tile(shelf("Owned"), "Heat");
    expect(heatTile).toHaveClass("shelf__item--removed");
    expect(within(heatTile).getByText("Removed")).toBeInTheDocument();
    expect(within(heatTile).getByRole("status")).toHaveTextContent("Heat: removed");
    // Still in its place; the count is what's really owned.
    expect(order()).toEqual(before);
    expect(within(shelf("Owned")).getByText("1")).toBeInTheDocument();
  });

  it("goes back with its own toggle - the undo is the button that did it", async () => {
    const user = userEvent.setup();
    library.reload();
    library.shelve(heat, "owned");
    renderApp(<Shelves />);

    await user.click(screen.getByRole("button", { name: "I own Heat" }));
    await user.click(screen.getByRole("button", { name: "I own Heat" }));

    const heatTile = tile(shelf("Owned"), "Heat");
    expect(heatTile).not.toHaveClass("shelf__item--removed");
    expect(library.entries().find((e) => e.id === heat.id)?.shelf).toBe("owned");
  });

  it("offers every shelf once removed, so a wishlisted title can be wanted again", async () => {
    const user = userEvent.setup();
    library.reload();
    library.shelve(heat, "wanted");
    renderApp(<Shelves />);

    // On the shelf, ★ is the way off the wishlist...
    await user.click(screen.getByRole("button", { name: "Want Heat" }));
    // ...and, removed, the tile still offers it to put it back.
    await user.click(screen.getByRole("button", { name: "Want Heat" }));
    expect(library.entries().find((e) => e.id === heat.id)?.shelf).toBe("wanted");
  });

  it("says where a title went when it moved shelves", async () => {
    const user = userEvent.setup();
    library.reload();
    library.shelve(heat, "wanted");
    renderApp(<Shelves />);

    await user.click(screen.getByRole("button", { name: "I own Heat" }));
    // Left behind on the wishlist, labelled; and on the owned shelf for real.
    expect(within(tile(shelf("Wishlist"), "Heat")).getByText("Now owned")).toBeInTheDocument();
    expect(tile(shelf("Owned"), "Heat")).not.toHaveClass("shelf__item--removed");
  });
});
