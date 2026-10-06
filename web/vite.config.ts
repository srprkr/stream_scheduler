import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Logic tests run on plain Node; UI tests opt into a browser-like DOM
    // with a `// @vitest-environment jsdom` line at the top of the file.
    setupFiles: ["./test/setup.ts"],
  },
  server: {
    port: 5173,
    // The client calls a same-origin /graphql, exactly as it would in
    // production. The proxy points that at the dev server, which sidesteps
    // CORS entirely rather than configuring it away.
    proxy: {
      "/graphql": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/graphql/, ""),
      },
    },
  },
});
