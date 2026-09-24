import { useEffect, useState } from "react";

/**
 * `value`, but only once it has stopped changing for `ms`. The input stays
 * instant; only what is sent to the server waits.
 */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}
