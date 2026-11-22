import { t } from "../lib/i18n"
import { letteringTail, referencesOf } from "./apply"
import { Feature, TOOL_OPS, type FeatureOp, type Tree } from "./dsl"
import type { BuildReport } from "./kernel/build"

/**
 * Making a feature by hand: which features the form covers, what 「＋」 offers, where a new one goes,
 * what it starts as, and what it still lacks. The form itself is ui/feature-form.tsx.
 */

/** Features the form makes and edits. The rest (sweep, rib, thread, split, import, component) only show their dimensions. */
export const FORM_OPS = ["sketch", "extrude", "revolve", "loft", "hole", "fillet", "chamfer", "shell", "draft", "linear_pattern", "circular_pattern", "mirror"] as const
export type FormOp = (typeof FORM_OPS)[number]
export const hasForm = (op: FeatureOp): op is FormOp => (FORM_OPS as readonly string[]).includes(op)

/**
 * The fields each form edits, besides id / name / intent. Others a feature carries (an agent's `until`,
 * `thin`, `onto`…) are kept as they are.
 */
export const FORM_FIELDS: Record<FormOp, readonly string[]> = {
  sketch: ["on", "shapes"],
  extrude: ["sketch", "distance", "mode", "direction", "through"],
  revolve: ["sketch", "axis", "angle", "mode"],
  loft: ["sketches", "ruled", "mode"],
  hole: ["on", "at", "d", "standard", "depth", "reverse"],
  fillet: ["edges", "r"],
  chamfer: ["edges", "d"],
  shell: ["open", "t"],
  draft: ["faces", "angle", "neutral"],
  linear_pattern: ["features", "dir", "count", "spacing", "dir2", "count2", "spacing2"],
  circular_pattern: ["features", "axis", "count", "angle"],
  mirror: ["plane", "offset", "features"],
}
/** The fields of a sketch plane the form edits. */
export const PLANE_FIELDS = ["plane", "offset", "face", "tilt"] as const
/** Sketch shapes the form edits, with their fields. A polyline only with plain corners. */
export const SHAPE_FIELDS = {
  rect: ["w", "h", "center", "r", "cut"],
  circle: ["d", "center", "cut"],
  polygon: ["sides", "d", "center", "rotate", "cut"],
  slot: ["length", "width", "center", "angle", "cut"],
  text: ["text", "size", "center", "angle", "cut"],
  polyline: ["points", "cut"],
} as const
export type FormShape = keyof typeof SHAPE_FIELDS

/** A feature being made: not every required field there yet (a fillet before its edges are picked). */
export type Draft = { id: string; op: FormOp } & Record<string, unknown>

export type MenuItem = { key: string; op: FormOp; label: string; preset?: Record<string, unknown> }
export type MenuGroup = { label: string; items: MenuItem[] }

/** 「＋」: by what the step does, each group in the order the lessons teach them. */
export const menuGroups = (): MenuGroup[] => [
  { label: t("草图", "Sketch"), items: [{ key: "sketch", op: "sketch", label: t("草图", "Sketch") }] },
  {
    label: t("加料", "Add material"),
    items: [
      { key: "extrude", op: "extrude", label: t("拉伸", "Extrude") },
      { key: "revolve", op: "revolve", label: t("旋转", "Revolve") },
      { key: "loft", op: "loft", label: t("放样", "Loft") },
    ],
  },
  {
    label: t("切除", "Remove material"),
    items: [
      { key: "cut", op: "extrude", label: t("拉伸切除", "Extruded cut"), preset: { mode: "cut", through: true } },
      { key: "hole", op: "hole", label: t("孔", "Hole") },
    ],
  },
  {
    label: t("修饰", "Finish"),
    items: [
      { key: "fillet", op: "fillet", label: t("圆角", "Fillet") },
      { key: "chamfer", op: "chamfer", label: t("倒角", "Chamfer") },
      { key: "shell", op: "shell", label: t("抽壳", "Shell") },
      { key: "draft", op: "draft", label: t("拔模", "Draft") },
    ],
  },
  {
    label: t("复制", "Copy"),
    items: [
      { key: "linear_pattern", op: "linear_pattern", label: t("线性阵列", "Linear pattern") },
      { key: "circular_pattern", op: "circular_pattern", label: t("圆周阵列", "Circular pattern") },
      { key: "mirror", op: "mirror", label: t("镜像", "Mirror") },
    ],
  },
]

/**
 * Where a new feature goes: right after `after` (the step rolled back to), else at the end, before the
 * lettering there (`applyEdit` puts it there too: text has thousands of edges, so it stays last).
 */
export function insertAt(tree: Tree, after: string | null): number {
  const i = after ? tree.features.findIndex((f) => f.id === after) : -1
  return i >= 0 ? i + 1 : letteringTail(tree)
}

/** Some feature before `at` built a solid. */
export function solidBefore(tree: Tree, report: BuildReport | null, at: number): boolean {
  return tree.features.slice(0, at).some((f, i) => f.op !== "sketch" && !f.suppressed && report?.features[i]?.state === "ok")
}

const sketchesBefore = (tree: Tree, at: number) => tree.features.slice(0, at).filter((f) => f.op === "sketch")
const toolsBefore = (tree: Tree, at: number) => tree.features.slice(0, at).filter((f) => TOOL_OPS.includes(f.op))

/** Why this can't be made here yet, or null. */
export function whyNot(tree: Tree, report: BuildReport | null, op: FormOp, at: number): string | null {
  if (op === "sketch") return null
  if (op === "extrude" || op === "revolve") {
    if (!sketchesBefore(tree, at).length) return t("先画一个草图", "Draw a sketch first")
    return freeSketch(tree, at, true) ? null : t("先画一个新草图（前面的都用过了）", "Draw a new sketch first (the ones before are used)")
  }
  if (op === "loft") return sketchesBefore(tree, at).length >= 2 ? null : t("至少要两个草图", "Needs at least two sketches")
  if (!solidBefore(tree, report, at)) return t("还没有实体", "There’s no solid yet")
  if ((op === "linear_pattern" || op === "circular_pattern") && !toolsBefore(tree, at).length) return t("先做一个加料、切除或孔", "Add material, a cut or a hole first")
  return null
}

const ID_BASE: Record<FormOp, string> = {
  sketch: "sketch",
  extrude: "extrude",
  revolve: "revolve",
  loft: "loft",
  hole: "hole",
  fillet: "fillet",
  chamfer: "chamfer",
  shell: "shell",
  draft: "draft",
  linear_pattern: "pattern",
  circular_pattern: "ring",
  mirror: "mirror",
}

/** The first id of its kind not taken: fillet1, fillet2… (a cut: cut1). */
export function nextId(tree: Tree, op: FormOp, preset?: Record<string, unknown>): string {
  const base = op === "extrude" && preset?.mode === "cut" ? "cut" : ID_BASE[op]
  const taken = new Set(tree.features.map((f) => f.id))
  let n = 1
  while (taken.has(`${base}${n}`)) n++
  return `${base}${n}`
}

/** The latest sketch before `at` nothing uses yet; else (unless `strict`) the latest sketch. */
function freeSketch(tree: Tree, at: number, strict = false): string | undefined {
  const used = new Set(tree.features.flatMap((f) => (f.op === "sketch" ? [] : referencesOf(f))))
  const sketches = sketchesBefore(tree, at)
  const free = [...sketches].reverse().find((s) => !used.has(s.id))?.id
  return strict ? free : (free ?? sketches.at(-1)?.id)
}

const TOP = { normal: "+Z", extreme: "+Z" } as const

/** What a new feature starts as: built straight away where it can be (selections excepted). */
export function startDraft(tree: Tree, report: BuildReport | null, item: MenuItem, at: number): Draft {
  const id = nextId(tree, item.op, item.preset)
  const solid = solidBefore(tree, report, at)
  const last = toolsBefore(tree, at).at(-1)?.id
  const base = { id, op: item.op }
  switch (item.op) {
    case "sketch":
      return solid ? { ...base, on: { plane: "XY", face: { ...TOP } }, shapes: [{ type: "circle", d: 10 }] } : { ...base, on: { plane: "XY" }, shapes: [{ type: "rect", w: 40, h: 30 }] }
    case "extrude":
      return { ...base, sketch: freeSketch(tree, at), ...(item.preset?.mode === "cut" ? { mode: "cut", through: true } : { distance: 10 }) }
    case "revolve":
      return { ...base, sketch: freeSketch(tree, at), axis: "Z" }
    case "loft":
      return { ...base, sketches: sketchesBefore(tree, at).slice(-2).map((s) => s.id) }
    case "hole":
      return { ...base, on: { plane: "XY", face: { ...TOP } }, at: [[0, 0]], d: 5 }
    case "fillet":
      return { ...base, r: 2 }
    case "chamfer":
      return { ...base, d: 1 }
    case "shell":
      return { ...base, open: { ...TOP }, t: 2 }
    case "draft":
      return { ...base, angle: 3, neutral: { plane: "XY" } }
    case "linear_pattern":
      return { ...base, features: last ? [last] : [], dir: "+X", count: 3, spacing: 10 }
    case "circular_pattern":
      return { ...base, features: last ? [last] : [], axis: "Z", count: 6 }
    case "mirror":
      return { ...base, plane: "YZ", ...(last ? { features: [last] } : {}) }
  }
}

/** What the draft still lacks before it can go into the tree, in words; null when it's complete. */
export function missing(d: Draft): string | null {
  const lacks = (k: string) => d[k] === undefined || (Array.isArray(d[k]) && !(d[k] as unknown[]).length)
  if ((d.op === "fillet" || d.op === "chamfer") && lacks("edges")) return t("在模型上选边", "Pick the edges on the model")
  if (d.op === "shell" && lacks("open")) return t("在模型上选开口的面", "Pick the open faces on the model")
  if (d.op === "draft" && lacks("faces")) return t("在模型上选要拔模的面", "Pick the faces to draft on the model")
  if ((d.op === "extrude" || d.op === "revolve") && lacks("sketch")) return t("选一个草图", "Choose a sketch")
  if (d.op === "loft" && ((d.sketches as unknown[] | undefined)?.length ?? 0) < 2) return t("至少选两个草图", "Choose at least two sketches")
  if ((d.op === "linear_pattern" || d.op === "circular_pattern") && lacks("features")) return t("选要复制的特征", "Choose the features to copy")
  if (d.op === "sketch" && lacks("shapes")) return t("至少要一个图形", "Needs at least one shape")
  if (d.op === "hole" && lacks("at")) return t("至少要一个孔心", "Needs at least one hole center")
  if (d.op === "extrude" && d.distance === undefined && !d.through && d.until === undefined) return t("写拉伸距离，或者选贯穿", "Give a distance, or choose through all")
  const parsed = Feature.safeParse(d)
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
  return null
}

/** A typed number field: a plain number stays a number, anything else is an expression; empty = left out. */
export function parseNum(text: string): number | string | undefined {
  const s = text.trim()
  if (!s) return undefined
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : s
}

export const numText = (v: unknown) => (v === undefined || v === null ? "" : String(v))

/** Remove the keys whose value is undefined (an emptied optional field), all the way down. */
export function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clean) as T
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).flatMap(([k, x]) => (x === undefined ? [] : [[k, clean(x)]]))) as T
  return v
}

/** Set `path` in a copy of `obj` (undefined removes it). */
export function setIn<T extends Record<string, unknown>>(obj: T, path: (string | number)[], value: unknown): T {
  if (!path.length) return value as T
  const [k, ...rest] = path
  const copy: Record<string | number, unknown> = Array.isArray(obj) ? ([...obj] as unknown as Record<number, unknown>) : { ...obj }
  const child = copy[k]
  copy[k] = rest.length ? setIn((child && typeof child === "object" ? child : typeof rest[0] === "number" ? [] : {}) as Record<string, unknown>, rest, value) : value
  if (copy[k] === undefined && !Array.isArray(copy)) delete copy[k]
  return copy as T
}

export const getIn = (obj: unknown, path: (string | number)[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string | number, unknown>)[k] : undefined), obj)
