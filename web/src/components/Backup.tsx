import { useApolloClient } from "@apollo/client/react";
import { useState } from "react";

import { graphql } from "../generated";
import { useBackupStatus } from "../hooks/useBackup";
import { library } from "../hooks/useLibrary";
import { PATHS_DONE_KEY, parseKeyList } from "../hooks/usePathsDone";
import { writeStoredText } from "../hooks/useStored";
import { browserStorage } from "../hooks/browserStorage";
import { subscriptions } from "../hooks/useSubscriptions";
import {
  BACKUP_SETTINGS,
  describeBackup,
  LONG_BACKUP_CHARS,
  mergeLibrary,
  mergeSubscriptions,
  parseBackup,
  serializeBackup,
  type Backup as BackupData,
} from "../lib/backup";
import { downloadFile } from "../lib/download";
import { formatDate } from "../lib/format";
import { localToday } from "../lib/seasons";

/** Titles and posters for a restored library: the backup leaves them out. */
const BACKUP_TITLES = graphql(`
  query BackupTitles($ids: [ID!]!) {
    mediaItems(ids: $ids) {
      id
      title
      posterUrl(size: MEDIUM)
    }
  }
`);

const PREFIX = "stream-scheduler:";

/** Everything a backup carries, read from this browser now. */
function currentBackup(): Omit<BackupData, "exportedAt"> {
  const storage = browserStorage();
  const settings: BackupData["settings"] = {};
  for (const key of BACKUP_SETTINGS) {
    const saved = storage.getItem(PREFIX + key);
    if (saved !== null) settings[key] = saved;
  }
  const pathsDone = parseKeyList(storage.getItem(PATHS_DONE_KEY) ?? "[]") ?? [];
  return {
    library: library.entries().map((e) => ({
      id: e.id,
      kind: e.kind,
      shelf: e.shelf,
      addedAt: e.addedAt.slice(0, 10),
    })),
    subscriptions: [...subscriptions.subscriptions()],
    settings,
    pathsDone,
  };
}

/**
 * Backup and restore, on the Settings page. With no accounts, everything
 * lives in this browser - this is how it survives cleared site data or moves
 * to another device. Export as a file, or as text to keep in a password
 * manager's notes; restore from either, after a preview, replacing what's
 * here or merging with it. Nothing leaves the device unless the user takes
 * the file somewhere.
 */
export function Backup() {
  const client = useApolloClient();
  const { lastBackup, due, markBackedUp } = useBackupStatus();
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pending, setPending] = useState<BackupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const today = localToday();

  const text = () => serializeBackup(currentBackup(), today);
  // Only a long backup gets a word about size; most never see it.
  const length = text().length;

  const download = () => {
    downloadFile(`streamhopper-backup-${today}.json`, text(), "application/json");
    markBackedUp();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      markBackedUp();
    } catch {
      setError("Couldn't copy here - download the file instead.");
    }
  };

  const read = (raw: string) => {
    setStatus(null);
    const parsed = parseBackup(raw);
    if (parsed.ok) {
      setPending(parsed.backup);
      setError(null);
    } else {
      setPending(null);
      setError(parsed.error);
    }
  };

  const restore = async (mode: "replace" | "merge") => {
    if (!pending) return;
    setWorking(true);
    // Titles and posters for the backup's library, fetched in one request.
    // If that fails, titles show as ids until the details load elsewhere.
    const details = new Map<string, { title: string; posterUrl: string | null }>();
    const ids = pending.library.map((e) => e.id);
    if (ids.length > 0) {
      try {
        const { data } = await client.query({ query: BACKUP_TITLES, variables: { ids } });
        for (const item of data?.mediaItems ?? []) {
          if (item) details.set(item.id, { title: item.title, posterUrl: item.posterUrl ?? null });
        }
      } catch {
        // Carry on with what's known.
      }
    }

    library.replaceAll(mergeLibrary(library.entries(), pending.library, mode, details));
    subscriptions.replaceAll(
      mergeSubscriptions(subscriptions.subscriptions(), pending.subscriptions, mode),
    );
    // Settings: a replace takes the backup's; a merge only fills gaps.
    for (const key of BACKUP_SETTINGS) {
      const value = pending.settings[key];
      if (value === undefined) continue;
      if (mode === "replace" || browserStorage().getItem(PREFIX + key) === null) {
        writeStoredText(PREFIX + key, value);
      }
    }
    const done =
      mode === "replace"
        ? pending.pathsDone
        : [...new Set([...currentBackup().pathsDone, ...pending.pathsDone])];
    writeStoredText(PATHS_DONE_KEY, JSON.stringify(done));

    setStatus(
      `${mode === "replace" ? "Restored" : "Merged"}: ${describeBackup(pending)} from ${formatDate(pending.exportedAt, true)}.`,
    );
    setPending(null);
    setPasted("");
    setWorking(false);
  };

  return (
    <section id="backup" className="panel settings backup" aria-labelledby="settings-backup">
      <h2 id="settings-backup" className="panel__title">
        Backup
      </h2>
      <p className="panel__lede">
        Your library, services and settings live in this browser only. Save a backup to keep them
        safe if site data is cleared, or to move them to another device - a file, or text to keep in
        your password manager's notes.
      </p>
      <p className="backup__last">
        Last backed up: {lastBackup ? formatDate(lastBackup, true) : "never"}.
        {due && <strong> Your library has changed since - worth a fresh backup.</strong>}
      </p>
      {length > LONG_BACKUP_CHARS && (
        <p className="backup__long">
          Your backup is {length.toLocaleString()} characters - too long for some password managers'
          notes, which would cut it short. Download the file and attach it to the entry instead, or
          keep it in cloud storage.
        </p>
      )}
      <div className="backup__actions">
        <button type="button" className="button" onClick={download}>
          Download backup
        </button>
        <button type="button" className="button button--quiet" onClick={copy}>
          {copied ? "Copied" : "Copy as text"}
        </button>
      </div>

      <h3 className="backup__subtitle">Restore</h3>
      <label className="backup__field">
        From a backup file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) read(await file.text());
            e.target.value = "";
          }}
        />
      </label>
      <label className="backup__field">
        Or paste the text
        <textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} />
      </label>
      <button
        type="button"
        className="button button--quiet"
        disabled={pasted.trim() === ""}
        onClick={() => read(pasted)}
      >
        Read pasted backup
      </button>

      {error && (
        <p className="backup__error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="backup__preview">
          <p>
            This backup from {formatDate(pending.exportedAt, true)} has {describeBackup(pending)}.
          </p>
          <div className="backup__actions">
            <button
              type="button"
              className="button"
              disabled={working}
              onClick={() => restore("merge")}
            >
              Merge with what's here
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={working}
              onClick={() => restore("replace")}
            >
              Replace everything here
            </button>
            <button type="button" className="button button--quiet" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {status && (
        <p className="backup__status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
