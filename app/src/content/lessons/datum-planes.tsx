import * as React from "react"
import { Crosshair, PenLine, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { DatumPlanesScene, PLANE_NAMES, type DatumState, type PlaneId } from "./datum-planes.scene"
import type { LessonDef } from "./types"

/** 0.1.3 「基准面」: default planes, offset, angle, mid-plane, and a sketch that follows its datum. */

const PLANE_TEXT: Record<PlaneId, string> = byLocale(
  {
    XY: "水平的那块。零件的底面轮廓、俯视形状常画在这里。",
    XZ: "竖直，正对前方。零件的正面轮廓、回转体的半截面常画在这里。",
    YZ: "竖直，朝向右侧。零件的侧面轮廓画在这里。",
  },
  {
    XY: "The horizontal one. The outline of a part's base, or its shape seen from above, usually goes here.",
    XZ: "Vertical, facing the front. A part's front outline, or the half cross-section of a revolved part, usually goes here.",
    YZ: "Vertical, facing the right. A part's side outline goes here.",
  },
)

type Row = { icon: React.ReactNode; name: string; value?: string; depth?: number; current?: boolean }

function DatumTree({ s }: { s: DatumState }) {
  const rows: Row[] = [
    { icon: <Crosshair />, name: t("原点", "Origin") },
    { icon: <Square />, name: t("上视基准面", "Top plane"), current: s.step === 0 && s.lastClicked === "XY" },
    { icon: <Square />, name: t("前视基准面", "Front plane"), current: s.step === 0 && s.lastClicked === "XZ" },
    { icon: <Square />, name: t("右视基准面", "Right plane"), current: s.step === 0 && s.lastClicked === "YZ" },
  ]
  if (s.step >= 1) rows.push({ icon: <Square />, name: t("基准面1", "Plane1"), value: `${s.offset}`, current: s.step === 1 })
  if (s.step >= 2) rows.push({ icon: <PenLine />, name: t("草图1", "Sketch1"), depth: 1, current: s.step === 2 })
  if (s.step >= 3) rows.push({ icon: <Square />, name: t("基准面2", "Plane2"), value: `${s.angle}°`, current: s.step === 3 })
  if (s.step >= 4 && s.picked.length === 2) rows.push({ icon: <Square />, name: t("基准面3", "Plane3"), value: t("中面", "Mid-plane"), current: true })
  return (
    <div className="pointer-events-none absolute left-3 top-3 w-48 rounded-lg border bg-popover p-1.5 shadow-popover">
      <div className="px-2 pb-1 pt-0.5 text-caption text-faint-foreground">{t("特征树", "Feature tree")}</div>
      {rows.map((r) => (
        <div
          key={r.name}
          className={cn("flex h-7 items-center gap-2 rounded-sm px-2 text-small [&_svg]:size-3.5 [&_svg]:text-muted-foreground", r.current && "bg-selected")}
          style={{ paddingLeft: 8 + (r.depth ?? 0) * 14 }}
        >
          {r.icon}
          {r.name}
          {r.value && <span className="ml-auto font-mono text-caption tabular text-faint-foreground">{r.value}</span>}
        </div>
      ))}
    </div>
  )
}

const lesson: LessonDef<DatumState, DatumPlanesScene> = {
  id: "datum-planes",
  codes: ["0.1.3"],
  title: t("基准面：一切几何的参照", "Datum planes: the reference for all geometry"),
  create: (v, emit) => new DatumPlanesScene(v, emit),
  steps: [
    {
      title: t("三个默认基准面", "The three default datum planes"),
      body: byLocale(
        <>
          <p>新建一个零件，软件先给你一个原点和三个互相垂直的基准面。它们其实是无限大的平面，只是画成了方块。</p>
          <p>后面所有的草图和特征，追根溯源都挂在它们上面。它们删不掉，也不会因为改模型而移动，是最稳的参照。</p>
        </>,
        <>
          <p>When you start a new part, the software first gives you an origin and three mutually perpendicular datum planes. They are really infinite planes, only drawn as squares.</p>
          <p>Every sketch and feature you add later traces back to them. You can't delete them, and changing the model never moves them, so they are the most stable references you have.</p>
        </>,
      ),
      task: { label: t("在视图里把三个基准面各点一下", "Click each of the three planes once in the view"), done: (s) => s.clicked.length === 3 },
      extra: ({ s }) =>
        s.lastClicked ? (
          <Hint>
            <span className="font-medium">
              {PLANE_NAMES[s.lastClicked]} {s.lastClicked}
              {t("：", ": ")}
            </span>
            {PLANE_TEXT[s.lastClicked]}
          </Hint>
        ) : null,
      note: t(
        "SOLIDWORKS 默认 Y 轴朝上，它的上视基准面是 XZ、前视基准面是 XY。名字相同，对应的轴不同。",
        "SOLIDWORKS is Y-up by default, so its Top Plane is XZ and its Front Plane is XY. Same names, different axes.",
      ),
      terms: ["plane"],
    },
    {
      title: t("偏移：平行挪一段距离", "Offset: parallel, a set distance away"),
      body: byLocale(
        <>
          <p>最常用的新基准面是偏移基准面：和参考面平行，隔开一段距离。比如要在离底面 30 mm 高的地方画一个截面。</p>
          <p>拖动左下角的蓝点，把基准面1 从上视基准面往上推。尺寸随时显示它离参考面多远。</p>
        </>,
        <>
          <p>The most common new datum plane is an offset plane: parallel to a reference plane, a set distance away. You'd use one to draw a cross-section 30 mm above the base, for example.</p>
          <p>Drag the blue point at the lower left to push Plane1 up from the Top plane. The dimension always shows how far it is from the reference.</p>
        </>,
      ),
      task: { label: t("把基准面1 推到离上视基准面 30 mm", "Push Plane1 to 30 mm from the Top plane"), done: (s) => s.offsetDragged && s.offset === 30 },
      extra: ({ s, c }) => <ParamSlider className="mt-3 px-0" label={t("偏移距离", "Offset distance")} value={s.offset} min={5} max={80} onChange={(v) => c.setOffset(v)} />,
      terms: ["plane"],
    },
    {
      title: t("草图跟着基准面走", "The sketch goes where its plane goes"),
      body: byLocale(
        <>
          <p>在基准面1 上画了一个圆，叫草图1。草图记住的是「我画在基准面1 上」，不是「我在某个高度」。</p>
        </>,
        <>
          <p>A circle has been drawn on Plane1; it's called Sketch1. What the sketch remembers is “I'm drawn on Plane1”, not “I'm at a certain height”.</p>
        </>,
      ),
      task: { label: t("改一次基准面1 的偏移距离", "Change Plane1's offset distance once"), done: (s) => s.sketchMoved },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把基准面1 再往上移 20 mm，草图1 会怎样？", "Move Plane1 up another 20 mm. What happens to Sketch1?")}
            options={byLocale(["留在原来的高度", "跟着基准面1 一起上移 20 mm", "报错，需要重画草图"], ["It stays at the old height", "It moves up 20 mm along with Plane1", "An error: the sketch has to be redrawn"])}
            answer={1}
            explain={t(
              "草图引用的是基准面1。参照动了，草图跟着动，用这个草图做的特征也会跟着重算。",
              "The sketch references Plane1. When the reference moves, the sketch moves with it, and the features built from the sketch are recomputed too.",
            )}
            onReveal={() => c.moveOffsetBy(20)}
          />
          <ParamSlider className="mt-4 px-0" label={t("基准面1 · 偏移", "Plane1 · offset")} value={s.offset} min={5} max={80} onChange={(v) => c.setOffset(v)} />
        </>
      ),
      noteTitle: t("设计意图", "Design intent"),
      note: t(
        "草图也能直接画在模型表面上。但表面可能在后面的修改里被切掉、分成两块，草图就丢了参照，软件会报「参照丢失」。关键的草图挂在基准面上，模型怎么改都找得到。",
        "You can also sketch straight on a model face. But a later change may cut that face away or split it in two; then the sketch loses its reference, and the software reports a missing reference. Put key sketches on datum planes, and they can find their reference however the model changes.",
      ),
      terms: ["plane", "sketch"],
    },
    {
      title: t("角度：绕一根轴转", "Angle: turned about an axis"),
      body: byLocale(
        <>
          <p>斜面上的孔、倾斜的筋，需要一个斜着的基准面。做法是选一根轴（或一条直边），再给出和参考面的夹角。</p>
          <p>这里的基准面2 过 X 轴，和上视基准面成一个角度。拖动蓝点，或者直接输入角度。</p>
        </>,
        <>
          <p>A hole in a sloping face, or a slanted rib, needs an angled datum plane. To make one, pick an axis (or a straight edge) and give the angle to a reference plane.</p>
          <p>Here Plane2 passes through the X axis at an angle to the Top plane. Drag the blue point, or type in the angle.</p>
        </>,
      ),
      task: { label: t("把基准面2 调到 30°", "Set Plane2 to 30°"), done: (s) => s.angleTouched && s.angle === 30 },
      extra: ({ s, c }) => (
        <ParamSlider className="mt-3 px-0" label={t("与上视基准面的夹角", "Angle to the Top plane")} unit="°" value={s.angle} min={0} max={90} onChange={(v) => c.setAngle(v)} />
      ),
      terms: ["plane"],
    },
    {
      title: t("中面：两个面的正中间", "Mid-plane: exactly halfway between two faces"),
      body: byLocale(
        <>
          <p>左右对称的零件，最好有一个永远在正中间的平面，镜像和对称约束都以它为参照。</p>
          <p>选两个平行的面，软件就在它们正中间建一个中面。之后零件变宽变窄，中面始终居中。</p>
        </>,
        <>
          <p>A part that's symmetric left to right is best given a plane that always stays exactly in the middle, as the reference for mirrors and symmetric constraints.</p>
          <p>Pick two parallel faces, and the software builds a mid-plane exactly halfway between them. When the part later gets wider or narrower, the mid-plane stays centered.</p>
        </>,
      ),
      task: {
        label: t("点选方块左右两个端面生成中面，再改一次宽度", "Click the block's left and right end faces to make a mid-plane, then change the width once"),
        done: (s) => s.picked.length === 2 && s.widthChanged,
      },
      extra: ({ s, c }) =>
        s.picked.length < 2 ? (
          <Hint>
            {s.picked.length === 0
              ? t("先点方块的一个端面（朝 −X 或 +X 的那面）。", "First click one end face of the block (the one facing −X or +X).")
              : t("视图转过来了，再点另一个端面。", "The view has turned around. Now click the other end face.")}
          </Hint>
        ) : (
          <>
            <ParamSlider className="mt-3 px-0" label={t("方块宽度", "Block width")} value={s.width} min={30} max={90} onChange={(v) => c.setWidth(v)} />
            {s.widthChanged && (
              <Hint>{t("宽度变了，中面两侧仍然各占一半。用固定距离偏移出来的平面做不到这一点。", "The width changed, and the mid-plane still splits it in half. A plane offset by a fixed distance can't do that.")}</Hint>
            )}
          </>
        ),
      terms: ["plane", "mirror"],
    },
  ],
  quiz: [
    {
      q: t("为什么关键的草图最好画在基准面上，而不是模型表面上？", "Why are key sketches better drawn on datum planes than on model faces?"),
      options: byLocale(
        ["基准面上画得更快", "模型表面可能在后面的修改中消失或被分开，草图会丢参照；基准面更稳定", "模型表面上不能画草图"],
        [
          "Sketching on a datum plane is faster",
          "A later change can make a model face disappear or split it, and the sketch loses its reference; a datum plane is more stable",
          "You can't sketch on a model face",
        ],
      ),
      answer: 1,
      explain: t(
        "表面是特征算出来的结果，上游一改就可能变。基准面只依赖原点和你给的尺寸，改模型时最不容易出问题。",
        "A face is the result of computing the features, so it can change whenever something upstream does. A datum plane depends only on the origin and the dimensions you give it, so it's the least likely to cause trouble when the model changes.",
      ),
    },
    {
      q: t(
        "基准面1 偏移上视基准面 30 mm，草图1 画在它上面。把偏移改成 50 mm，草图1 在哪？",
        "Plane1 is offset 30 mm from the Top plane, and Sketch1 is drawn on it. You change the offset to 50 mm. Where is Sketch1 now?",
      ),
      options: byLocale(["还在 30 mm 处", "在 50 mm 处", "被删除了"], ["Still at 30 mm", "At 50 mm", "Deleted"]),
      answer: 1,
      explain: t("草图引用基准面，基准面移到 50 mm，草图跟着到 50 mm。", "The sketch references the plane: when the plane moves to 50 mm, the sketch follows it to 50 mm."),
    },
    {
      q: t(
        "一个左右对称的零件，宽度以后还会改。镜像特征最好以什么为镜像面？",
        "A part is symmetric left to right, and its width will change later. What should a mirror feature use as its mirror plane?",
      ),
      options: byLocale(
        ["零件的左端面", "两个端面之间的中面", "从右视基准面偏移 30 mm 的平面"],
        ["The part's left end face", "The mid-plane between the two end faces", "A plane offset 30 mm from the Right plane"],
      ),
      answer: 1,
      explain: t(
        "中面始终在正中间，宽度怎么改都对称。固定偏移的平面在宽度改变后就不居中了；以端面为镜像面，会把特征镜像到零件外面去。",
        "The mid-plane always stays in the middle, so the part stays symmetric however the width changes. A plane at a fixed offset is off center once the width changes, and mirroring about an end face puts the copy outside the part.",
      ),
    },
  ],
  takeaways: byLocale(
    ["原点和三个默认基准面是最稳的参照", "新基准面的三种常见建法：偏移、过轴成角度、两面中间", "草图挂在基准面上：基准面一动，草图和后续特征跟着动"],
    [
      "The origin and the three default datum planes are the most stable references",
      "Three common ways to make a new datum plane: offset, through an axis at an angle, and midway between two faces",
      "Sketches hang on datum planes: move the plane, and the sketch and the features after it move too",
    ],
  ),
  next: {
    to: "/lesson/projection",
    label: t("正投影与三视图", "Orthographic projection and three views"),
    text: t("三维的零件怎么画成二维的图纸。", "How a 3D part becomes a 2D drawing."),
  },
  overlay: ({ s }) => <DatumTree s={s} />,
}

export default lesson
