import { useState } from "react";

import { SearchBox } from "./SearchBox";
import { Shelf } from "./Shelf";
import { TitleDialog } from "./TitleDialog";
import { useLibrary } from "./useLibrary";

export function HomePage() {
  const entries = useLibrary();
  const [openId, setOpenId] = useState<string | null>(null);

  const owned = entries.filter((e) => e.shelf === "owned");
  const wanted = entries.filter((e) => e.shelf === "wanted");

  return (
    <>
      <header className="masthead">
        {entries.length === 0 ? (
          <>
            <h1>What do you own on DVD or Blu-ray?</h1>
            <p>
              Search for the films and series on your shelf and tick them as
              you go. Anything you'd like to own can go on your wishlist.
            </p>
          </>
        ) : (
          <>
            <h1>Your library</h1>
            <p>
              {owned.length} owned · {wanted.length} on your wishlist
            </p>
          </>
        )}
      </header>

      <SearchBox />

      <Shelf title="Owned" entries={owned} onOpen={setOpenId} />
      <Shelf title="Wishlist" entries={wanted} onOpen={setOpenId} />

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
