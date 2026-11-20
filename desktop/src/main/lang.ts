import { app } from "electron"

/**
 * The language of the app's own menus and dialogs: the window's (lib/i18n.ts in app/), which it sends
 * once it has loaded (its stored choice, else the system's); until then, the one saved last time.
 */
let lang: "zh" | "en" | null = null

// Before the window says: the language lang-boot.ts settled from the saved choice, else the system's.
const atStart = (): "zh" | "en" => (process.env.TURNERY_LANG === "en" ? "en" : process.env.TURNERY_LANG === "zh" ? "zh" : /^zh\b/i.test(app.getLocale()) ? "zh" : "en")

export const currentLang = (): "zh" | "en" => lang ?? atStart()

/** The string in the menus' language: `tm("文件", "File")`. */
export const tm = (zh: string, en: string) => (currentLang() === "en" ? en : zh)

/** The window said which language it is in. True when that changed what the menus should say. */
export function setLang(next: unknown): boolean {
  const l = next === "en" ? "en" : next === "zh" ? "zh" : null
  if (!l || l === currentLang()) {
    lang = l ?? lang
    return false
  }
  lang = l
  return true
}
