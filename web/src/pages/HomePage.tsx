import { useState } from "react";

import { SearchBox } from "../components/SearchBox";
import { Shelf } from "../components/Shelf";
import { TitleDialog } from "../components/TitleDialog";
import { LibraryStats } from "../components/LibraryStats";
import { LibraryReplaces } from "../components/LibraryReplaces";
import { useLibraryDetails, type LibraryDetail } from "../hooks/useLibraryDetails";
import { useLibrary } from "../hooks/useLibrary";

export function HomePage() {
  const entries = useLibrary();
  const [openId, setOpenId] = useState<string | null>(null);

  const owned = entries.filter((e) => e.shelf === "owned");
  const wanted = entries.filter((e) => e.shelf === "wanted");

  const details = useLibraryDetails(entries.map((e) => e.id));
  // Only owned titles whose details have arrived. A title ticked a moment ago
  // is left out until its details load, rather than counted as missing data.
  const ownedDetails = owned
    .map((e) => details.byId.get(e.id))
    .filter((d): d is LibraryDetail => d !== undefined);


  return (
    <>
      <div className="home-top">
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
          <LibraryStats
            runtimes={ownedDetails.map((d) => d.totalRuntime)}
            loading={owned.length > 0 && details.loading}
          />

        </div>

      <SearchBox />
      <LibraryReplaces availability={ownedDetails.map((d) => d.availableOn)} />


      <Shelf title="Owned" entries={owned} details={details.byId} onOpen={setOpenId} />
      <Shelf title="Wishlist" entries={wanted} details={details.byId} onOpen={setOpenId} />

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
