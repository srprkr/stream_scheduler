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
          DiscRelease: "../sources/types.js#DiscReleaseRecord",
          Provider: "../sources/types.js#ProviderRecord",
          OtherService: "../sources/types.js#OtherServiceRecord",
          MediaItem: "../sources/types.js#MediaRecord",
          Movie: "../sources/types.js#MediaRecord",
          Series: "../sources/types.js#MediaRecord",
          Video: "../sources/types.js#VideoRecord",
          SeasonSchedule: "../sources/types.js#SeasonScheduleRecord",
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
