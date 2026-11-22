import type * as React from "react"
import type { Tree } from "./dsl"
import type { PickInfo } from "./annotations"
import type { BuildReport, DisplayData } from "./kernel/build"
import type { Dim } from "./kernel/dims"
import type { DrawingData } from "./kernel/drawing"
import type { MeasureResult, MeasureTarget } from "./kernel/measure"
import type { Pin } from "./look"
import type { Check } from "./dsl"

export type KernelState = { phase: "loading"; loadedMB: number } | { phase: "ready" } | { phase: "error"; message: string }

/** How a change from the window is recorded. */
export type EditOptions = {
  /** One form's edits: consecutive edits with the same group undo as one step (engine `edit_tree`). */
  group?: string
}

/**
 * What the workbench's components see of the open part: the feature tree, the latest build, what the
 * view shows, and the changes they may make. The desktop window and the site's workbench both get it
 * from the engine (`useDesktopStudio`).
 */
export type Studio = {
  tree: Tree
  treeRef: React.RefObject<Tree>
  report: BuildReport | null
  display: DisplayData | null
  dims: Dim[]
  /** Which requirements held after the agent's (or the file's) last change. */
  checkBaseline: Record<string, boolean>
  kernel: KernelState
  /** Feature the view is rolled back to; null = latest. */
  rollback: string | null
  undo: () => void
  load: (tree: Tree) => Promise<string | null>
  /** null when it applied; otherwise why not. */
  setParam: (name: string, value: number | string) => Promise<string | null>
  /** null when it applied; otherwise why not. */
  editTree: (change: (tree: Tree) => Tree, opts?: EditOptions) => Promise<string | null>
  showFeature: (id: string | null) => void
  exportBody: (format: "step" | "stl" | "3mf") => Promise<Blob | null>
  pick: (kind: "face" | "edge", hash: number, point: [number, number, number]) => Promise<PickInfo | null>
  locate: (kind: "face" | "edge", selector: unknown) => Promise<number[] | null>
  /** What step `index` starts from: the body before it. */
  stepInput: (index: number) => Promise<DisplayData | null>
  drawing: (iso: boolean) => Promise<DrawingData | null>
  locateBefore: (kind: "face" | "edge", selector: unknown, before: number) => Promise<number[] | null>
  selectorFor: (kind: "face" | "edge", hashes: number[], before: number) => Promise<{ selector: Record<string, unknown>; count: number } | null>
  faceEdges: (hash: number, before: number) => Promise<number[]>
  measure: (targets: MeasureTarget[]) => Promise<MeasureResult | null>
  setPins: (pins: Pin[]) => void
  /** Pin a practice's checks (null: none). */
  pinChecks: (checks: Check[] | null) => void
}
