import { GraphQLError } from "graphql";

/**
 * Catalogue cursors. Clients must treat them as opaque; today one wraps a
 * page number, and keeping it opaque is what lets that change (to an offset
 * into a stored list, say) without breaking anyone. base64url survives a URL
 * unescaped.
 */
export function encodeCursor(page: number): string {
  return Buffer.from(`page:${page}`).toString("base64url");
}

/** Null or absent means the first page. Anything unreadable is the caller's error. */
export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 1;
  const match = /^page:(\d+)$/.exec(Buffer.from(cursor, "base64url").toString("utf8"));
  const page = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(page) || page < 1) {
    throw new GraphQLError("Invalid cursor", { extensions: { code: "BAD_USER_INPUT" } });
  }
  return page;
}
