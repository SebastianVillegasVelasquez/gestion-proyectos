import {defineConfig} from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import * as path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          // Rutas normalizadas a "/" para que funcione igual en Windows.
          const normalized = id.replace(/\\/g, "/");
          const vendorPackages = [
            "/node_modules/react/",
            "/node_modules/react-dom/",
            "/node_modules/scheduler/",
            "/node_modules/react-router/",
            "/node_modules/react-router-dom/",
            "/node_modules/@tanstack/react-query/",
            "/node_modules/axios/",
          ];
          return vendorPackages.some((pkg) => normalized.includes(pkg)) ? "vendor" : undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
