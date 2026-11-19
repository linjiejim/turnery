/**
 * Two languages: Chinese and English. Every string the interface shows is written once in each, side by
 * side where it is used — `t("回到最新", "Back to latest")` — so the two can't drift apart and a reader
 * of the code sees both. The language is fixed for the life of the page (switching reloads it), so
 * tables built when a module loads can call t() as well.
 *
 * Where the language comes from:
 * - the website: the address. `/en/…` is English, any other address Chinese; the router runs under
 *   `/en` as its basename, so links stay in the language they are in. Having chosen English, a bare
 *   address takes you to its `/en` twin.
 * - the desktop window: the choice made in it, else the system's language.
 * - Node (unit tests, the build, the engine): `TURNERY_LANG=en`, else Chinese.
 *
 * Not translated here: what the agent reads (the MCP guide, tool descriptions, kernel messages) and
 * the course's own text (lessons, cards); see docs/i18n.md.
 */
export type Locale = "zh" | "en"

export const LOCALES: readonly { id: Locale; label: string; html: string }[] = [
  { id: "zh", label: "中文", html: "zh-CN" },
  { id: "en", label: "English", html: "en" },
]

const STORE = "turnery:lang"
const EN_PREFIX = /^\/en(?=\/|$)/

const inBrowser = typeof window !== "undefined" && typeof document !== "undefined"

/** The desktop window (Electron, or its page opened from the dev server): no /en addresses there. */
export const inDesktopWindow = inBrowser && (Boolean((window as { turnery?: unknown }).turnery) || /\/desktop\.html$/.test(window.location.pathname))

function stored(): Locale | null {
  try {
    const v = localStorage.getItem(STORE)
    return v === "en" || v === "zh" ? v : null
  } catch {
    return null
  }
}

/** The language a page should be in, from what it knows (pure, for tests). */
export function pickLocale(s: { browser: boolean; desktop: boolean; path: string; stored: Locale | null; system: string; env?: string }): Locale {
  if (!s.browser) return s.env === "en" ? "en" : "zh"
  if (s.desktop) return s.stored ?? (/^zh\b/i.test(s.system) ? "zh" : "en")
  return EN_PREFIX.test(s.path) ? "en" : "zh"
}

export const locale: Locale = pickLocale({
  browser: inBrowser,
  desktop: inDesktopWindow,
  path: inBrowser ? window.location.pathname : "/",
  stored: inBrowser ? stored() : null,
  system: inBrowser ? (navigator.languages?.[0] ?? navigator.language ?? "") : "",
  env: (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TURNERY_LANG,
})

export const isEn = locale === "en"

/** The string in the page's language. */
export function t(zh: string, en: string): string {
  return isEn ? en : zh
}

/** Pick any value by language (a list, a component, a function). */
export function byLocale<T>(zh: T, en: T): T {
  return isEn ? en : zh
}

/** The router's basename on the website: "/en" for English, none for Chinese. */
export const routerBase = inBrowser && !inDesktopWindow && isEn ? "/en" : undefined

/** An address in the other language: `/en/learn` ⇄ `/learn` (path, query and hash kept). */
export function localizedPath(path: string, to: Locale) {
  const bare = path.replace(EN_PREFIX, "") || "/"
  if (to === "zh") return bare
  return bare === "/" ? "/en" : `/en${bare}`
}

/**
 * Before the app renders: the page's <html lang>, and on the website, a stored English choice moving a
 * Chinese address to its English twin (returns true when it navigated away).
 */
export function applyLocale(): boolean {
  if (!inBrowser) return false
  document.documentElement.lang = LOCALES.find((l) => l.id === locale)!.html
  if (inDesktopWindow || isEn || stored() !== "en") return false
  const { pathname, search, hash } = window.location
  window.location.replace(localizedPath(pathname, "en") + search + hash)
  return true
}

/** Switch language: remembered, then the page reloads in it (at its twin address on the website). */
export function setLocale(to: Locale) {
  try {
    localStorage.setItem(STORE, to)
  } catch {
    // Storage full or private mode: this visit only. An older English choice mustn't win either
    // (applyLocale would move a Chinese address straight back to /en); removing needs no room.
    try {
      localStorage.removeItem(STORE)
    } catch {
      /* no storage at all */
    }
  }
  if (!inBrowser) return
  if (inDesktopWindow) return window.location.reload()
  const { pathname, search, hash } = window.location
  window.location.assign(localizedPath(pathname, to) + search + hash)
}
