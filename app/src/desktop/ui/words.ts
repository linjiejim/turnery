import * as React from "react"
import { OP_NAMES, opLabel, type FeatureOp } from "@/studio/dsl"
import { t } from "@/lib/i18n"
import type { Actor, PartNote } from "../core/protocol"

/** Re-render every few seconds, for 「12 秒前」. */
export function useNow(ms = 5000) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}

const COMMAND_LABELS: Record<string, string> = {
  guide: t("读说明", "Read the guide"),
  open_part: t("打开零件", "Open part"),
  open_project: t("打开项目", "Open project"),
  list_parts: t("看零件列表", "List parts"),
  get_state: t("读模型状态", "Read model state"),
  set_params: t("改参数", "Change parameters"),
  edit_feature: t("改特征", "Edit feature"),
  delete_feature: t("删特征", "Delete feature"),
  inspect: t("查看模型", "Inspect model"),
  set_tree: t("替换特征树", "Replace feature tree"),
  move_feature: t("调整顺序", "Reorder features"),
  undo: t("撤销", "Undo"),
  redo: t("重做", "Redo"),
  look: t("看模型", "Look at model"),
  measure: t("测量", "Measure"),
  check: t("核对需求", "Check requirements"),
  set_appearance: t("设颜色", "Set color"),
  export: t("导出", "Export"),
  get_notes: t("读备注", "Read notes"),
  resolve_note: t("回复备注", "Reply to note"),
  request_pick: t("等你点选", "Wait for your pick"),
  show: t("指给你看", "Show you"),
  // An outside agent's own tools (ACP tool kinds, core/acp-stream.ts).
  "agent-execute": t("运行命令", "Run a command"),
  "agent-read": t("读取", "Read"),
  "agent-edit": t("修改文件", "Edit a file"),
  "agent-delete": t("删除文件", "Delete a file"),
  "agent-move": t("移动文件", "Move a file"),
  "agent-search": t("搜索", "Search"),
  "agent-fetch": t("联网", "Fetch"),
  "agent-think": t("想一想", "Think"),
  "agent-switch_mode": t("切换模式", "Switch mode"),
  "agent-mcp": t("用别的工具", "Use another tool"),
  "agent-other": t("其他操作", "Other action"),
}

/** 「做拉伸」「核对需求」 */
export const commandLabel = (name: string) => COMMAND_LABELS[name] ?? (name in OP_NAMES ? t(`做${OP_NAMES[name as FeatureOp]}`, opLabel(name as FeatureOp)) : name)

export const ACTOR_LABEL: Record<Actor, string> = { agent: "Agent", assistant: t("助手", "Assistant"), user: t("你", "You"), file: t("文件", "File") }

/** 「刚刚」「12 秒前」「3 分钟前」 */
export function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 10) return t("刚刚", "just now")
  if (s < 60) return t(`${s} 秒前`, `${s} s ago`)
  if (s < 3600) return t(`${Math.floor(s / 60)} 分钟前`, `${Math.floor(s / 60)} min ago`)
  if (s < 86400) return t(`${Math.floor(s / 3600)} 小时前`, `${Math.floor(s / 3600)} h ago`)
  return new Date(at).toLocaleDateString(t("zh-CN", "en-US"))
}

/** The name a file shows as: its base name without the ending (「底壳」 for parts/底壳.turnery.json). */
export const fileStem = (path: string) => (path.split(/[\\/]/).pop() ?? path).replace(/\.(turnery|arbor)(-asm)?\.json$/i, "").replace(/\.(step|stp|json)$/i, "")

/** What a note is about, in a few words (its card, the notes list). `whole`: 零件 or 装配 (part or assembly). */
export function noteAbout(n: PartNote, whole = t("零件", "part")) {
  const quote = (names: string[] = []) => t(names.map((x) => `「${x}」`).join(""), names.map((x) => `“${x}”`).join(", "))
  switch (n.kind) {
    case "face":
    case "edge":
      return `${n.kind === "face" ? t("面", "Face") : t("边", "Edge")} · ${n.what} · ${n.where}`
    case "part":
      return t(`整个${whole}`, `Whole ${whole}`)
    case "parts":
      return t(`零件${quote(n.parts)}`, `${n.parts?.length === 1 ? "Part" : "Parts"} ${quote(n.parts)}`)
    case "feature":
      return t(`步骤「${n.what}」`, `Step “${n.what}”`)
    case "region":
      return `${n.region?.shape === "pen" ? t("画笔圈出的区域", "Circled area") : t("框选的区域", "Boxed area")}${n.parts?.length ? ` · ${quote(n.parts)}` : ""}`
  }
}
