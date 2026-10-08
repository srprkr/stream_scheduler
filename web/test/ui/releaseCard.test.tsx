// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReleaseCard } from "../../src/components/ReleaseCard";
import type { Release } from "../../src/lib/format";
import { renderApp } from "./render";

const netflix = {
  __typename: "Provider" as const,
  id: "provider:netflix",
  slug: "netflix",
  name: "Netflix",
  logoUrl: "netflix.png",
};

const release = {
  __typename: "Release",
  id: "release:netflix:media:1",
  availableFrom: "2026-10-04",
  daysUntilRelease: 3,
  seasonNumber: 2,
  bingeableFrom: "2026-10-04",
  isFullDrop: true,
  episodeCount: 8,
  watchTimeMinutes: 400,
  provider: netflix,
  media: {
    __typename: "Series",
    id: "media:1",
    title: "The Quiet Harbor",
    onDisc: false,
    overview: null,
    posterUrl: "poster.jpg",
    backdropUrl: null,
    trailer: null,
    seasonCount: 2,
  },
} as unknown as Release;

describe("Coming Soon card", () => {
  it("puts its service logos above the poster, as every other tile does", () => {
    renderApp(<ReleaseCard release={release} providers={[netflix]} onOpen={() => {}} />);
    const logo = screen.getByRole("img", { name: "Netflix" });
    const poster = screen.getByRole("button", { name: "The Quiet Harbor" });
    // The logo comes first in the page, so it sits above.
    expect(logo.compareDocumentPosition(poster) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(logo.closest(".shelf__services")).not.toBeNull();
  });

  it("shows the logos even when only one service is in view", () => {
    renderApp(<ReleaseCard release={release} providers={[netflix]} onOpen={() => {}} />);
    expect(screen.getByRole("img", { name: "Netflix" })).toBeInTheDocument();
  });
});
