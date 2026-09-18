import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

import { typeDefs } from "./schema.js"
import { createContext, type Context } from "./context.js";
import type { Resolvers } from "./generated/graphql.js";

const resolvers: Resolvers = {
  Query: {
    releases: (_parent, args, ctx) => 
      ctx.source.listReleases({
        providerSlug: args.providerSlug ?? undefined,
        from: args.from ?? undefined,
        to: args.to ?? undefined,
        first: args.first ?? 20,
      }),
  },
};

const server = new ApolloServer<Context>({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: createContext,
});

console.log(`ready at ${url}`);