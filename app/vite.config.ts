/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * The site's /desktop page shares its name with desktop.html (the Turnery window, a separate build):
 * the dev server would serve that file for /desktop. Send the page to the site's index.html instead.
 */
const desktopPage: Plugin = {
  name: "turnery-desktop-page",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/desktop\/?(\?.*)?$/.test(req.url)) req.url = "/index.html"
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), desktopPage],
  // Kernel tests (OpenCascade in wasm) run side by side: a busy machine can take seconds per build.
  test: { testTimeout: 30_000 },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { port: 5287, strictPort: true },
  // The OpenCascade glue locates its .wasm itself; keep it out of dependency pre-bundling.
  optimizeDeps: { exclude: ["replicad-opencascadejs"] },
  worker: { format: "es" },
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // three.js changes rarely: its own long-cached chunk.
        advancedChunks: { groups: [{ name: "three", test: /node_modules[\\/]three[\\/]/ }] },
      },
    },
  },
})
