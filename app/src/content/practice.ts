import type { Check, Feature, Tree } from "@/studio/dsl"
import { byLocale, t } from "@/lib/i18n"

/**
 * 练习：课程讲完一个概念，到工作台上自己做一个零件。`checks` 是判分用的要求，
 * 放进特征树的 `checks`，每次重建由内核重新量；`solution` 只给测试用（practice.test.ts
 * 用真内核建出来，要求全部通过），界面上不显示。
 */
export type Practice = {
  id: string
  /** 课程 id（lessons/index.ts）；综合项目的一步不属于某节课，写 project */
  lesson?: string
  /** 综合项目（curriculum.json 的 projects）里的第几步，从 1 数起 */
  project?: { id: string; step: number; of: number }
  /** 做完以后接着做哪一道（项目的下一步） */
  next?: string
  title: string
  /** 一两句话的任务，每个尺寸都写出来 */
  task: string
  /** 起始特征树；不写就是空的 */
  start?: Tree
  /** 判分用的要求：id 以 "p-" 开头，said 是任务里的原话，期望值写数字 */
  checks: Check[]
  /** 提示，按学员需要的先后排 */
  tips: string[]
  /** 参考答案 */
  solution: Tree
}

const TOP = { normal: "+Z", extreme: "+Z" } as const

/** 一块 60×30×20 的料（圆角与倒角的起点）。 */
const blockTree: Tree = {
  params: { L: 60, W: 30, H: 20 },
  paramNotes: { L: t("长，沿 X", "Length, along X"), W: t("宽，沿 Y", "Width, along Y"), H: t("高，沿 Z", "Height, along Z") },
  features: [
    { id: "sk", op: "sketch", name: t("轮廓", "Profile"), on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: t("矩形关于原点对称", "Rectangle symmetric about the origin") },
    { id: "base", op: "extrude", name: t("料块", "Block"), sketch: "sk", distance: "H", intent: t("先得到实心的料，再加工边", "Get the solid stock first, then work on its edges") },
  ],
}

/** 先抽壳、后倒外圆角的盒子：内转角是尖的。 */
const boxSketch: Feature = {
  id: "sk",
  op: "sketch",
  name: t("盒子轮廓", "Box outline"),
  on: { plane: "XY" },
  shapes: [{ type: "rect", w: "L", h: "W" }],
  intent: t("外轮廓画在上视基准面上", "The outer outline, on the top plane"),
}
const boxBase: Feature = { id: "base", op: "extrude", name: t("实心盒体", "Solid box"), sketch: "sk", distance: "H", intent: t("先得到实心的盒体", "A solid box first") }
const boxFillet: Feature = {
  id: "fil",
  op: "fillet",
  name: t("外圆角", "Outer fillet"),
  edges: { of: "base", parallel: "Z", expect: 4 },
  r: "r",
  intent: t("盒体外侧的四条竖边倒圆角", "Fillet the box's four outer vertical edges"),
}
const boxShell: Feature = {
  id: "sh",
  op: "shell",
  name: t("抽壳", "Shell"),
  open: TOP,
  t: "t",
  intent: t("去掉顶面，所有面向内偏移一个壁厚", "Remove the top face and offset every face inward by the wall thickness"),
}
const boxParams = {
  params: { L: 80, W: 50, H: 30, r: 6, t: 2 },
  paramNotes: {
    L: t("外形长，沿 X", "Outer length, along X"),
    W: t("外形宽，沿 Y", "Outer width, along Y"),
    H: t("总高，沿 Z", "Total height, along Z"),
    r: t("外圆角半径", "Outer fillet radius"),
    t: t("壁厚（抽壳向内）", "Wall thickness (shelled inward)"),
  },
}

/** 立柱加一根横梁，横梁的底面是平的悬空面。 */
const bracketParams = {
  params: { a: 20, H: 60, arm: 30, t: 10 },
  paramNotes: {
    a: t("立柱截面边长，也是横梁的宽", "Side of the post's square section, also the arm's width"),
    H: t("立柱高", "Post height"),
    arm: t("横梁伸出立柱的长度", "How far the arm sticks out from the post"),
    t: t("横梁厚", "Arm thickness"),
  },
}
const bracketFeatures: Feature[] = [
  { id: "post_s", op: "sketch", name: t("立柱截面", "Post section"), on: { plane: "XY" }, shapes: [{ type: "rect", w: "a", h: "a" }], intent: t("立柱放在原点上", "The post stands on the origin") },
  { id: "post", op: "extrude", name: t("立柱", "Post"), sketch: "post_s", distance: "H", intent: t("立着打印，Z 向上", "Printed standing up, Z up") },
  {
    id: "arm_s",
    op: "sketch",
    name: t("横梁截面", "Arm section"),
    on: { plane: "XY", offset: "H-t" },
    shapes: [{ type: "rect", w: "arm", h: "a", center: ["a/2+arm/2", 0] }],
    intent: t("画在偏移 H-t 的基准面上，紧贴立柱右侧", "On a plane offset by H-t, right against the post's right side"),
  },
  { id: "arm", op: "extrude", name: t("横梁", "Arm"), sketch: "arm_s", distance: "t", intent: t("往上长到和立柱顶面齐平", "Grows upward until it's flush with the top of the post") },
]


/** 放样出来的实心罩壳：底面 B×W，往上 h 收到 TB×TW。 */
const coverParams = {
  params: { B: 70, W: 44, TB: 50, TW: 30, h: 30 },
  paramNotes: {
    B: t("底面长，沿 X", "Bottom length, along X"),
    W: t("底面宽，沿 Y", "Bottom width, along Y"),
    TB: t("顶面长，沿 X", "Top length, along X"),
    TW: t("顶面宽，沿 Y", "Top width, along Y"),
    h: t("罩壳高，沿 Z", "Cover height, along Z"),
  },
}
const coverFeatures: Feature[] = [
  { id: "s1", op: "sketch", name: t("底面截面", "Bottom section"), on: { plane: "XY" }, shapes: [{ type: "rect", w: "B", h: "W" }], intent: t("底面关于原点对称", "The bottom, symmetric about the origin") },
  { id: "s2", op: "sketch", name: t("顶面截面", "Top section"), on: { plane: "XY", offset: "h" }, shapes: [{ type: "rect", w: "TB", h: "TW" }], intent: t("画在偏移 h 的基准面上", "On a plane offset by h") },
  { id: "lf", op: "loft", name: t("罩壳外形", "Cover shape"), sketches: ["s1", "s2"], intent: t("两个截面放样出外形，侧面自带斜度", "Loft the two sections into the shape; the sides come out sloped") },
]

/** 一块 60×40×25 的料：注塑底壳的起点。 */
const trayParams = {
  params: { L: 60, W: 40, H: 25 },
  paramNotes: { L: t("长，沿 X", "Length, along X"), W: t("宽，沿 Y", "Width, along Y"), H: t("高，沿 Z，开模方向", "Height, along Z, the pull direction") },
}
const trayFeatures: Feature[] = [
  { id: "sk", op: "sketch", name: t("底壳轮廓", "Tray outline"), on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: t("轮廓画在分型面上，也就是底面", "The outline sits on the parting plane, the bottom face") },
  { id: "base", op: "extrude", name: t("实心料块", "Solid block"), sketch: "sk", distance: "H", intent: t("先得到实心的外形", "The solid shape first") },
]

/** 一块 80×50、厚 2 的底板。 */
const plateParams = {
  params: { L: 80, W: 50, t: 2 },
  paramNotes: { L: t("板长，沿 X", "Plate length, along X"), W: t("板宽，沿 Y", "Plate width, along Y"), t: t("板厚", "Plate thickness") },
}
const plateFeatures: Feature[] = [
  { id: "sk", op: "sketch", name: t("底板轮廓", "Plate outline"), on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: t("矩形关于原点对称", "Rectangle symmetric about the origin") },
  { id: "plate", op: "extrude", name: t("底板", "Plate"), sketch: "sk", distance: "t", intent: t("薄板：刚度靠后面的筋，不靠板厚", "A thin plate: its stiffness will come from ribs, not thickness") },
]

/** 两块盖板连成一整块：活动铰链的起点。 */
const lidParams = {
  params: { L: 82, W: 30, t: 2 },
  paramNotes: { L: t("两块盖板连起来的总长，沿 X", "Overall length of the two lids together, along X"), W: t("宽，沿 Y", "Width, along Y"), t: t("盖板厚", "Lid thickness") },
}
const lidFeatures: Feature[] = [
  { id: "sk", op: "sketch", name: t("盖板轮廓", "Lid outline"), on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: t("两块盖板画成一整块，铰链在正中间", "Both lids drawn as one piece, with the hinge right in the middle") },
  { id: "lid", op: "extrude", name: t("盖板", "Lids"), sketch: "sk", distance: "t", intent: t("一体注塑：盖子、盒身和铰链是同一个零件", "Molded in one: lid, box and hinge are a single part") },
]

// ------------------------------------------------------------ P3 手持小家电外壳

/** 上壳的外形：圆角矩形拉伸，侧面拔模，顶边圆角。 */
const P3_PARAMS = {
  L: [140, t("外形长，沿 X", "Overall length, along X")],
  W: [48, t("外形宽，沿 Y", "Overall width, along Y")],
  H: [22, t("上壳高，沿 Z，开模方向", "Height of the top shell, along Z, the pull direction")],
  rc: [20, t("俯视轮廓的四角圆角", "Corner radius of the outline seen from above")],
  a: [1.5, t("侧面拔模角", "Draft angle on the sides")],
  rt: [6, t("顶边圆角", "Fillet on the top edge")],
  t: [2, t("壁厚", "Wall thickness")],
  px: [50, t("螺丝柱离中心的距离，沿 X", "Distance of each screw boss from the center, along X")],
  db: [5, t("螺丝柱外径", "Outer diameter of the screw bosses")],
  dh: [2.5, t("螺丝柱的孔径（自攻螺钉底孔）", "Hole diameter in the bosses (pilot hole for a self-tapping screw)")],
  tr: [1.2, t("加强筋厚", "Rib thickness")],
  zr: [10, t("加强筋下沿离分型面的高度", "Height of the rib's lower edge above the parting plane")],
} as const satisfies Record<string, readonly [number, string]>
/** The parameters a step uses, with their notes: each step only carries what its features need. */
const p3Params = (...names: (keyof typeof P3_PARAMS)[]) => ({
  params: Object.fromEntries(names.map((n) => [n, P3_PARAMS[n][0]])),
  paramNotes: Object.fromEntries(names.map((n) => [n, P3_PARAMS[n][1]])),
})
const p3Shape: Feature[] = [
  { id: "sk", op: "sketch", name: t("俯视轮廓", "Outline from above"), on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W", r: "rc" }], intent: t("轮廓画在分型面上：上壳从这里往上长", "The outline sits on the parting plane: the top shell grows up from here") },
  { id: "body", op: "extrude", name: t("实心外形", "Solid shape"), sketch: "sk", distance: "H", intent: t("先得到实心的大体块", "The big solid mass first") },
  { id: "dr", op: "draft", name: t("侧面拔模", "Draft on the sides"), faces: { at: { axis: "Z", value: "H/2" } }, angle: "a", neutral: { plane: "XY" }, intent: t("分型面是中性面，侧面朝开模方向收", "The parting plane is neutral; the sides taper toward the pull direction") },
  { id: "rt", op: "fillet", name: t("顶边圆角", "Top edge fillet"), edges: { faces: { normal: "+Z", extreme: "+Z" } }, r: "rt", intent: t("最大的圆角定下整体的软硬，放在拔模之后", "The largest fillet sets how soft the whole thing looks; it comes after the draft") },
]
const p3Shell: Feature = { id: "sh", op: "shell", name: t("抽壳", "Shell"), open: { normal: "-Z", extreme: "-Z" }, t: "t", intent: t("从分型面打开，所有面向内偏移一个壁厚", "Open at the parting plane; every face moves inward by one wall thickness") }
const p3Bosses: Feature[] = [
  {
    id: "bs",
    op: "sketch",
    name: t("螺丝柱截面", "Boss sections"),
    on: { plane: "XY" },
    shapes: [
      { type: "circle", d: "db", center: ["-px", 0] },
      { type: "circle", d: "db", center: ["px", 0] },
      { type: "circle", d: "dh", center: ["-px", 0], cut: true },
      { type: "circle", d: "dh", center: ["px", 0], cut: true },
    ],
    intent: t("外圆减孔：柱壁约为壳壁的 60%，背面不缩痕", "Outer circle minus the hole: the boss wall about 60 % of the shell wall, so the outside doesn't sink"),
  },
  { id: "boss", op: "extrude", name: t("螺丝柱", "Screw bosses"), sketch: "bs", until: "next", intent: t("从分型面一直长到碰到顶板", "Grows from the parting plane until it meets the top") },
]
const p3Ribs: Feature[] = [
  {
    id: "rs",
    op: "sketch",
    name: t("筋的下沿", "Lower edge of the rib"),
    on: { plane: "XZ" },
    shapes: [{ type: "path", points: [["px+db/2", "zr"], ["L/2-t", "zr"]] }],
    intent: t("一条线：从螺丝柱到端墙，筋从这里往上长到顶板", "One line from the boss to the end wall; the rib grows up from it to the top"),
  },
  { id: "rib", op: "rib", name: t("加强筋", "Rib"), sketch: "rs", t: "tr", intent: t("把螺丝柱连到侧墙上，拧螺钉时柱子不晃", "Ties the boss to the wall, so it doesn't wobble when the screw goes in") },
  { id: "mr", op: "mirror", name: t("镜像加强筋", "Mirror the rib"), plane: "YZ", features: ["rib"], intent: t("另一根螺丝柱用同一根筋", "The same rib for the other boss") },
]
const SHAPE = ["L", "W", "H", "rc", "a", "rt"] as const
const p3Stage1: Tree = { ...p3Params(...SHAPE), features: p3Shape }
const p3Stage2: Tree = { ...p3Params(...SHAPE, "t"), features: [...p3Shape, p3Shell] }
const p3Stage3: Tree = { ...p3Params(...SHAPE, "t", "px", "db", "dh"), features: [...p3Shape, p3Shell, ...p3Bosses] }
const p3Stage4: Tree = { ...p3Params(...SHAPE, "t", "px", "db", "dh", "tr", "zr"), features: [...p3Shape, p3Shell, ...p3Bosses, ...p3Ribs] }
const P3 = (step: number) => ({ id: "P3", step, of: 4 })

export const PRACTICE: Practice[] = [
  {
    id: "sketch-to-solid-1",
    lesson: "sketch-to-solid",
    title: t("带孔的垫块", "Block with a hole"),
    task: t(
      "在上视基准面上画一个 60×40 的矩形，拉伸 20 做成垫块；再在正中间打一个 ⌀16 的通孔，孔心离左端 30、离前边 20。",
      "On the top plane, sketch a 60×40 rectangle and extrude it 20 to make the block. Then put a ⌀16 through hole right in the middle, its center 30 from the left end and 20 from the front edge.",
    ),
    checks: [
      { id: "p-size", said: t("60×40 的矩形，拉伸 20", "A 60×40 rectangle, extruded 20"), kind: "size", expect: [60, 40, 20] },
      { id: "p-hole", said: t("⌀16 的通孔", "A ⌀16 through hole"), kind: "holes", faces: { kind: "cylinder" }, count: 1, d: 16 },
      { id: "p-hole-x", said: t("孔心离左端 30", "Its center 30 from the left end"), kind: "distance", a: { face: { kind: "cylinder" } }, b: { face: { normal: "-X" } }, expect: 30 },
      { id: "p-hole-y", said: t("离前边 20", "20 from the front edge"), kind: "distance", a: { face: { kind: "cylinder" } }, b: { face: { normal: "-Y" } }, expect: 20 },
    ],
    tips: byLocale(
      ["矩形的中心放在原点：宽 60 沿 X，高 40 沿 Y", "拉伸 20，沿上视基准面的法向往上长", "孔可以在同一张草图里画一个挖掉的圆，也可以用孔特征"],
      [
        "Put the rectangle's center on the origin: 60 wide along X, 40 high along Y",
        "Extrude it 20, growing upward along the top plane's normal",
        "For the hole, either draw a circle to cut out in the same sketch or use a hole feature",
      ],
    ),
    solution: {
      params: { L: 60, W: 40, H: 20, d: 16 },
      paramNotes: { L: "长，沿 X", W: "宽，沿 Y", H: "厚，沿 Z", d: "中间通孔直径" },
      features: [
        { id: "sk", op: "sketch", name: "垫块轮廓", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "矩形关于原点对称，长和宽都是参数" },
        { id: "base", op: "extrude", name: "垫块", sketch: "sk", distance: "H", intent: "沿上视基准面的法向往上长出厚度" },
        { id: "h1", op: "hole", name: "中间通孔", on: { plane: "XY", face: TOP }, at: [[0, 0]], d: "d", intent: "孔心在原点正上方，也就是垫块正中间；不写深度就是贯穿" },
      ],
    },
  },
  {
    id: "revolve-1",
    lesson: "revolve",
    title: t("车一根阶梯轴", "Turn a stepped shaft"),
    task: t(
      "在前视基准面上画半截面，旋转出一根总长 90 的阶梯轴：从下往上依次是 ⌀30 长 40、⌀20 长 30、⌀12 长 20，轴心有一个 ⌀6 的通孔。",
      "Sketch a half-section on the front plane and revolve it into a stepped shaft 90 long overall. From the bottom up: ⌀30, 40 long; ⌀20, 30 long; ⌀12, 20 long; and a ⌀6 through hole along the axis.",
    ),
    checks: [
      {
        id: "p-d30",
        said: t("⌀30 长 40", "⌀30, 40 long"),
        kind: "distance",
        a: { edge: { kind: "circle", radius: 15, extreme: "-Z" } },
        b: { edge: { kind: "circle", radius: 15, extreme: "+Z" } },
        expect: 40,
      },
      {
        id: "p-d20",
        said: t("⌀20 长 30", "⌀20, 30 long"),
        kind: "distance",
        a: { edge: { kind: "circle", radius: 10, extreme: "-Z" } },
        b: { edge: { kind: "circle", radius: 10, extreme: "+Z" } },
        expect: 30,
      },
      {
        id: "p-d12",
        said: t("⌀12 长 20", "⌀12, 20 long"),
        kind: "distance",
        a: { edge: { kind: "circle", radius: 6, extreme: "-Z" } },
        b: { edge: { kind: "circle", radius: 6, extreme: "+Z" } },
        expect: 20,
      },
      { id: "p-bore", said: t("⌀6 的通孔", "A ⌀6 through hole"), kind: "holes", faces: { kind: "cylinder", radius: 3 }, count: 1, d: 6 },
    ],
    tips: byLocale(
      ["回转体只画一半：在前视基准面上，从中心线往外画台阶", "轮廓离开中心线 3，转出来中间就是 ⌀6 的孔", "绕 Z 轴转一整圈"],
      [
        "For a revolved part, draw only half: on the front plane, draw the steps outward from the centerline",
        "Keep the profile 3 away from the centerline, and the revolve leaves a ⌀6 hole in the middle",
        "Revolve a full turn about the Z axis",
      ],
    ),
    solution: {
      params: { D1: 30, L1: 40, D2: 20, L2: 30, D3: 12, L3: 20, bore: 6 },
      paramNotes: { D1: "下段直径", L1: "下段长", D2: "中段直径", L2: "中段长", D3: "上段直径", L3: "上段长", bore: "轴心通孔直径" },
      features: [
        {
          id: "s",
          op: "sketch",
          name: "半截面",
          on: { plane: "XZ" },
          shapes: [
            {
              type: "polyline",
              points: [
                ["bore/2", 0],
                ["D1/2", 0],
                ["D1/2", "L1"],
                ["D2/2", "L1"],
                ["D2/2", "L1+L2"],
                ["D3/2", "L1+L2"],
                ["D3/2", "L1+L2+L3"],
                ["bore/2", "L1+L2+L3"],
              ],
            },
          ],
          intent: "只画中心线右边的一半；内侧离轴 bore/2，转出来就带着轴心孔",
        },
        { id: "r", op: "revolve", name: "阶梯轴", sketch: "s", axis: "Z", intent: "绕 Z 轴转一整圈，三段台阶一次成形" },
      ],
    },
  },
  {
    id: "pattern-mirror-1",
    lesson: "pattern-mirror",
    title: t("四角安装孔", "Corner mounting holes"),
    task: t(
      "做一块 80×50×6 的安装板，四角各打一个 ⌀5 的通孔，孔心离左右两端 8、离前后两边 8。先打一个孔，再用阵列或镜像得到另外三个。",
      "Make an 80×50×6 mounting plate with a ⌀5 through hole in each corner, the centers 8 from the left and right ends and 8 from the front and back edges. Make one hole first, then get the other three with a pattern or a mirror.",
    ),
    checks: [
      { id: "p-size", said: t("80×50×6 的安装板", "An 80×50×6 mounting plate"), kind: "size", expect: [80, 50, 6] },
      { id: "p-holes", said: t("四角各打一个 ⌀5 的通孔", "A ⌀5 through hole in each corner"), kind: "holes", faces: { kind: "cylinder" }, count: 4, d: 5 },
      {
        id: "p-edge-x",
        said: t("孔心离左右两端 8", "The centers 8 from the left and right ends"),
        kind: "distance",
        a: { face: { kind: "cylinder", extreme: "+X", not: { kind: "cylinder", extreme: "-Y" } } },
        b: { face: { normal: "+X" } },
        expect: 8,
      },
      {
        id: "p-edge-y",
        said: t("离前后两边 8", "8 from the front and back edges"),
        kind: "distance",
        a: { face: { kind: "cylinder", extreme: "-X", not: { kind: "cylinder", extreme: "+Y" } } },
        b: { face: { normal: "-Y" } },
        expect: 8,
      },
    ],
    tips: byLocale(
      ["先在左前角打一个 ⌀5 孔，它是阵列的种子", "线性阵列可以两个方向一起排：X 向 2 个，Y 向 2 个", "间距 = 板长 − 2×8，X 向 64，Y 向 34"],
      [
        "Start with one ⌀5 hole in the front-left corner: it's the seed of the pattern",
        "A linear pattern can run in two directions at once: 2 along X, 2 along Y",
        "Spacing = plate size − 2×8: 64 along X, 34 along Y",
      ],
    ),
    solution: {
      params: { L: 80, W: 50, T: 6, d: 5, e: 8 },
      paramNotes: { L: "板长，沿 X", W: "板宽，沿 Y", T: "板厚", d: "安装孔直径", e: "孔心到板边的距离" },
      features: [
        { id: "sk", op: "sketch", name: "板轮廓", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "矩形关于原点对称" },
        { id: "plate", op: "extrude", name: "安装板", sketch: "sk", distance: "T", intent: "往上长出板厚" },
        { id: "h1", op: "hole", name: "种子孔", on: { plane: "XY", face: TOP }, at: [["-L/2+e", "-W/2+e"]], d: "d", intent: "只打左前角一个，作为阵列的种子" },
        {
          id: "pat",
          op: "linear_pattern",
          name: "孔阵列",
          features: ["h1"],
          dir: "+X",
          count: 2,
          spacing: "L-2*e",
          dir2: "+Y",
          count2: 2,
          spacing2: "W-2*e",
          intent: "两个方向各 2 个；间距跟着板长和边距算，改板长孔还在四角",
        },
      ],
    },
  },
  {
    id: "fillet-chamfer-1",
    lesson: "fillet-chamfer",
    title: t("竖边圆角，顶边倒角", "Fillet the vertical edges, chamfer the top"),
    task: t("这块料是 60×30×20。四条竖边倒 R5 的圆角，再把顶面一圈倒 1 的倒角。", "This block is 60×30×20. Fillet the four vertical edges at R5, then chamfer the edges all around the top face by 1."),
    start: blockTree,
    checks: [
      { id: "p-size", said: "60×30×20", kind: "size", expect: [60, 30, 20] },
      { id: "p-fillet", said: t("四条竖边倒 R5 的圆角", "Fillet the four vertical edges at R5"), kind: "holes", faces: { kind: "cylinder" }, count: 4, d: 10 },
      {
        id: "p-chamfer",
        said: t("顶面一圈倒 1 的倒角", "Chamfer the edges all around the top face by 1"),
        kind: "distance",
        a: { face: TOP },
        b: { edge: { parallel: "X", extreme: "+Y", not: { extreme: "-Z" } } },
        expect: 1,
      },
    ],
    tips: byLocale(
      ["四条竖边一次选中，做成一个圆角特征", "先圆角，后倒角：倒角沿着圆角后的那一整圈走", "倒角选顶面的整圈边，圆角那四段弧也要带上"],
      [
        "Select all four vertical edges at once and make them one fillet feature",
        "Fillet first, then chamfer: the chamfer follows the whole loop that the fillet leaves",
        "For the chamfer, pick the whole loop of edges around the top face, the four fillet arcs included",
      ],
    ),
    solution: {
      params: { ...blockTree.params, r: 5, c: 1 },
      paramNotes: { ...blockTree.paramNotes, r: "竖边圆角半径", c: "顶面倒角距离" },
      features: [
        ...blockTree.features,
        { id: "fil", op: "fillet", name: "竖边圆角", edges: { of: "base", parallel: "Z", expect: 4 }, r: "r", intent: "四条竖边一次选中，共用一个半径" },
        { id: "cha", op: "chamfer", name: "顶边倒角", edges: { faces: TOP }, d: "c", intent: "顶面一整圈，连同圆角的弧一起倒成等距斜面" },
      ],
    },
  },
  {
    id: "fillet-shell-order-1",
    lesson: "fillet-shell-order",
    title: t("把盒子的特征顺序改对", "Fix the box's feature order"),
    task: t(
      "这个盒子先抽壳、后倒外圆角，内转角是尖的，转角的壁也被削薄了。调整特征顺序：外圆角 R6、壁厚 2 不变，内转角变成 R4 的圆角。",
      "This box was shelled first and filleted on the outside afterwards, so its inside corners are sharp and the wall is thinner at the corners. Reorder the features so that, with outer fillet R6 and wall thickness 2 unchanged, the inside corners become R4 fillets.",
    ),
    start: { ...boxParams, features: [boxSketch, boxBase, boxShell, boxFillet] },
    checks: [
      { id: "p-outer", said: t("外圆角 R6", "Outer fillet R6"), kind: "holes", faces: { kind: "cylinder", radius: 6 }, count: 4, d: 12 },
      { id: "p-wall", said: t("壁厚 2", "Wall thickness 2"), kind: "thickness", faces: { normal: "+X", extreme: "+X" }, expect: 2 },
      { id: "p-inner", said: t("内转角变成 R4 的圆角", "Inside corners become R4 fillets"), kind: "holes", faces: { kind: "cylinder", radius: 4 }, count: 4, d: 8 },
    ],
    tips: byLocale(
      ["抽壳会把已有的外圆角一起向内偏移，变成内圆角", "在特征树里把外圆角「上移一步」，放到抽壳前面", "内圆角半径 = 外圆角 R6 − 壁厚 2 = R4"],
      [
        "The shell offsets the outer fillets that are already there inward along with everything else, turning them into inner fillets",
        "In the feature tree, move the outer fillet “up one step” so it comes before the shell",
        "Inner fillet radius = outer fillet R6 − wall thickness 2 = R4",
      ],
    ),
    solution: {
      ...boxParams,
      features: [
        boxSketch,
        boxBase,
        { ...boxFillet, intent: "放在抽壳之前：抽壳时外圆角向内偏移成同心的内圆角" },
        boxShell,
      ],
    },
  },
  {
    id: "sweep-loft-1",
    lesson: "sweep-loft",
    title: t("方变圆过渡块", "Square-to-round transition"),
    task: t(
      "做一个方变圆的过渡块：底面是 50×50 的正方形，往上 40 是 ⌀30 的圆，用放样连起来；再从顶面往下打一个 ⌀16 的通孔。",
      "Make a square-to-round transition block: the bottom is a 50×50 square and 40 above it is a ⌀30 circle, joined by a loft. Then drill a ⌀16 through hole down from the top face.",
    ),
    checks: [
      { id: "p-size", said: t("底面是 50×50 的正方形", "The bottom is a 50×50 square"), kind: "size", expect: [50, 50, 40] },
      {
        id: "p-top",
        said: t("往上 40 是 ⌀30 的圆", "40 above it is a ⌀30 circle"),
        kind: "distance",
        a: { face: { normal: "-Z" } },
        b: { edge: { kind: "circle", radius: 15, near: [0, 0, 100] } },
        expect: 40,
      },
      { id: "p-hole", said: t("⌀16 的通孔", "A ⌀16 through hole"), kind: "holes", faces: { kind: "cylinder" }, count: 1, d: 16 },
    ],
    tips: byLocale(
      ["两个截面各画一张草图：正方形在上视基准面，圆在偏移 40 的基准面", "放样按从下到上的顺序选这两张草图", "孔从顶面往下钻，不写深度就是贯穿"],
      [
        "Draw each section in its own sketch: the square on the top plane, the circle on a plane offset 40",
        "For the loft, pick the two sketches in order, bottom to top",
        "Drill the hole down from the top face; with no depth given, it goes all the way through",
      ],
    ),
    solution: {
      params: { a: 50, h: 40, D: 30, d: 16 },
      paramNotes: { a: "底面正方形边长", h: "两个截面之间的高度", D: "顶面圆的直径", d: "中间通孔直径" },
      features: [
        { id: "s1", op: "sketch", name: "底面截面", on: { plane: "XY" }, shapes: [{ type: "rect", w: "a", h: "a" }], intent: "正方形关于原点对称" },
        { id: "s2", op: "sketch", name: "顶面截面", on: { plane: "XY", offset: "h" }, shapes: [{ type: "circle", d: "D" }], intent: "画在偏移 h 的基准面上，改 h 截面跟着走" },
        { id: "lf", op: "loft", name: "方变圆", sketches: ["s1", "s2"], intent: "两个截面之间光滑过渡" },
        { id: "h1", op: "hole", name: "中间通孔", on: { plane: "XY", face: TOP }, at: [[0, 0]], d: "d", intent: "从顶面圆心往下钻穿" },
      ],
    },
  },
  {
    id: "datum-planes-1",
    lesson: "datum-planes",
    title: t("打一个斜孔", "Drill an angled hole"),
    task: t(
      "在 60×40×20 的块上打一个 ⌀8 的斜通孔：孔穿过块的正中心，轴线和底面成 60°。",
      "In a 60×40×20 block, make a ⌀8 angled through hole: it passes through the exact center of the block, with its axis at 60° to the bottom face.",
    ),
    checks: [
      { id: "p-size", said: t("60×40×20 的块", "A 60×40×20 block"), kind: "size", expect: [60, 40, 20] },
      { id: "p-hole", said: t("⌀8 的斜通孔", "A ⌀8 angled through hole"), kind: "holes", faces: { kind: "cylinder" }, count: 1, d: 8 },
      { id: "p-angle", said: t("轴线和底面成 60°", "Its axis at 60° to the bottom face"), kind: "angle", a: { normal: "-Z" }, b: { kind: "cylinder" }, expect: 60 },
    ],
    tips: byLocale(
      ["斜孔要一个斜的基准面：上视基准面绕 X 轴转 30°", "孔沿基准面的法向钻，孔口要放在块外面", "先把基准面往上偏移一段再转，孔口就在块外"],
      [
        "An angled hole needs an angled datum plane: the top plane turned 30° about the X axis",
        "The hole is drilled along the plane's normal, so where it starts has to be outside the block",
        "Offset the plane upward first, then turn it, and the hole starts outside the block",
      ],
    ),
    solution: {
      params: { L: 60, W: 40, H: 20, d: 8, a: 30, lift: 40 },
      paramNotes: {
        L: "长，沿 X",
        W: "宽，沿 Y",
        H: "高，沿 Z",
        d: "斜孔直径",
        a: "斜基准面绕 X 轴转的角度，也是孔轴线偏离竖直的角度",
        lift: "斜基准面沿法向抬起的距离，让孔口落在块外面",
      },
      features: [
        { id: "sk", op: "sketch", name: "块轮廓", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "矩形关于原点对称" },
        { id: "base", op: "extrude", name: "块", sketch: "sk", distance: "H", intent: "往上长出块高" },
        {
          id: "h1",
          op: "hole",
          name: "斜孔",
          on: { plane: "XY", offset: "lift", tilt: { axis: "X", angle: "a" } },
          at: [[0, "H/2*sin(a)"]],
          d: "d",
          intent: "孔口在绕 X 轴转 a 的斜基准面上，孔沿它的法向钻穿；孔心偏 H/2·sin(a)，轴线正好过块的中心",
        },
      ],
    },
  },
  {
    id: "print-overhang-1",
    lesson: "print-overhang",
    title: t("去掉悬空的平底面", "Get rid of the flat overhang"),
    task: t(
      "这个 50×20×60 的支架立着打印时，横梁的平底面悬空，要加支撑。在横梁下面加一道 45° 的斜撑，外形不变，除了底面不再有朝下的平面。",
      "Printed standing up, this 50×20×60 bracket has an arm whose flat underside hangs in the air and needs support. Add a 45° gusset under the arm with the overall size unchanged, so that no flat face points down except the bottom face.",
    ),
    start: { ...bracketParams, features: bracketFeatures },
    checks: [
      { id: "p-size", said: t("外形不变", "Overall size unchanged"), kind: "size", expect: [50, 20, 60] },
      {
        id: "p-down",
        said: t("除了底面不再有朝下的平面", "No flat face points down except the bottom face"),
        kind: "distance",
        a: { face: { normal: "-Z", extreme: "+Z" } },
        b: { face: { normal: "-Z", extreme: "-Z" } },
        expect: 0,
      },
      { id: "p-slope", said: t("45° 的斜撑", "A 45° gusset"), kind: "angle", a: TOP, b: { kind: "plane", near: [35, 0, 25] }, expect: 45 },
    ],
    tips: byLocale(
      ["朝下的水平面悬垂角是 90°，超过 45° 就要支撑", "在前视基准面上画一个直角三角形，两条直角边都是 30", "两侧对称拉伸 20，和立柱一样宽"],
      [
        "A horizontal face pointing down has a 90° overhang angle; anything past 45° needs support",
        "On the front plane, draw a right triangle with both legs 30",
        "Extrude it 20, symmetric on both sides, as wide as the post",
      ],
    ),
    solution: {
      ...bracketParams,
      features: [
        ...bracketFeatures,
        {
          id: "gus_s",
          op: "sketch",
          name: "斜撑截面",
          on: { plane: "XZ" },
          shapes: [{ type: "polyline", points: [["a/2", "H-t"], ["a/2+arm", "H-t"], ["a/2", "H-t-arm"]] }],
          intent: "直角边都等于横梁伸出的长度，斜边正好 45°，盖住整个横梁底面",
        },
        { id: "gus", op: "extrude", name: "斜撑", sketch: "gus_s", distance: "a", direction: "both", intent: "两侧对称，和立柱一样宽" },
      ],
    },
  },
  {
    id: "offset-thicken-1",
    lesson: "offset-thicken",
    title: t("把实心罩壳抽成 2 mm 的壁", "Shell a solid cover to a 2 mm wall"),
    task: t(
      "这个放样出来的罩壳是实心的。从底面打开抽壳，壁厚 2，外形尺寸不变。",
      "This lofted cover is solid. Shell it open at the bottom with a 2 wall, keeping its outside size.",
    ),
    start: { ...coverParams, features: coverFeatures },
    checks: [
      { id: "p-size", said: t("外形尺寸不变", "Outside size unchanged"), kind: "size", expect: [70, 44, 30] },
      { id: "p-wall", said: t("壁厚 2", "A 2 wall"), kind: "thickness", faces: { normal: "+Z", extreme: "+Z" }, expect: 2 },
    ],
    tips: byLocale(
      ["抽壳要选开口的面：底面", "壁厚向内长，外形尺寸不变", "顶板也会变成 2 厚"],
      ["Shelling asks for the open face: the bottom", "The wall grows inward, so the outside size stays", "The top becomes 2 thick too"],
    ),
    solution: {
      params: { ...coverParams.params, t: 2 },
      paramNotes: { ...coverParams.paramNotes, t: "壁厚，向内" },
      features: [...coverFeatures, { id: "sh", op: "shell", name: "抽壳", open: { normal: "-Z", extreme: "-Z" }, t: "t", intent: "去掉底面，所有面向内偏移一个壁厚" }],
    },
  },
  {
    id: "styling-dfm-1",
    lesson: "styling-dfm",
    title: t("做一个能脱模的底壳", "Make a tray that comes out of the mold"),
    task: t(
      "把这块 60×40×25 的料做成注塑底壳，从上面开模：四个侧面加 2° 拔模，中性面放在底面；再从顶面打开抽壳，壁厚 2。",
      "Turn this 60×40×25 block into a molded tray that is pulled upward: give the four sides 2° of draft with the neutral plane at the bottom, then shell it open at the top with a 2 wall.",
    ),
    start: { ...trayParams, features: trayFeatures },
    checks: [
      { id: "p-size", said: t("底面保持 60×40，高 25", "The bottom stays 60×40, 25 high"), kind: "size", expect: [60, 40, 25] },
      { id: "p-draft", said: t("四个侧面加 2° 拔模", "2° of draft on the four sides"), kind: "angle", a: { normal: "-Z", extreme: "-Z" }, b: { kind: "plane", near: [30, 0, 12.5] }, expect: 88 },
      { id: "p-wall", said: t("壁厚 2", "A 2 wall"), kind: "thickness", faces: { normal: "-Z", extreme: "-Z" }, expect: 2 },
    ],
    tips: byLocale(
      ["先拔模再抽壳，内壁跟着一起斜", "中性面在底面，底面尺寸不变", "侧面用高度中间的位置一起选"],
      ["Draft first, then shell, so the inside walls slope too", "With the neutral plane at the bottom, the bottom keeps its size", "Pick the sides together by their mid-height"],
    ),
    solution: {
      params: { ...trayParams.params, a: 2, t: 2 },
      paramNotes: { ...trayParams.paramNotes, a: "侧面拔模角", t: "壁厚，向内" },
      features: [
        ...trayFeatures,
        { id: "dr", op: "draft", name: "侧面拔模", faces: { kind: "plane", at: { axis: "Z", value: "H/2" } }, angle: "a", neutral: { plane: "XY" }, intent: "四个侧面朝开模方向向内收，底面尺寸不变" },
        { id: "sh", op: "shell", name: "抽壳", open: { normal: "+Z", extreme: "+Z" }, t: "t", intent: "从顶面打开；在拔模之后抽壳，内壁也带着拔模角" },
      ],
    },
  },
  {
    id: "stiffness-ribs-1",
    lesson: "stiffness-ribs",
    title: t("用筋加强薄底板", "Stiffen a thin plate with ribs"),
    task: t(
      "这块 80×50、厚 2 的底板太软。不加厚板子，在板面上加两道沿 X 方向的筋：筋厚 1.2，高出板面 6，离中心线各 10；总用料不超过 10000 mm³。",
      "This 80×50 plate, 2 thick, is too floppy. Without making it thicker, add two ribs along X on top: 1.2 thick, standing 6 above the plate, each 10 from the centerline, using no more than 10000 mm³ of material in all.",
    ),
    start: { ...plateParams, features: plateFeatures },
    checks: [
      { id: "p-size", said: t("高出板面 6", "Standing 6 above the plate"), kind: "size", expect: [80, 50, 8] },
      { id: "p-rib", said: t("筋厚 1.2", "Ribs 1.2 thick"), kind: "thickness", faces: { normal: "+Y", near: [0, 10.6, 5] }, expect: 1.2 },
      { id: "p-mass", said: t("总用料不超过 10000 mm³", "No more than 10000 mm³ of material"), kind: "volume", max: 10000 },
    ],
    tips: byLocale(
      ["两个窄矩形画在板面上，往上拉伸 6", "筋厚约为板厚的 60%，背面不容易缩痕", "加厚到 8 要 32000 mm³，筋只要九千多"],
      ["Two narrow rectangles on the plate's top face, extruded up 6", "Ribs about 60 % of the wall, so the back doesn't sink", "A plate 8 thick takes 32000 mm³; the ribs, a little over 9000"],
    ),
    solution: {
      params: { ...plateParams.params, tr: 1.2, hr: 6, y: 10 },
      paramNotes: { ...plateParams.paramNotes, tr: "筋厚", hr: "筋高出板面的高度", y: "两道筋离中心线的距离" },
      features: [
        ...plateFeatures,
        {
          id: "rs",
          op: "sketch",
          name: "两道筋",
          on: { plane: "XY", offset: "t" },
          shapes: [
            { type: "rect", w: "L", h: "tr", center: [0, "y"] },
            { type: "rect", w: "L", h: "tr", center: [0, "-y"] },
          ],
          intent: "画在板面上，关于中心线对称",
        },
        { id: "ribs", op: "extrude", name: "加强筋", sketch: "rs", distance: "hr", intent: "往上长出筋高：刚度按高度的三次方涨，用料只按高度涨" },
      ],
    },
  },
  {
    id: "living-hinge-1",
    lesson: "living-hinge",
    title: t("切出一条活动铰链", "Cut a living hinge"),
    task: t(
      "这块 82×30、厚 2 的料是一体注塑的盒盖和盒身。在正中间从上面切一道宽 2 的槽，只留 0.4 厚，做成活动铰链。",
      "This 82×30 piece, 2 thick, is a lid and a box molded in one. Cut a slot 2 wide down from the top, right in the middle, leaving only 0.4 of material: that is the living hinge.",
    ),
    start: { ...lidParams, features: lidFeatures },
    checks: [
      { id: "p-size", said: t("外形 82×30×2 不变", "The 82×30×2 outline unchanged"), kind: "size", expect: [82, 30, 2] },
      { id: "p-hinge", said: t("只留 0.4 厚", "Only 0.4 left"), kind: "thickness", faces: { normal: "+Z", near: [0, 0, 0.4] }, expect: 0.4 },
      { id: "p-width", said: t("槽宽 2", "A slot 2 wide"), kind: "distance", a: { face: { normal: "+X", near: [-1, 0, 1] } }, b: { face: { normal: "-X", near: [1, 0, 1] } }, expect: 2 },
    ],
    tips: byLocale(
      ["槽画在顶面上：宽 2、长过整个宽度", "切除深度 = 板厚 − 铰链厚 = 1.6", "铰链要用 PP 这类耐弯折的料"],
      ["Draw the slot on the top face: 2 wide, across the whole width", "Cut depth = lid thickness − hinge thickness = 1.6", "The hinge needs a resin that takes flexing, such as PP"],
    ),
    solution: {
      params: { ...lidParams.params, w: 2, h: 0.4 },
      paramNotes: { ...lidParams.paramNotes, w: "铰链槽宽", h: "铰链剩下的厚度" },
      features: [
        ...lidFeatures,
        { id: "gs", op: "sketch", name: "铰链槽", on: { plane: "XY", offset: "t" }, shapes: [{ type: "rect", w: "w", h: "W+2" }], intent: "画在顶面上，比料宽一点，切得干净" },
        { id: "groove", op: "extrude", name: "切出铰链", sketch: "gs", distance: "t-h", mode: "cut", direction: "reverse", intent: "往下切到只剩 h，铰链厚度由参数决定" },
      ],
    },
  },
  {
    id: "p3-1",
    project: P3(1),
    next: "p3-2",
    title: t("小家电上壳 1：外形与拔模", "Appliance top shell 1: shape and draft"),
    task: t(
      "做一个手持小家电的上壳外形：俯视是 140×48、四角 R20 的圆角矩形，高 22；分型面在底面，侧面加 1.5° 拔模；最后给顶边倒 R6 圆角。",
      "Build the shape of a handheld appliance's top shell: seen from above a 140×48 rounded rectangle with R20 corners, 22 high; with the parting plane at the bottom, give the sides 1.5° of draft, and finish with an R6 fillet on the top edge.",
    ),
    checks: [
      { id: "p-size", said: t("140×48，高 22", "140×48, 22 high"), kind: "size", expect: [140, 48, 22] },
      { id: "p-draft", said: t("侧面加 1.5° 拔模", "1.5° of draft on the sides"), kind: "angle", a: { normal: "-Z", extreme: "-Z" }, b: { kind: "plane", near: [0, 24, 8] }, expect: 88.5 },
    ],
    tips: byLocale(
      ["草图里的矩形可以直接带四角圆角", "先拔模再倒顶边圆角", "拔模的中性面选上视基准面"],
      ["A sketch rectangle can carry its corner radius", "Draft first, then the top edge fillet", "Use the top plane as the neutral plane"],
    ),
    solution: p3Stage1,
  },
  {
    id: "p3-2",
    project: P3(2),
    next: "p3-3",
    title: t("小家电上壳 2：抽壳", "Appliance top shell 2: shell"),
    task: t(
      "接着上一步的外形（这里给的是参考做法）：从底面打开抽壳，壁厚 2，外形不变。",
      "Carry on from the shape of the previous step (here, its reference answer): shell it open at the bottom with a 2 wall, keeping the outside.",
    ),
    start: p3Stage1,
    checks: [
      { id: "p-size", said: t("外形不变", "The outside unchanged"), kind: "size", expect: [140, 48, 22] },
      { id: "p-wall", said: t("壁厚 2", "A 2 wall"), kind: "thickness", faces: { normal: "+Z", extreme: "+Z" }, expect: 2 },
    ],
    tips: byLocale(
      ["开口面是分型面上的底面", "圆角和拔模都在抽壳之前，内壁跟着偏移", "壁厚处处一样，注塑不缩不翘"],
      ["The open face is the bottom, on the parting plane", "Fillet and draft come before the shell, so the inside follows", "One wall thickness everywhere: no sink, no warp"],
    ),
    solution: p3Stage2,
  },
  {
    id: "p3-3",
    project: P3(3),
    next: "p3-4",
    title: t("小家电上壳 3：螺丝柱", "Appliance top shell 3: screw bosses"),
    task: t(
      "在壳里加两根螺丝柱，离中心各 50：外径 5，中间是 ⌀2.5 的自攻螺钉孔，从分型面一直长到顶板。",
      "Add two screw bosses inside the shell, each 50 from the center: 5 across, with a ⌀2.5 hole for a self-tapping screw, growing from the parting plane up to the top.",
    ),
    start: p3Stage2,
    checks: [
      { id: "p-holes", said: t("⌀2.5 的自攻螺钉孔", "⌀2.5 holes for self-tapping screws"), kind: "holes", faces: { kind: "cylinder", radius: 1.25 }, count: 2, d: 2.5 },
      { id: "p-pitch", said: t("离中心各 50", "Each 50 from the center"), kind: "pcd", faces: { kind: "cylinder", radius: 1.25 }, count: 2, expect: 100 },
    ],
    tips: byLocale(
      ["一张草图画两个外圆、两个挖掉的孔", "拉伸选「成形到下一面」，长到顶板", "柱壁 1.25，约为壳壁的 60%"],
      ["One sketch: two outer circles and two cut-out holes", "Extrude up to next, so it reaches the top", "A 1.25 boss wall, about 60 % of the shell wall"],
    ),
    solution: p3Stage3,
  },
  {
    id: "p3-4",
    project: P3(4),
    title: t("小家电上壳 4：加强筋", "Appliance top shell 4: ribs"),
    task: t(
      "用加强筋把每根螺丝柱连到端墙上：筋厚 1.2，下沿离分型面 10，往上长到顶板。",
      "Tie each screw boss to its end wall with a rib: 1.2 thick, its lower edge 10 above the parting plane, growing up to the top.",
    ),
    start: p3Stage3,
    checks: [
      { id: "p-rib", said: t("筋厚 1.2", "A rib 1.2 thick"), kind: "thickness", faces: { normal: "+Y", near: [60, 0.6, 15] }, expect: 1.2 },
      { id: "p-low", said: t("下沿离分型面 10", "Its lower edge 10 above the parting plane"), kind: "distance", a: { face: { normal: "-Z", near: [60, 0, 10] } }, b: { face: { normal: "-Z", extreme: "-Z", near: [0, 23, 0] } }, expect: 10 },
    ],
    tips: byLocale(
      ["在前视基准面上画一条线，从柱子到端墙", "筋特征会把线延长到墙，往上长到顶板", "另一边用镜像"],
      ["On the front plane, draw a line from the boss to the end wall", "The rib extends the line to the walls and grows up to the top", "Mirror it for the other side"],
    ),
    solution: p3Stage4,
  },
]

export const practiceFor = (lesson: string) => PRACTICE.filter((p) => p.lesson === lesson)
/** A project's steps (curriculum.json projects), in order. */
export const projectSteps = (project: string) => PRACTICE.filter((p) => p.project?.id === project).sort((a, b) => a.project!.step - b.project!.step)
export const practiceById = (id: string) => PRACTICE.find((p) => p.id === id)
