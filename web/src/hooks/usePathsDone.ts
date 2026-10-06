import { useStored } from "./useStored";

/** Where the Paths forward ticks are kept. */
export const PATHS_DONE_KEY = "stream-scheduler:paths-done";

/** Saved ticks back as a list, or undefined if what's saved isn't one. */
export function parseKeyList(saved: string): string[] | undefined {
  try {
    const keys = JSON.parse(saved) as unknown;
    return Array.isArray(keys) && keys.every((k) => typeof k === "string") ? keys : undefined;
  } catch {
    return undefined;
  }
}

/** The Paths forward steps ticked off, kept in this browser. */
export function usePathsDone() {
  return useStored<string[]>(PATHS_DONE_KEY, [], parseKeyList, (keys) => JSON.stringify(keys));
}
