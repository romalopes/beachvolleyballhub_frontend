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
    // Tests assert relative API URLs ("/api/v1/..."), the same default the
    // build uses behind the Vercel proxy. A developer's .env.local pointing at
    // http://localhost:3001/api/v1 (absolute, for direct dev access) must not
    // leak into the suite — force the empty default here.
    env: { VITE_API_BASE_URL: "" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/components/drill/definition_backup.ts",
      ],
      reporter: ["text", "html", "json", "clover"],
      thresholds: {
        statements: 65,
        branches: 58,
        functions: 60,
        lines: 68,
      },
    },
  },
});
