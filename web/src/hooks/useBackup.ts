import { backupDue } from "../lib/backup";
import { localToday } from "../lib/seasons";
import { useLibrary } from "./useLibrary";
import { useStored } from "./useStored";

export const LAST_BACKUP_KEY = "stream-scheduler:last-backup";

/**
 * When the user last saved a backup, and whether it's time for another:
 * the library has changed since, and two weeks have passed - or there has
 * never been one and the library has something worth keeping.
 */
export function useBackupStatus() {
  const entries = useLibrary();
  const [lastBackup, setLastBackup] = useStored<string | null>(LAST_BACKUP_KEY, null, (saved) =>
    /^\d{4}-\d{2}-\d{2}$/.test(saved) ? saved : undefined,
  );
  const lastChange = entries.reduce<string | null>((latest, e) => {
    const day = e.addedAt.slice(0, 10);
    return latest === null || day > latest ? day : latest;
  }, null);
  const today = localToday();
  return {
    lastBackup,
    due: backupDue(lastBackup, lastChange, entries.length, today),
    markBackedUp: () => setLastBackup(today),
  };
}
