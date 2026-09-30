import { useState } from "react";

import { browserStorage } from "./browserStorage";

/**
 * A per-user setting remembered in this browser. Plain state plus a
 * write-through, unlike the library: one component owns each setting, so
 * there is no shared store to keep in step.
 *
 * `parse` turns the saved text back into a value, or undefined when it can't
 * - never saved, or saved by an older version - and the fallback is used.
 */
export function useStored<T>(
  key: string,
  fallback: T,
  parse: (saved: string) => T | undefined,
): [T, (value: T) => void] {
  const [value, setValue] = useState(() => {
    const saved = browserStorage().getItem(key);
    return (saved === null ? undefined : parse(saved)) ?? fallback;
  });

  const save = (next: T) => {
    setValue(next);
    try {
      browserStorage().setItem(key, String(next));
    } catch {
      // Quota exceeded: the setting lasts until the page closes.
    }
  };

  return [value, save];
}

/** A positive number, such as hours watched a month. */
export function useStoredNumber(key: string, fallback: number) {
  return useStored(key, fallback, (saved) => {
    const n = Number(saved);
    return n > 0 ? n : undefined;
  });
}

/** A yes/no, such as whether a panel is open. */
export function useStoredFlag(key: string, fallback: boolean) {
  return useStored(key, fallback, (saved) =>
    saved === "true" ? true : saved === "false" ? false : undefined,
  );
}
