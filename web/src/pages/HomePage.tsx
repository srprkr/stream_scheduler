import { useState } from "react";
import { Link } from "react-router";

import { SearchBox } from "../components/SearchBox";
import { Shelf } from "../components/Shelf";
import { TitleDialog } from "../components/TitleDialog";
import { LibraryStats } from "../components/LibraryStats";
import { LibraryReplaces } from "../components/LibraryReplaces";
import { useLibraryDetails, type LibraryDetail } from "../hooks/useLibraryDetails";
import { useBackupStatus } from "../hooks/useBackup";
import { useLibrary } from "../hooks/useLibrary";

export function HomePage() {
  const entries = useLibrary();
  const backup = useBackupStatus();
  const [openId, setOpenId] = useState<string | null>(null);

  const owned = entries.filter((e) => e.shelf === "owned");
  const wanted = entries.filter((e) => e.shelf === "wanted");

  // Home is about owning, so it only fetches details for owned and wanted
  // titles; watchlisted exclusives belong to the planning side.
  const details = useLibraryDetails(
    entries.filter((e) => e.shelf !== "watchlist").map((e) => e.id),
  );
  // Only owned titles whose details have arrived. A title ticked a moment ago
  // is left out until its details load, rather than counted as missing data.
  const ownedDetails = owned
    .map((e) => details.byId.get(e.id))
    .filter((d): d is LibraryDetail => d !== undefined);

  return (
    <>
      <div className="page-top">
        <header className="masthead">
          {owned.length + wanted.length === 0 ? (
            <>
              <h1>What do you own on DVD or Blu-ray?</h1>
              <p>
                Search for the films and series on your shelf and tick them as you go. Anything
                you'd like to own can go on your wishlist.
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

      {/* A gentle nudge, only when the library has changed since the last
          backup and a couple of weeks have passed. */}
      {backup.due && (
        <p className="backup-nudge">
          Your library has changed since your last backup.{" "}
          <Link to="/settings#backup">Save a backup</Link>
        </p>
      )}

      <LibraryReplaces
        owned={owned.flatMap((entry) => {
          const detail = details.byId.get(entry.id);
          return detail ? [{ title: entry.title, availableOn: detail.availableOn }] : [];
        })}
      />
      <SearchBox />

      <Shelf title="Owned" entries={owned} details={details.byId} onOpen={setOpenId} />
      <Shelf title="Wishlist" entries={wanted} details={details.byId} onOpen={setOpenId} />

      <TitleDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
