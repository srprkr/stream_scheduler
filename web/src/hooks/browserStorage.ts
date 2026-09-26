/**
 * The browser's localStorage, or an in-memory stand-in when it cannot be
 * used: some privacy modes throw on the mere access. Shared by every store
 * that persists to the browser.
 */
export function browserStorage(): Pick<Storage, "getItem" | "setItem"> {
  try {
    return window.localStorage;
  } catch {
    const data = new Map<string, string>();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
  }
}
