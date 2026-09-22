import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../schema/schema.graphql",
  documents: ["src/**/*.ts", "src/**/*.tsx"],
  ignoreNoDocuments: true,
  generates: {
    "src/generated/": {
      preset: "client",
      config: {
        scalars: { Date: "string", URL: "string" },
        enumsAsTypes: true,
        useTypeImports: true,
      },
    },
  },
};

export default config;
