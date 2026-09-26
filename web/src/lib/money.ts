const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/**
 * Money is kept in whole cents and formatted only for display. Floats cannot
 * represent most prices exactly: 0.1 + 0.2 is 0.30000000000000004, and a
 * year of $15.49 months adds up drift like that twelve times.
 */
export function formatDollars(cents: number): string {
  return usd.format(cents / 100);
}

/** "15.49" or "$15.49" -> 1549. Empty -> null. Anything unreadable -> undefined. */
export function parseDollars(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/^\$/, "");
  if (trimmed === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return undefined;
  return Math.round(Number(trimmed) * 100);
}
