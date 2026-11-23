import { useNewVersionPrompt } from "@/components/ui/release-notes"

/**
 * Compares the commit stamped into this bundle with the live one in /version.json (both from vite.config.ts)
 * when the tab comes back into view and every 10 minutes. The server never caches that file (docs/deploy.md).
 */
export default function NewVersionCheck() {
  useNewVersionPrompt({ current: __TURNERY_COMMIT__ })
  return null
}
