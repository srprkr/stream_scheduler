import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

import { typeDefs } from "./schema.js"
import { createContext, startFeedRefresher, type Context } from "./context.js";
import { resolvers } from "./resolvers/index.js";

const server = new ApolloServer<Context>({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: createContext,
});

console.log(`ready at ${url}`);
startFeedRefresher();
