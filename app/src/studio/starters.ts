import { isEn, t } from "../lib/i18n"
import type { Tree } from "./dsl"

/**
 * Ready-made feature trees: a way into the studio without the model (rollback,
 * parameters, code all work), and the bridge from a teardown to "now change it
 * yourself". `teardown` links a starter to the baked model it mirrors.
 */
type Starter = { id: string; title: string; note: string; teardown?: string; tree: Tree }

const STARTERS_ZH: Starter[] = [
  {
    id: "box-fillet-first",
    title: t("小盒子：先圆角后抽壳", "Small box: fillet, then shell"),
    note: t("和案例拆解里的小盒子 A 同一个做法。把 r 改到比 t 小，看内角怎么变。", "Built the same way as small box A in Teardowns. Make r smaller than t and watch the inside corners change."),
    teardown: "box_fillet_first",
    tree: {
      params: { L: 60, W: 40, H: 30, r: 4, t: 2.5 },
      paramNotes: { L: "外形长，沿 X", W: "外形宽，沿 Y", H: "总高，沿 Z", r: "外圆角半径", t: "壁厚（抽壳向内）" },
      features: [
        { id: "sk1", op: "sketch", name: "草图1", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "盒子外轮廓画在上视基准面上" },
        { id: "ext1", op: "extrude", name: "拉伸1", sketch: "sk1", distance: "H", intent: "先得到实心的盒体" },
        { id: "fil1", op: "fillet", name: "外圆角", edges: { not: { extreme: "+Z" } }, r: "r", intent: "除了顶面一圈，竖边和底边都倒圆角；放在抽壳之前，内侧会得到同心的圆角" },
        { id: "shell1", op: "shell", name: "抽壳", open: { normal: "+Z", extreme: "+Z" }, t: "t", intent: "去掉顶面，所有面向内偏移一个壁厚" },
      ],
    },
  },
  {
    id: "flange",
    title: t("法兰盘", "Flange"),
    note: t("孔先做一个，再用圆周阵列复制；改 n 和 pcd 看阵列怎么跟着变。", "Make one hole, then copy it with a circular pattern. Change n and pcd and watch the pattern follow."),
    tree: {
      params: { D: 120, T: 10, d0: 40, pcd: 90, bolt: 8, n: 6 },
      paramNotes: { D: "盘的外径", T: "盘厚", d0: "中心孔直径", pcd: "螺栓孔所在圆的直径（节圆）", bolt: "螺栓孔直径", n: "螺栓孔个数" },
      features: [
        { id: "sk", op: "sketch", name: "盘面草图", on: { plane: "XY" }, shapes: [{ type: "circle", d: "D" }, { type: "circle", d: "d0", cut: true }], intent: "外圆和中心孔一起画，拉伸一次就有通孔" },
        { id: "disc", op: "extrude", name: "盘体", sketch: "sk", distance: "T" },
        { id: "h1", op: "hole", name: "螺栓孔", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [["pcd/2", 0]], d: "bolt", intent: "只做一个孔作为阵列的种子" },
        { id: "ring", op: "circular_pattern", name: "孔阵列", features: ["h1"], axis: "Z", count: "n", intent: "绕中心等分 n 个，改种子孔径所有孔一起变" },
        { id: "ch", op: "chamfer", name: "外缘倒角", edges: { kind: "circle", radius: "D/2" }, d: 1, intent: "去掉外缘锐边" },
      ],
    },
  },
  {
    id: "mug",
    title: t("带把手的杯子", "Mug with a handle"),
    note: t("旋转出杯身，抽壳，再沿 C 形路径扫掠出把手。", "Revolve the body, shell it, then sweep the handle along a C-shaped path."),
    tree: {
      params: { R: 40, H: 100, t: 3, rb: 5 },
      paramNotes: { R: "杯身外半径", H: "杯高", t: "杯壁厚", rb: "杯底外缘圆角半径" },
      features: [
        { id: "s", op: "sketch", name: "杯身半截面", on: { plane: "XZ" }, shapes: [{ type: "rect", w: "R", h: "H", center: ["R/2", "H/2"] }], intent: "回转体只画轴一侧的半截面" },
        { id: "body", op: "revolve", name: "杯身", sketch: "s", axis: "Z" },
        { id: "fb", op: "fillet", name: "杯底圆角", edges: { kind: "circle", extreme: "-Z" }, r: "rb", intent: "抽壳前做，内侧会跟着变圆" },
        { id: "sh", op: "shell", name: "抽壳", open: { normal: "+Z", extreme: "+Z" }, t: "t" },
        { id: "handle", op: "sweep", name: "把手", path: { on: { plane: "XZ" }, points: [["R-1.5", 75], ["R+28", 75], ["R+28", 30], ["R-1.5", 30]], corner: 12 }, profile: { type: "rect", w: 9, h: 6 }, intent: "路径两端伸进杯壁里，合并后没有缝" },
      ],
    },
  },
  {
    id: "shaft",
    title: t("阶梯轴", "Stepped shaft"),
    note: t("一个半截面旋转出三段直径；轴肩处可以再加倒角。", "Revolve one half-section into three diameters; add chamfers at the shoulders if you like."),
    tree: {
      params: {},
      features: [
        { id: "s", op: "sketch", name: "半截面", on: { plane: "XZ" }, shapes: [{ type: "polyline", points: [[0, 0], [10, 0], [10, 30], [7, 30], [7, 55], [5, 55], [5, 70], [0, 70]] }] },
        { id: "r", op: "revolve", name: "旋转", sketch: "s", axis: "Z" },
        { id: "c", op: "chamfer", name: "端部倒角", edges: { kind: "circle", radius: 10, extreme: "-Z" }, d: 1 },
      ],
    },
  },
]

/**
 * The trees' own words in English: feature names, intents and parameter notes. In a tree they are
 * the author's content, but these trees are ours, and an English page should open them in English
 * (the tutor is told to keep naming features in English too).
 */
const WORDS_EN: Record<string, { params?: Record<string, string>; features: Record<string, { name?: string; intent?: string }> }> = {
  "box-fillet-first": {
    params: { L: "Outer length, along X", W: "Outer width, along Y", H: "Total height, along Z", r: "Outer fillet radius", t: "Wall thickness (shelled inward)" },
    features: {
      sk1: { name: "Sketch1", intent: "The box's outline, on the top plane" },
      ext1: { name: "Extrude1", intent: "A solid block first" },
      fil1: { name: "Outer fillet", intent: "Round every edge except the top loop; done before the shell, the inside gets matching fillets" },
      shell1: { name: "Shell", intent: "Remove the top face and offset every face inward by the wall thickness" },
    },
  },
  flange: {
    params: { D: "Disc diameter", T: "Disc thickness", d0: "Center hole diameter", pcd: "Diameter of the circle the bolt holes sit on (pitch circle)", bolt: "Bolt hole diameter", n: "Number of bolt holes" },
    features: {
      sk: { name: "Disc sketch", intent: "The outer circle and the center hole together, so one extrude gives the through hole" },
      disc: { name: "Disc" },
      h1: { name: "Bolt hole", intent: "Only one hole, as the seed of the pattern" },
      ring: { name: "Hole pattern", intent: "n copies around the center; change the seed's diameter and every hole follows" },
      ch: { name: "Rim chamfer", intent: "Break the sharp outer edge" },
    },
  },
  mug: {
    params: { R: "Outer radius of the body", H: "Height", t: "Wall thickness", rb: "Fillet radius of the bottom's outer edge" },
    features: {
      s: { name: "Body half-section", intent: "A revolved part needs only the half on one side of the axis" },
      body: { name: "Body" },
      fb: { name: "Bottom fillet", intent: "Done before the shell, so the inside is rounded too" },
      sh: { name: "Shell" },
      handle: { name: "Handle", intent: "Both ends of the path reach into the wall, so the union leaves no gap" },
    },
  },
  shaft: {
    features: {
      s: { name: "Half-section" },
      r: { name: "Revolve" },
      c: { name: "End chamfer" },
    },
  },
}

/** A starter with its tree's words laid over from `words` (anything missing stays as it is). */
export function starterInEnglish(s: Starter, words = WORDS_EN[s.id]): Starter {
  if (!words) return s
  const paramNotes = s.tree.paramNotes && { ...s.tree.paramNotes, ...words.params }
  const features = s.tree.features.map((f) => ({ ...f, ...words.features[f.id] }) as typeof f)
  return { ...s, tree: { ...s.tree, ...(paramNotes ? { paramNotes } : {}), features } }
}

export const STARTERS: Starter[] = isEn ? STARTERS_ZH.map((s) => starterInEnglish(s)) : STARTERS_ZH

export const starterFor = (teardownId: string) => STARTERS.find((s) => s.teardown === teardownId)
