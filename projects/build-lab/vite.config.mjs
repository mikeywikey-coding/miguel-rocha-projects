import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
    // Most of the bundle is game data (catalogs and tuning tables, ~1.8 MB raw / ~250 kB gzip).
    // Keeping it in its own chunk lets browsers cache it separately from app code.
    chunkSizeWarningLimit: 1700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
          if (id.endsWith(".json")) return "game-data";
        },
      },
    },
  },
  server: {
    port: 4173,
    warmup: { clientFiles: ["./src/main.jsx"] },
  },
});
