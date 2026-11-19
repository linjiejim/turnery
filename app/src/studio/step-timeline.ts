// The feature timeline under the 3D view (ui/tree-overlay.tsx), the parts that are plain logic: which
// step's name it shows, where that name sits, and what the small card over a step says.
import { OP_NAMES, type Feature } from "./dsl"
import type { Dim } from "./kernel/dims"

/** The one step named under the strip: the one pointed at, else the one open, else the one rolled back to. */
export function namedStep(s: { pointed: string | null; pinned: string | null; selected: string | null; rollback: string | null }) {
  return s.pointed ?? s.pinned ?? s.selected ?? s.rollback ?? null
}

/**
 * Where the name's centre goes, from the left of the strip of steps: under its step (`center`),
 * but never past either end of the strip (`box` wide) for a name `width` wide.
 */
export function labelLeft(center: number, width: number, box: number) {
  if (width >= box) return box / 2
  return Math.min(Math.max(center, width / 2), box - width / 2)
}

/** The card's first line: 「第 12 步 · 拉伸 · 切除 · J3 牛角座」. */
export function stepLine(f: Feature, index: number) {
  return [`第 ${index + 1} 步`, OP_NAMES[f.op], "mode" in f && f.mode === "cut" ? "切除" : "", f.part ?? "", f.suppressed ? "已压缩" : ""].filter(Boolean).join(" · ")
}

/**
 * What a screen reader says for a step's button: its name and its state, 「圆角1（已压缩）」「拉伸1（失败）」.
 * The button has an aria-label (its icon is all it shows), and that label is all that is read of it.
 */
export function stepLabel(name: string, f: Pick<Feature, "suppressed">, state?: string) {
  return `${name}${f.suppressed ? "（已压缩）" : ""}${state === "error" ? "（失败）" : state === "skipped" ? "（未重建）" : ""}`
}

/**
 * The step on screen, as an index: the one rolled back to, else the last (the latest model is the
 * last step). -1 for an empty tree.
 */
export function shownStep(rollbackIndex: number, count: number) {
  return rollbackIndex >= 0 ? rollbackIndex : count - 1
}

/** Where 「播放」 starts: from the latest model (or the last step), the first step; else the one after the step shown. */
export function replayFrom(rollbackIndex: number, count: number) {
  return rollbackIndex < 0 || rollbackIndex >= count - 1 ? 0 : rollbackIndex + 1
}

/** The rollback that shows step `index`: the last step is the latest model (null), so measuring and notes keep working. */
export function rollbackFor(features: readonly { id: string }[], index: number): string | null {
  const i = Math.max(0, Math.min(features.length - 1, index))
  return i >= features.length - 1 ? null : features[i].id
}

/** The step's own design dimensions worth a glance: at most `max`, parameters first, never the derived ones. */
export function cardDims(dims: Dim[], feature: string, max = 2) {
  return dims
    .filter((d) => d.feature === feature && d.source.type !== "derived")
    .sort((a, b) => b.priority - a.priority)
    .slice(0, max)
}
