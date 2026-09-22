import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
