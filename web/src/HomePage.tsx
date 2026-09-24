import { SearchBox } from "./SearchBox";

export function HomePage() {
  return (
    <>
      <header className="masthead">
        <h1>Own what you rewatch</h1>
        <p>
          Find the films and series you keep coming back to, and whether they
          stream anywhere at all.
        </p>
      </header>
      <SearchBox />
    </>
  );
}
