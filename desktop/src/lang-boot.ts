// Imported first by every desktop entry point (the app, the CLI, `turnery mcp`): settles the language
// of what agents read before any module builds its text (app/src/lib/agent-lang.ts). An explicit
// TURNERY_LANG wins; else the window's last choice; else the system language. Kernel threads inherit it.
import { readSettings } from "./engine/home"

if (process.env.TURNERY_LANG !== "en" && process.env.TURNERY_LANG !== "zh") {
  let lang: "zh" | "en" | undefined
  try {
    lang = readSettings().lang
  } catch {
    /* no settings yet */
  }
  const system = Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || ""
  process.env.TURNERY_LANG = lang ?? (/^zh\b/i.test(system) ? "zh" : "en")
}
