import { useState } from "react";

/**
 * A yes/no remembered in this browser, for a per-user setting such as whether
 * a panel is open. The same shape as useStoredNumber.
 */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? fallback : saved === "true";
    } catch {
      return fallback;
    }
  });

  const save = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Storage unavailable: the setting lasts until the page closes.
    }
  };

  return [value, save];
}
