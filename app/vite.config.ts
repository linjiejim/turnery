/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process'
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

/** The commit this build is made from: deploy.yml's, else the checkout's. */
function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}
const COMMIT = commit()

/**
 * /version.json names the live build. A tab open on an older one compares it with the commit in its bundle
 * and offers a reload (components/new-version-prompt.tsx). Caddy serves it with `no-cache` (docs/deploy.md).
 */
const versionFile: Plugin = {
  name: "turnery-version-file",
  apply: "build",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: `${JSON.stringify({ commit: COMMIT })}\n` })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), desktopPage, versionFile],
  define: { __TURNERY_COMMIT__: JSON.stringify(COMMIT) },
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
