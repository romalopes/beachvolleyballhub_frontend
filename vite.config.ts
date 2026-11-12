/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const pwaEnabled = env.VITE_PWA_ENABLED?.trim().toLowerCase() === "true";

  return {
    plugins: [
      react(),
      VitePWA({
        disable: !pwaEnabled,
        registerType: "autoUpdate",
        includeAssets: ["ball.png", "favicon.svg", "icons.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png"],
        manifest: {
          name: "Beach Volleyball Hub",
          short_name: "BVB Hub",
          description: "Beach volleyball coaching, training, assessment and tournament workflows.",
          theme_color: "#D97706",
          background_color: "#FDFBF7",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          shortcuts: [
            {
              name: "Current Location Weather",
              short_name: "Weather",
              description: "View weather for your current location",
              url: "/weather",
              icons: [{ src: "/icon-192.png", sizes: "192x192" }],
            },
            {
              name: "My Tournaments",
              short_name: "Tournaments",
              description: "View your tournaments",
              url: "/my-tournaments",
              icons: [{ src: "/icon-192.png", sizes: "192x192" }],
            },
          ],
        },
        workbox: {
          navigateFallback: "/index.html",
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: /^https?.*\/api\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https?.*\/weather\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "weather-share-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https?.*\.weatherapi\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "weather-icons-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              urlPattern: /^https?.*\/ball\.png/i,
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
        },
      }),
    ],
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
      "/weather": {
        // Public weather share page with Open Graph metadata
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
    env: {
      VITE_API_BASE_URL: "",
        VITE_GOOGLE_MAPS_EMBED_API_KEY: "",
      VITE_MOBILE_LAYOUT_ENABLED: "true",
      VITE_PWA_ENABLED: "true",
      VITE_OFFLINE_ENABLED: "true",
    },
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
  };
});
