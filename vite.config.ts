/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/rails": {
        // Active Storage serves organisation logos via its blob-proxy route.
        // The API returns that route as a relative path, so the SPA's origin
        // must forward it to the API — same trick as "/api", and for the same
        // reason: the browser talks to Vite and Vite forwards local HTTP
        // requests to Rails.
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
