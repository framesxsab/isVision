/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { webcrypto } from "node:crypto";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});

export default defineConfig({
  server: {
    proxy: {
      "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8787",
    },
  },
  plugins: [
    // Vite's dev server injects inline <script> blocks for HMR and React Fast
    // Refresh. They would be blocked by the production CSP (which has no
    // 'unsafe-inline' and no nonce/hash). Strip the meta CSP in dev only —
    // the production build keeps it, and Cloudflare adds frame-ancestors via
    // _headers.
    {
      name: "csp-dev-strip",
      apply: "serve",
      transformIndexHtml(html) {
        return html.replace(
          /\s*<meta http-equiv="Content-Security-Policy"[^>]*>\s*/,
          "\n    ",
        );
      },
    },
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.svg", "sounds/*.mp3"],
      manifest: {
        name: "isVisible — Accessibility Platform",
        short_name: "isVisible",
        description:
          "Touch, hear, and navigate the visual world. Built for blind and visually impaired users.",
        theme_color: "#1e1b4b",
        background_color: "#0f0d1a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,mp3}"],
        // The Liblouis WASM build is ~1.6 MB. Keep it out of the install-time
        // precache and cache it on first use instead — most users never open
        // Grade 2 mode, and paying that cost up front would dwarf the rest of
        // the install footprint.
        globIgnores: ["**/liblouis/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/liblouis/") || url.pathname.startsWith("/tables/"),
            handler: "CacheFirst",
            options: {
              cacheName: "liblouis-assets-v1",
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["tests/**", "**/*.test.ts", "**/*.stories.tsx"],
    },
  },
});
