import { LESSONS } from "@/content/lessons"
import { routerBase } from "@/lib/i18n"
import { fetchJson, modelsBase } from "@/three/model-index"

/**
 * Start downloading a page's code before the click lands. Pages load on demand (App.tsx), so on a
 * slow connection a click waits for its page's code; pointing at a link, touching it or tabbing to
 * it is warning enough to start. The same `import()` the router runs later then finds the module
 * already there. Once a page has settled, the lesson page's code and three.js come down in the
 * background too: from almost anywhere, the next click is most likely a lesson.
 */

/** A page's code for a site path (without the /en prefix), or nothing for the home page and unknown paths. */
function loadersFor(path: string): (() => Promise<unknown>)[] {
  const [, first, id] = path.split("/")
  switch (first) {
    case "learn":
      return [() => import("@/routes/learn")]
    case "teardown":
      return id ? [() => import("@/routes/teardown"), () => fetchJson(`${modelsBase}/${id}/manifest.json`)] : [() => import("@/routes/teardown")]
    case "atlas":
      return [() => import("@/routes/atlas")]
    case "glossary":
      return [() => import("@/routes/glossary")]
    case "card":
      return [() => import("@/routes/card")]
    case "desktop":
      return [() => import("@/routes/desktop")]
    case "lesson": {
      const lesson = LESSONS.find((l) => l.id === id)
      return lesson ? [() => import("@/routes/lesson"), lesson.load] : [() => import("@/routes/lesson")]
    }
    case "studio":
      // The page's code only: the kernel (5.7 MB) starts when the page opens.
      return [() => import("@/routes/studio")]
    default:
      return []
  }
}

const started = new Set<string>()

/** Start downloading the code for a site path; each path once (again after a failure). */
export function prefetchPath(path: string) {
  const key = path.replace(/\/+$/, "") || "/"
  if (started.has(key)) return
  started.add(key)
  for (const load of loadersFor(key)) load().catch(() => started.delete(key))
}

/** The site path a link points to, if it stays on this site: without the /en prefix, as the router sees it. */
function sitePath(a: HTMLAnchorElement): string | null {
  if (a.target && a.target !== "_self") return null
  const url = new URL(a.href, window.location.href)
  if (url.origin !== window.location.origin) return null
  const base = routerBase ?? ""
  if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return null
  return url.pathname.slice(base.length) || "/"
}

/** A slow or metered connection asks for nothing extra in the background. */
function frugal() {
  const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return Boolean(c?.saveData) || /(^|-)2g$/.test(c?.effectiveType ?? "")
}

/** Listen for links about to be followed, and once the page is idle fetch the lesson page's code. */
export function installPrefetch() {
  const onIntent = (e: Event) => {
    const a = (e.target as Element | null)?.closest?.("a[href]")
    if (!(a instanceof HTMLAnchorElement)) return
    const path = sitePath(a)
    if (path) prefetchPath(path)
  }
  document.addEventListener("pointerover", onIntent, { passive: true })
  document.addEventListener("touchstart", onIntent, { passive: true })
  document.addEventListener("focusin", onIntent)

  const idle = (fn: () => void) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 5000 }) : window.setTimeout(fn, 2000))
  const warm = () => {
    if (frugal()) return
    const here = window.location.pathname.slice((routerBase ?? "").length)
    // The workbench is downloading its kernel; a lesson already has three.js.
    if (/^\/(studio|lesson)(\/|$)/.test(here)) return
    import("@/routes/lesson").catch(() => {})
  }
  if (document.readyState === "complete") idle(warm)
  else window.addEventListener("load", () => idle(warm), { once: true })
}
