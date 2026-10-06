import { useEffect, useState } from "react";

import { browserStorage } from "./browserStorage";

/**
 * Tells every component using a setting when one of them changes it, so the
 * Settings page, Home's hours box and the plan's prices all move together.
 * The detail is the new value itself, which also covers a browser where
 * storage is unavailable and nothing could be re-read.
 */
const changes = new EventTarget();

/**
 * A per-user setting remembered in this browser: plain state plus a
 * write-through, kept in step across every component that uses the same
 * key - and across tabs, through the browser's storage event.
 *
 * `parse` turns the saved text back into a value, or undefined when it can't
 * - never saved, or saved by an older version - and the fallback is used.
 * `serialize` turns a value into text; plain String() unless it's an object.
 */
export function useStored<T>(
  key: string,
  fallback: T,
  parse: (saved: string) => T | undefined,
  serialize: (value: T) => string = String,
): [T, (value: T) => void] {
  const read = () => {
    const saved = browserStorage().getItem(key);
    return (saved === null ? undefined : parse(saved)) ?? fallback;
  };
  const [value, setValue] = useState(read);

  useEffect(() => {
    const here = (e: Event) => setValue((e as CustomEvent<T>).detail);
    // Another tab saved it: read it back, through parse, like at start.
    const elsewhere = (e: StorageEvent) => {
      if (e.key === key || e.key === null) setValue(read());
    };
    changes.addEventListener(key, here);
    window.addEventListener("storage", elsewhere);
    return () => {
      changes.removeEventListener(key, here);
      window.removeEventListener("storage", elsewhere);
    };
    // read closes over parse and fallback, fixed per key in practice.
  }, [key]);

  const save = (next: T) => {
    try {
      browserStorage().setItem(key, serialize(next));
    } catch {
      // Quota exceeded: the setting lasts until the page closes.
    }
    changes.dispatchEvent(new CustomEvent(key, { detail: next }));
  };

  return [value, save];
}

/** A yes/no, such as whether a panel is open. */
export function useStoredFlag(key: string, fallback: boolean) {
  return useStored(key, fallback, (saved) =>
    saved === "true" ? true : saved === "false" ? false : undefined,
  );
}
