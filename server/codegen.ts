import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../schema/schema.graphql",
  generates: {
    "src/generated/graphql.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "../context.js#Context",

        mappers: {
          Release: "../sources/types.js#ReleaseRecord",
          Provider: "../sources/types.js#ProviderRecord",
          MediaItem: "../sources/types.js#MediaRecord",
          Movie: "../sources/types.js#MediaRecord",
          Series: "../sources/types.js#MediaRecord",
          Video: "../sources/types.js#VideoRecord",
        },

        scalars: { Date: "string", URL: "string" },

        useIndexSignature: true,
        useTypeImports: true,
        enumsAsTypes: true,
      },
    },
  },
};

export default config;