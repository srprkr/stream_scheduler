import { useState } from "react";

/**
 * A number remembered in this browser, for a per-user setting. Plain state
 * plus a write-through, unlike the library: one component owns it, so there
 * is no shared store to keep in step.
 */
export function useStoredNumber(
  key: string,
  fallback: number,
): [number, (value: number) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return saved > 0 ? saved : fallback;
    } catch {
      return fallback;
    }
  });

  const save = (next: number) => {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Storage unavailable: the setting lasts until the page closes.
    }
  };

  return [value, save];
}
