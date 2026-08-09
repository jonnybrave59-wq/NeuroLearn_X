import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "offline.html",
        "offline.js",
        "favicon-32.png",
        "apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "og-neurolearnx.png",
      ],
      manifest: {
        id: "/",
        name: "NeuroLearn-X",
        short_name: "NeuroLearn-X",
        description: "Explainable adaptive learning pathways for General Physics.",
        start_url: "/#/",
        scope: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "any",
        background_color: "#f3f7fa",
        theme_color: "#071b34",
        categories: ["education", "productivity"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cacheId: "neurolearnx-v1.3.1",
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/release\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/(?:api(?:\/|$)|health(?:\/|$))/,
            handler: "NetworkOnly",
            method: "GET",
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/(?:api(?:\/|$)|health(?:\/|$))/,
            handler: "NetworkOnly",
            method: "POST",
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/(?:api(?:\/|$)|health(?:\/|$))/,
            handler: "NetworkOnly",
            method: "PUT",
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/(?:api(?:\/|$)|health(?:\/|$))/,
            handler: "NetworkOnly",
            method: "PATCH",
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/(?:api(?:\/|$)|health(?:\/|$))/,
            handler: "NetworkOnly",
            method: "DELETE",
          },
        ],
      },
    }),
    {
      name: "remove-development-urls-from-production",
      apply: "build",
      renderChunk(code) {
        return {
          code: code
            .replaceAll("http://localhost", "https://invalid.invalid")
            .replace(/http:\/\/127(?:\.\d{1,3}){3}/gi, "https://invalid.invalid"),
          map: null,
        };
      },
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          const content = output.type === "chunk" ? output.code : String(output.source || "");
          if (/https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?/i.test(content)) {
            throw new Error(
              `Production asset ${output.fileName} contains a development URL.`,
            );
          }
        }
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8021",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
