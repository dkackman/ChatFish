/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ChatFish",
        short_name: "ChatFish",
        id: "./",
        start_url: "./",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#03173d",
        prefer_related_applications: false,
        icons: [
          { src: "icon-512.png", type: "image/png", sizes: "512x512" },
          { src: "icon-192.png", type: "image/png", sizes: "192x192" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,jpg,webmanifest}"],
        // the web-llm chunk is large; raise the precache single-file limit
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: "jsdom",
  },
});
