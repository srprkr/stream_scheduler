import { readFileSync } from "node:fs";

/**
 * The SDL lives at repo root, not server. It's a contract between server and web.
 */

export const typeDefs = readFileSync(
  new URL("../../schema/schema.graphql", import.meta.url),
  "utf8",
)