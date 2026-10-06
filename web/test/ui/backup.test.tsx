// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Backup } from "../../src/components/Backup";
import { BackupTitlesDocument } from "../../src/generated/graphql";
import { library } from "../../src/hooks/useLibrary";
import { subscriptions } from "../../src/hooks/useSubscriptions";
import { LIBRARY_KEY } from "../../src/lib/library";
import { SUBSCRIPTIONS_KEY } from "../../src/lib/subscriptions";
import { renderApp } from "./render";

const savedLibrary = {
  version: 1,
  entries: [
    {
      id: "tv:84773",
      kind: "Series",
      title: "The Rings of Power",
      posterUrl: "rop.jpg",
      shelf: "watchlist",
      addedAt: "2026-09-30T12:00:00.000Z",
    },
  ],
};
const savedSubscriptions = {
  version: 2,
  subscriptions: [
    {
      slug: "peacock",
      choice: { planId: "premium" },
      billing: { cycle: "annual", renewsOn: "2027-03-02", cents: 13999 },
    },
  ],
};

// On restore, titles come back from the server: the backup leaves them out.
const mocks = [
  {
    request: { query: BackupTitlesDocument, variables: { ids: ["tv:84773"] } },
    result: {
      data: {
        mediaItems: [
          {
            __typename: "Series" as const,
            id: "tv:84773",
            title: "The Rings of Power",
            posterUrl: "rop.jpg",
          },
        ],
      },
    },
  },
];

function fillBrowser() {
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(savedLibrary));
  window.localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(savedSubscriptions));
  window.localStorage.setItem("stream-scheduler:hours-per-month", "35");
}

describe("Backup", () => {
  it("copies a backup, then restores it into an emptied browser", async () => {
    const user = userEvent.setup();
    fillBrowser();
    const first = renderApp(<Backup />, { mocks });

    await user.click(screen.getByRole("button", { name: "Copy as text" }));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    const text = await navigator.clipboard.readText();
    first.unmount();

    // A new device: nothing saved.
    window.localStorage.clear();
    renderApp(<Backup />, { mocks });
    expect(library.entries()).toEqual([]);

    await user.click(screen.getByLabelText("Or paste the text"));
    await user.paste(text);
    await user.click(screen.getByRole("button", { name: "Read pasted backup" }));
    expect(
      screen.getByText(/1 title \(0 owned, 0 on your wishlist, 1 on your watchlist\) · 1 service/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Replace everything here" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/^Restored: 1 title/);
    expect(library.entries().map((e) => [e.id, e.shelf, e.title, e.posterUrl])).toEqual([
      ["tv:84773", "watchlist", "The Rings of Power", "rop.jpg"],
    ]);
    expect(subscriptions.subscriptions()).toEqual(savedSubscriptions.subscriptions);
    expect(window.localStorage.getItem("stream-scheduler:hours-per-month")).toBe("35");
  });

  it("says why a damaged paste can't be read, and imports nothing", async () => {
    const user = userEvent.setup();
    renderApp(<Backup />, { mocks });

    await user.click(screen.getByLabelText("Or paste the text"));
    await user.paste('{"app":"streamhopper","v":1,"at":"2026-10-06","lib":[["tv:1","?","S"');
    await user.click(screen.getByRole("button", { name: "Read pasted backup" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Was all of it copied?");
    expect(screen.queryByRole("button", { name: /Replace everything/ })).not.toBeInTheDocument();
  });

  it("records when the last backup was made", async () => {
    const user = userEvent.setup();
    fillBrowser();
    renderApp(<Backup />, { mocks });
    expect(screen.getByText(/Last backed up: never/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy as text" }));

    expect(screen.queryByText(/Last backed up: never/)).not.toBeInTheDocument();
  });

  it("says nothing about size for an ordinary library", () => {
    fillBrowser();
    renderApp(<Backup />, { mocks });
    expect(screen.queryByText(/too long for some password managers/)).not.toBeInTheDocument();
  });

  it("warns when the backup is too long for a password manager's notes", () => {
    window.localStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify({
        version: 1,
        entries: Array.from({ length: 250 }, (_, i) => ({
          id: `tv:${1000000 + i}`,
          kind: "Series",
          title: `Show ${i}`,
          posterUrl: null,
          shelf: "owned",
          addedAt: "2026-09-30T12:00:00.000Z",
        })),
      }),
    );
    renderApp(<Backup />, { mocks });
    expect(screen.getByText(/too long for some password managers/)).toHaveTextContent(
      /Download the file and attach it/,
    );
  });
});
