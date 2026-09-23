import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Served from https://hub.ontorag.org/ (GitHub Pages, custom domain).
export default defineConfig({
  base: "/",
  plugins: [svelte()],
  // Oxigraph loads its WASM with `new URL(..., import.meta.url)`; pre-bundling would break that
  optimizeDeps: { exclude: ["oxigraph"] },
  build: { outDir: "dist", target: "es2022" },
  test: { environment: "node", include: ["test/**/*.test.js"] },
});
