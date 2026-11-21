import { isEn } from "./i18n"

/**
 * The language of what the agent and the models read: the MCP guide, tool descriptions, tool results,
 * kernel and engine messages. Written `ta("拉伸完成", "Extruded")`, read when the text is made (never
 * fixed at import in code that runs in the app's main process, where it can change).
 *
 * Where it comes from:
 * - `setAgentLang()`: the desktop app's main process, when the window's language changes.
 * - `TURNERY_LANG`: every Node process. The desktop entry points set it at start from
 *   `~/.turnery/settings.json` (the window's last choice), else the system language
 *   (`desktop/src/lang-boot.ts`); kernel threads inherit it.
 * - The browser: a page's own language; its kernel worker gets it through the worker's name.
 * - Otherwise Chinese.
 *
 * The page's interface language is lib/i18n.ts; the two agree everywhere except the website's server,
 * which answers each request in the language it names (studio/prompt.ts, studio/tools.ts).
 */
export type AgentLang = "zh" | "en"

let chosen: AgentLang | null = null

const fromEnv = (): AgentLang | null => {
  const v = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TURNERY_LANG
  return v === "en" ? "en" : v === "zh" ? "zh" : null
}

/** In a browser worker: the name the page gave it ends in `:en` or `:zh`. */
const fromWorkerName = (): AgentLang | null => {
  const g = globalThis as { name?: unknown; document?: unknown; importScripts?: unknown }
  if (g.document !== undefined || typeof g.importScripts !== "function" || typeof g.name !== "string") return null
  return g.name.endsWith(":en") ? "en" : g.name.endsWith(":zh") ? "zh" : null
}

export const agentLang = (): AgentLang => chosen ?? fromEnv() ?? fromWorkerName() ?? (isEn ? "en" : "zh")

export function setAgentLang(lang: AgentLang) {
  chosen = lang
}

/** Run `fn` with the agent's language set to `lang` (text made inside is in it), then put it back. */
export function withAgentLang<T>(lang: AgentLang, fn: () => T): T {
  const before = chosen
  chosen = lang
  try {
    return fn()
  } finally {
    chosen = before
  }
}

/** The string in the agent's language. */
export const ta = (zh: string, en: string) => (agentLang() === "en" ? en : zh)

/** Any value in the agent's language. */
export const byAgentLang = <T>(zh: T, en: T): T => (agentLang() === "en" ? en : zh)

/** The worker name that hands a browser kernel worker its language. */
export const workerName = (base: string) => `${base}:${agentLang()}`
