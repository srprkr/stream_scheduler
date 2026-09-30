import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../schema/schema.graphql",
  documents: ["src/**/*.ts", "src/**/*.tsx"],
  ignoreNoDocuments: true,
  generates: {
    "src/generated/": {
      preset: "client",
      // Results stay plain objects: a spread fragment's fields are read
      // directly, with no useFragment unwrapping (see src/lib/fragments.ts).
      presetConfig: { fragmentMasking: false },
      config: {
        scalars: { Date: "string", URL: "string" },
        enumsAsTypes: true,
        useTypeImports: true,
      },
    },
  },
};

export default config;
