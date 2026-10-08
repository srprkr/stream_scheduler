// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { FilterInput } from "../../src/components/FilterInput";
import { SearchBox } from "../../src/components/SearchBox";
import { renderApp } from "./render";

function Filter() {
  const [text, setText] = useState("");
  return <FilterInput value={text} onChange={setText} label="Filter by title" />;
}

describe("The search boxes' × pill", () => {
  it("appears once there's text, clears the box, focuses it, and goes away", async () => {
    const user = userEvent.setup();
    renderApp(<Filter />);
    const box = screen.getByRole("searchbox", { name: "Filter by title" });
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    await user.type(box, "heat");
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("goes away when the text is deleted by hand, too", async () => {
    const user = userEvent.setup();
    renderApp(<Filter />);
    const box = screen.getByRole("searchbox", { name: "Filter by title" });
    await user.type(box, "a");
    await user.type(box, "{Backspace}");
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("clears Home's search the same way", async () => {
    const user = userEvent.setup();
    renderApp(<SearchBox />);
    const box = screen.getByRole("combobox", { name: "Search films and series" });
    await user.type(box, "x");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
  });
});
