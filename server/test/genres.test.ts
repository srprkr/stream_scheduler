import { describe, expect, it } from "vitest";

import { genreIds, genresOf } from "../src/genres.js";

describe("genres", () => {
  it("maps TMDB's two lists onto one: TV's merged genres and films' split ones meet", () => {
    // Film Action (28) and Adventure (12), TV Action & Adventure (10759): one genre.
    expect(genresOf("MOVIE", [12])).toEqual(["ACTION"]);
    expect(genresOf("SERIES", [10759])).toEqual(["ACTION"]);
    expect(genresOf("MOVIE", [878, 18])).toEqual(["DRAMA", "SCIFI"]);
    // A thriller counts as mystery & thriller.
    expect(genresOf("MOVIE", [53])).toEqual(["MYSTERY"]);
  });

  it("gives no ids for a genre a kind doesn't have", () => {
    expect(genreIds("SERIES", "HORROR")).toEqual([]);
    expect(genreIds("MOVIE", "REALITY")).toEqual([]);
    expect(genreIds("SERIES", "FAMILY")).toEqual([10751, 10762]);
  });

  it("ignores TMDB genres outside the app's list, like TV Movie or News", () => {
    expect(genresOf("MOVIE", [10770])).toEqual([]);
    expect(genresOf("SERIES", [10763])).toEqual([]);
  });
});
