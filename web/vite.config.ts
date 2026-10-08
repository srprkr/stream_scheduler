import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Logic tests run on plain Node; UI tests opt into a browser-like DOM
    // with a `// @vitest-environment jsdom` line at the top of the file.
    setupFiles: ["./test/setup.ts"],
    // Browser tests run under Playwright (npm run e2e), not Vitest.
    exclude: ["e2e/**", "node_modules/**"],
  },
  server: {
    port: 5173,
    // The client calls a same-origin /graphql, exactly as it would in
    // production. The proxy points that at the dev server, which sidesteps
    // CORS entirely rather than configuring it away.
    proxy: {
      "/graphql": {
        // API_PORT points a second web server at a second API - the browser
        // tests run both beside the dev pair.
        target: `http://localhost:${process.env.API_PORT ?? 4000}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/graphql/, ""),
      },
    },
  },
});
