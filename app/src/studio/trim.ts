import type { UIMessage } from "ai"
import { agentLang, type AgentLang } from "../lib/agent-lang"

/**
 * Keep what the model needs, not the whole history: the current model state
 * travels in the system prompt anyway.
 *  - only the last `keepTurns` user turns;
 *  - images only from the most recent `look`;
 *  - reasoning only within the current turn (DeepSeek needs it there for tool calls);
 *  - reference images only from the last two user turns.
 */
export function trimMessages(messages: UIMessage[], keepTurns = 8, lang: AgentLang = agentLang()): UIMessage[] {
  // What stands in for what was dropped, in the model's language (the web server passes the request's).
  const say = (zh: string, en: string) => (lang === "en" ? en : zh)
  const userIdx = messages.map((m, i) => (m.role === "user" ? i : -1)).filter((i) => i >= 0)
  const start = userIdx.length > keepTurns ? userIdx[userIdx.length - keepTurns] : 0
  const lastUser = userIdx.length ? userIdx[userIdx.length - 1] : 0
  const kept = messages.slice(start)

  let lastLook: { m: number; p: number } | null = null
  kept.forEach((m, mi) =>
    m.parts.forEach((p, pi) => {
      if (p.type === "tool-look" && "output" in p && p.output) lastLook = { m: mi, p: pi }
    }),
  )

  const recentUser = userIdx.length > 2 ? userIdx[userIdx.length - 2] : 0
  return kept.map((m, mi) => {
    const before = start + mi < lastUser
    if (m.role === "user" && start + mi < recentUser && m.parts.some((p) => p.type === "file")) {
      return { ...m, parts: [...m.parts.filter((p) => p.type !== "file"), { type: "text", text: say("（之前附的参考图已省略）", "(the reference image attached earlier is left out)") }] } as UIMessage
    }
    const parts = m.parts
      .filter((p) => !(before && p.type === "reasoning"))
      .map((p, pi) => {
        if (p.type !== "tool-look" || !("output" in p) || !p.output) return p
        const isLast = lastLook && lastLook.m === mi && lastLook.p === m.parts.indexOf(p) && pi >= 0
        if (isLast) return p
        const out = p.output as { images?: string[]; text?: string }
        if (!out.images) return p
        return { ...p, output: { ...out, images: undefined, text: `${out.text ?? ""}${say("（旧视图已省略）", " (old views left out)")}` } }
      })
    return { ...m, parts } as UIMessage
  })
}
