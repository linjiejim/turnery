import * as React from "react"
import { Box, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { PLANE_NAMES, SketchToSolid, type LessonState } from "./sketch-to-solid.scene"
import type { LessonDef, StepDef } from "./types"

/**
 * 1.1.3 · 1.2.1 「从草图到实体」: plane → sketch → constraints → dimensions →
 * extrude → options → change a parameter. The parametric loop in one lesson.
 */
const STEPS: StepDef<LessonState, SketchToSolid>[] = [
  {
    title: t("先选一个平面", "Pick a plane first"),
    body: byLocale(
      <>
        <p>建模从「画在哪儿」开始。每个零件都自带一个原点和三个互相垂直的基准面，后面所有的几何都以它们为参照。</p>
        <p>这里用 Z 轴朝上的约定（Onshape、Rhino、NX 都这样），所以水平的那块是上视基准面 XY。</p>
      </>,
      <>
        <p>Modeling starts with “where do I draw?” Every part comes with an origin and three mutually perpendicular datum planes, and all the geometry that follows references them.</p>
        <p>This lesson uses the Z-up convention (as Onshape, Rhino and NX do), so the horizontal one is the Top plane, XY.</p>
      </>,
    ),
    task: { label: t("在视图里点选「上视基准面 XY」", "Click “Top plane XY” in the view"), done: (s) => s.plane === "XY" },
    extra: ({ s }) =>
      s.wrongPlane ? (
        <Hint tone="warning">
          {byLocale(
            <>
              这是{PLANE_NAMES[s.wrongPlane]} {s.wrongPlane}。我们要在水平的那块上画。
            </>,
            <>
              That's the {PLANE_NAMES[s.wrongPlane]} {s.wrongPlane}. We want to draw on the horizontal one.
            </>,
          )}
        </Hint>
      ) : null,
    note: t(
      "SOLIDWORKS 默认 Y 轴朝上，它的「上视基准面」其实是 XZ。换软件时，先看清哪根轴朝上。",
      "SOLIDWORKS is Y-up by default, so its “Top Plane” is actually XZ. When you switch software, check which axis points up first.",
    ),
    terms: ["plane"],
  },
  {
    title: t("正对草图平面", "Face the sketch plane"),
    body: byLocale(
      <>
        <p>在平面上开始草图后，视图会转过来正对它（SOLIDWORKS 叫「正视于」，Fusion 叫 Look At）。草图里画的都是 2D 线条。</p>
        <p>看 3D 的时候可以随便转，但回到草图时，最好正对着画。</p>
      </>,
      <>
        <p>When you start a sketch on a plane, the view turns to face it squarely (SOLIDWORKS calls this “Normal To”, Fusion “Look At”). A sketch contains only 2D lines.</p>
        <p>Orbit freely while you look at the 3D model, but when you come back to the sketch, it's best to draw face-on.</p>
      </>,
    ),
    task: {
      label: t("拖动画面转开一点，再点右上角视图方块的「上」回到正对", "Drag to orbit away a little, then click “Top” on the view cube at the top right to face the sketch again"),
      done: (s) => s.backToTop,
    },
    extra: ({ s }) => (s.orbited && !s.backToTop ? <Hint>{t("好，现在点视图方块上的「上」。", "Good. Now click “Top” on the view cube.")}</Hint> : null),
    terms: ["sketch"],
  },
  {
    title: t("画一个矩形", "Draw a rectangle"),
    body: byLocale(
      <>
        <p>矩形由 4 条线组成。软件会自动给它加上「水平」「竖直」约束，所以它始终是个矩形。</p>
        <p>但它的位置和大小还没定：还剩 4 个自由度，横向位置、纵向位置、宽、高。蓝色就表示「还能动」。</p>
      </>,
      <>
        <p>A rectangle is made of 4 lines. The software adds “horizontal” and “vertical” constraints to it automatically, so it always stays a rectangle.</p>
        <p>But its position and size aren't set yet. It has 4 degrees of freedom left: horizontal position, vertical position, width and height. Blue means “can still move”.</p>
      </>,
    ),
    task: { label: t("拖动右上角的蓝点", "Drag the blue point at the top right corner"), done: (s) => s.dragged },
    terms: ["sketch"],
  },
  {
    title: t("用约束固定位置", "Fix the position with a constraint"),
    body: byLocale(
      <>
        <p>约束描述的是几何之间的关系，不是具体数值。给矩形加一条「关于原点对称」，它的中心就钉在原点上了。</p>
        <p>自由度从 4 降到 2，只剩宽和高。</p>
      </>,
      <>
        <p>A constraint describes a relationship between pieces of geometry, not a value. Make the rectangle “symmetric about the origin”, and its center is pinned to the origin.</p>
        <p>The degrees of freedom drop from 4 to 2: only the width and height are left.</p>
      </>,
    ),
    task: { label: t("给矩形添加「关于原点对称」", "Make the rectangle “symmetric about the origin”"), done: (s) => s.symmetric },
    extra: ({ s, c }) => (
      <div className="mt-3 flex flex-col items-start gap-2">
        <Button variant="secondary" disabled={s.symmetric} onClick={() => c.addSymmetric()}>
          {t("添加对称约束", "Add a symmetric constraint")}
        </Button>
        {s.symmetric && <Hint>{t("再拖一下角点：现在它只能绕着原点对称地缩放。", "Drag the corner again: now it can only grow and shrink symmetrically about the origin.")}</Hint>}
      </div>
    ),
  },
  {
    title: t("用尺寸确定大小", "Set the size with dimensions"),
    body: byLocale(
      <>
        <p>尺寸把剩下的自由度一个个钉死。加上宽和高，自由度变成 0，线条变黑：草图「完全定义」。</p>
        <p>尺寸数字可以直接点开改，形状会跟着变。</p>
      </>,
      <>
        <p>Dimensions pin down the remaining degrees of freedom one by one. Add the width and the height, and the degrees of freedom reach 0 and the lines turn black: the sketch is “fully defined”.</p>
        <p>Click a dimension's value to edit it, and the shape follows.</p>
      </>,
    ),
    task: { label: t("加上宽度和高度两个尺寸", "Add both dimensions: width and height"), done: (s) => s.dimW && s.dimH },
    extra: ({ s, c }) => (
      <>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={s.dimW} onClick={() => c.addDim("w")}>
            {t("添加宽度尺寸", "Add width dimension")}
          </Button>
          <Button variant="secondary" disabled={s.dimH} onClick={() => c.addDim("h")}>
            {t("添加高度尺寸", "Add height dimension")}
          </Button>
        </div>
        {s.locked && (
          <Hint>{t("完全定义的草图拖不动：形状只由尺寸决定。想改大小，就改尺寸。", "A fully defined sketch can't be dragged: only the dimensions decide its shape. To change the size, change a dimension.")}</Hint>
        )}
        <Legend />
      </>
    ),
  },
  {
    title: t("拉伸成实体", "Extrude it into a solid"),
    body: byLocale(
      <>
        <p>退出草图，用「拉伸」把轮廓沿着平面的法向推出厚度。</p>
        <p>拖动蓝色箭头，或者直接输入深度。高亮的面，就是这一步新长出来的。</p>
      </>,
      <>
        <p>Exit the sketch and use Extrude to push the profile out along the plane's normal, giving it depth.</p>
        <p>Drag the blue arrow, or type in the depth. The highlighted faces are the new ones this step creates.</p>
      </>,
    ),
    task: { label: t("把深度拉到 20 mm", "Pull the depth to 20 mm"), done: (s) => s.extruded && s.depth === 20 },
    extra: ({ s, c }) => <ParamSlider className="mt-3 px-0" label={t("深度", "Depth")} value={s.depth} min={0} max={80} onChange={(v) => c.setDepth(v)} />,
    terms: ["extrude"],
  },
  {
    title: t("拉伸的选项", "Extrude options"),
    body: byLocale(<p>同一个轮廓，换个选项，长出来的实体就不一样。先猜，再看。</p>, <p>The same profile with different options gives a different solid. Guess first, then look.</p>),
    task: { label: t("试一下「两侧对称」和拔模角", "Try “Symmetric” and a draft angle"), done: (s) => s.triedSymmetric && s.triedDraft },
    extra: ({ s, c }) => (
      <>
        <Predict
          question={t("方向改成「两侧对称」、深度还是 20，实体会怎样？", "Set the direction to “Symmetric” and keep the depth at 20. What happens to the solid?")}
          options={byLocale(
            ["向上、向下各长 20，总高 40", "上下各长 10，总高还是 20", "只向下长 20"],
            ["It grows 20 up and 20 down, 40 in total", "It grows 10 up and 10 down, still 20 in total", "It grows 20 downward only"],
          )}
          answer={1}
          explain={t(
            "对称拉伸以草图平面为中面，总深度不变，两边各占一半。对称零件这样建，中面正好落在基准面上，后面镜像、装配都更省事。",
            "A symmetric extrude uses the sketch plane as its mid-plane: the total depth stays the same, half on each side. Build a symmetric part this way and its mid-plane lands right on a datum plane, which makes later mirroring and assembly easier.",
          )}
          onReveal={() => c.setMode("symmetric")}
        />
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-small font-medium">{t("方向", "Direction")}</span>
            <Segmented
              size="sm"
              value={s.mode}
              onValueChange={(m) => c.setMode(m)}
              options={[
                { value: "one", label: t("单向", "One side") },
                { value: "symmetric", label: t("两侧对称", "Symmetric") },
              ]}
            />
          </div>
          <ParamSlider
            className="px-0"
            label={t("拔模角", "Draft angle")}
            unit="°"
            value={s.draft}
            min={0}
            max={15}
            step={0.5}
            onChange={(v) => c.setDraft(v)}
            hint={t("侧壁带一点斜度，注塑件才能从模具里脱出来。", "Side walls need a slight taper for a molded part to come out of the mold.")}
          />
        </div>
      </>
    ),
    terms: ["extrude", "draft"],
  },
  {
    title: t("改一个尺寸，下游跟着变", "Change a dimension, and what's downstream follows"),
    body: byLocale(
      <>
        <p>左上角的特征树里，拉伸1 挂在草图1 下面：拉伸用的是草图的轮廓。这叫父子关系。</p>
      </>,
      <>
        <p>In the feature tree at the top left, Extrude1 hangs under Sketch1: the extrude uses the sketch's profile. This is called a parent–child relationship.</p>
      </>,
    ),
    task: { label: t("改一次草图1 的宽度", "Change Sketch1's width once"), done: (s) => s.widthChanged },
    extra: ({ s, c }) => (
      <>
        <WidthPredict width={Math.round(s.rect.x1 - s.rect.x0)} onReveal={(w) => c.setSize("w", w)} />
        <ParamSlider
          className="mt-4 px-0"
          label={t("草图1 · 宽度", "Sketch1 · width")}
          value={Math.round(s.rect.x1 - s.rect.x0)}
          min={20}
          max={110}
          onChange={(v) => c.setSize("w", v)}
        />
      </>
    ),
  },
  {
    title: t("小测", "Quiz"),
    body: byLocale(<p>三道题，答完就完成本课。</p>, <p>Three questions. Answer them all to finish the lesson.</p>),
  },
]

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="h-0.5 w-5 rounded-full bg-primary" />
      <span>{t("蓝色：欠定义，还能动", "Blue: under-defined, can still move")}</span>
      <span className="h-0.5 w-5 rounded-full bg-foreground" />
      <span>{t("黑色：完全定义，自由度为 0", "Black: fully defined, 0 degrees of freedom")}</span>
      <span className="h-0.5 w-5 rounded-full bg-destructive" />
      <span>{t("红色：过定义，约束互相冲突（SOLIDWORKS 的配色）", "Red: over-defined, constraints in conflict (SOLIDWORKS colors)")}</span>
    </div>
  )
}

function WidthPredict({ width, onReveal }: { width: number; onReveal: (w: number) => void }) {
  const [[from, to]] = React.useState(() => [width, width >= 90 ? 60 : 90] as const)
  return (
    <Predict
      question={t(`把草图1 的宽度从 ${from} 改成 ${to}，拉伸1 会怎样？`, `Change Sketch1's width from ${from} to ${to}. What happens to Extrude1?`)}
      options={byLocale(
        ["不变，需要重新拉伸一次", "自动变宽，深度和选项保持不变", "报错，因为拉伸已经做完了"],
        ["Nothing: you have to extrude it again", "It widens on its own and keeps its depth and options", "An error, because the extrude is already done"],
      )}
      answer={1}
      explain={t(
        "改父特征，子特征按原来的规则重新计算：轮廓跟着变，深度、方向、拔模角照旧。这就是「参数化」。",
        "Change a parent feature, and its child is recomputed by its original rules: the profile follows, and the depth, direction and draft angle stay as they were. That is what “parametric” means.",
      )}
      onReveal={() => onReveal(to)}
    />
  )
}

const QUIZ = [
  {
    q: t("一个没有任何约束的圆，有几个自由度？", "How many degrees of freedom does a circle with no constraints have?"),
    options: byLocale(["2 个", "3 个", "4 个"], ["2", "3", "4"]),
    answer: 1,
    explain: t("圆心的横向、纵向位置，加上半径，一共 3 个。", "The center's horizontal and vertical position, plus the radius: 3 in all."),
  },
  {
    q: t("草图线条从蓝色变成黑色，说明什么？", "What does it mean when sketch lines turn from blue to black?"),
    options: byLocale(["它被选中了", "它完全定义了", "它出错了"], ["The sketch is selected", "The sketch is fully defined", "The sketch has an error"]),
    answer: 1,
    explain: t("黑色表示自由度为 0：形状完全由约束和尺寸决定，拖不动。", "Black means 0 degrees of freedom: the constraints and dimensions decide the shape completely, so it can't be dragged."),
  },
  {
    q: t("下面哪个顺序是对的？", "Which order is right?"),
    options: byLocale(
      ["画草图 → 选基准面 → 拉伸 → 加尺寸", "选基准面 → 画草图 → 加约束和尺寸 → 拉伸", "拉伸 → 画草图 → 加尺寸 → 选基准面"],
      [
        "Draw the sketch → pick a datum plane → extrude → add dimensions",
        "Pick a datum plane → draw the sketch → add constraints and dimensions → extrude",
        "Extrude → draw the sketch → add dimensions → pick a datum plane",
      ],
    ),
    answer: 1,
    explain: t("先有参照，再有轮廓；轮廓定义清楚了，再长成实体。", "First the reference, then the profile; once the profile is fully defined, turn it into a solid."),
  },
]

function SceneBadges({ s }: { s: LessonState }) {
  if (s.step >= 1 && s.step <= 4) {
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <div className="flex h-7 items-center gap-1.5 rounded-md border bg-popover px-2 text-small shadow-popover">
          <PenLine className="size-3.5 text-primary" />
          {byLocale(<>草图1 · {PLANE_NAMES.XY} XY</>, <>Sketch1 · {PLANE_NAMES.XY} XY</>)}
        </div>
        {s.drawn && s.step >= 2 && (
          <div
            className={cn(
              "flex h-7 items-center gap-1 rounded-md border bg-popover px-2 text-small tabular shadow-popover",
              s.dof === 0 ? "text-foreground" : "text-primary",
            )}
          >
            {s.dof === 0 ? t("完全定义", "Fully defined") : t(`自由度 ${s.dof}`, `DOF ${s.dof}`)}
          </div>
        )}
      </div>
    )
  }
  if (s.step >= 5) {
    const rows = [
      { icon: <PenLine />, name: t("草图1", "Sketch1"), current: false },
      { icon: <Box />, name: t("拉伸1", "Extrude1"), current: s.step === 5 || s.step === 6 },
    ]
    return (
      <div className="pointer-events-none absolute left-3 top-3 w-44 rounded-lg border bg-popover p-1.5 shadow-popover">
        <div className="px-2 pb-1 pt-0.5 text-caption text-faint-foreground">{t("特征树", "Feature tree")}</div>
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={cn("flex h-7 items-center gap-2 rounded-sm px-2 text-small [&_svg]:size-3.5 [&_svg]:text-muted-foreground", r.current && "bg-selected")}
            style={{ paddingLeft: 8 + i * 12 }}
          >
            {r.icon}
            {r.name}
            {i === 1 && <span className="ml-auto font-mono text-caption tabular text-faint-foreground">{s.depth}</span>}
          </div>
        ))}
      </div>
    )
  }
  return null
}

const lesson: LessonDef<LessonState, SketchToSolid> = {
  id: "sketch-to-solid",
  codes: ["1.1.1", "1.1.3", "1.2.1"],
  title: t("从草图到实体", "From sketch to solid"),
  create: (v, emit) => new SketchToSolid(v, emit),
  steps: STEPS,
  quiz: QUIZ,
  takeaways: byLocale(
    ["基准面是参照，草图画在平面上", "约束管关系，尺寸管大小，自由度为 0 才算完全定义", "特征引用草图：改上游，下游自动重算"],
    [
      "Datum planes are the references, and sketches are drawn on planes",
      "Constraints set relationships, dimensions set sizes, and only at 0 degrees of freedom is a sketch fully defined",
      "Features reference sketches: change something upstream, and everything downstream recomputes",
    ],
  ),
  next: {
    to: "/teardown/mug",
    label: t("马克杯拆解", "Mug teardown"),
    text: t("同样的思路，换成旋转、抽壳和扫掠。", "The same approach, with revolve, shell and sweep."),
  },
  overlay: ({ s }) => <SceneBadges s={s} />,
}

export default lesson
