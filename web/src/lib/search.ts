/** Lower-case, accents stripped, spacing collapsed: how titles are compared. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether a title matches what the user typed, for filtering a list already
 * on screen. Every word typed must appear somewhere in the title, in any
 * order, so "office the" finds The Office and "pokemon" finds Pokémon.
 */
export function matchesTitle(title: string, query: string): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const folded = fold(title);
  return words.every((word) => folded.includes(word));
}
