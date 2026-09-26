import { describe, expect, it } from "vitest";

import { replacementSummary } from "../src/replaces";

const peacock = { slug: "peacock", name: "Peacock" };
const netflix = { slug: "netflix", name: "Netflix" };
const hbomax = { slug: "hbomax", name: "HBO Max" };

describe("replacementSummary", () => {
  it("counts owned titles per service, most first", () => {
    const { services } = replacementSummary([[peacock], [netflix], [peacock]]);
    expect(services.map((s) => [s.provider.slug, s.titles])).toEqual([
      ["peacock", 2],
      ["netflix", 1],
    ]);
  });

  it("counts a title on two services toward both", () => {
    const { services } = replacementSummary([[netflix, hbomax]]);
    expect(services.map((s) => s.titles)).toEqual([1, 1]);
  });

  it("breaks ties by name, so the order is stable", () => {
    const { services } = replacementSummary([[peacock], [hbomax], [netflix]]);
    expect(services.map((s) => s.provider.name)).toEqual(["HBO Max", "Netflix", "Peacock"]);
  });

  it("counts titles streaming nowhere separately", () => {
    expect(replacementSummary([[], [peacock], []]).unhosted).toBe(2);
  });
});
