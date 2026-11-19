import type { UIMessage } from "ai"
import { t } from "@/lib/i18n"
import { commandLabel } from "./ui/words"

/** 「思考中」「正在写「做拉伸」的参数」「看结果，想下一步」 */
export function activity(chat: { messages: UIMessage[]; status: string }): string {
  const last = chat.messages.at(-1)
  if (chat.status === "submitted" || last?.role !== "assistant") return t("等模型回应", "Waiting for the model")
  const p = last.parts.at(-1)
  if (!p) return t("等模型回应", "Waiting for the model")
  if (p.type === "reasoning") return t("思考中", "Thinking")
  if (p.type === "text") return p.state === "streaming" ? t("正在回复", "Replying") : t("想下一步", "Planning the next step")
  if (p.type.startsWith("tool-")) {
    const tool = p as { type: string; state?: string }
    const label = commandLabel(tool.type.slice(5))
    if (tool.state === "input-streaming") return t(`正在写「${label}」的参数`, `Preparing “${label}”`)
    if (tool.state === "input-available") return t(`正在${label}`, `Running “${label}”`)
    return t("看结果，想下一步", "Reading the result")
  }
  return t("想下一步", "Planning the next step")
}
