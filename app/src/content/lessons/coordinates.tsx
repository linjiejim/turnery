import * as React from "react"
import { CircleCheck, CircleDashed, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { CoordinatesScene, type CoordState, type Up } from "./coordinates.scene"
import type { LessonDef } from "./types"

/** 0.1.1 · 0.1.2 「坐标系与视图」: axes, the right-hand rule, navigation, standard views, Z-up vs Y-up. */

function Checklist({ items }: { items: [string, boolean][] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-body">
      {items.map(([text, done]) => (
        <li key={text} className={cn("flex items-center gap-2", done ? "text-foreground" : "text-muted-foreground")}>
          {done ? <CircleCheck className="size-4 text-success" /> : <CircleDashed className="size-4 text-faint-foreground" />}
          {text}
        </li>
      ))}
    </ul>
  )
}

const AXES = [
  { name: "X", line: "stroke-axis-x", text: "fill-axis-x" },
  { name: "Y", line: "stroke-axis-y", text: "fill-axis-y" },
  { name: "Z", line: "stroke-axis-z", text: "fill-axis-z" },
]

/**
 * The lesson's own axis triad, replacing the viewer's (which always shows
 * the site's Z-up world). It follows the model frame, so in Y-up mode the
 * corner indicator agrees with the big arrows.
 */
function ModelTriad({ c }: { c: CoordinatesScene }) {
  const lines = React.useRef<(SVGLineElement | null)[]>([])
  const labels = React.useRef<(SVGTextElement | null)[]>([])
  React.useEffect(
    () =>
      c.onCamera(() => {
        c.screenAxes().forEach((p, i) => {
          lines.current[i]?.setAttribute("x2", String(28 + p.x * 18))
          lines.current[i]?.setAttribute("y2", String(28 + p.y * 18))
          labels.current[i]?.setAttribute("x", String(28 + p.x * 25))
          labels.current[i]?.setAttribute("y", String(28 + p.y * 25 + 4))
        })
      }),
    [c],
  )
  return (
    <svg viewBox="0 0 56 56" className="pointer-events-none absolute bottom-3 left-3 size-14 rounded-md bg-scene" aria-hidden>
      {AXES.map((a, i) => (
        <g key={a.name}>
          <line
            ref={(el) => {
              lines.current[i] = el
            }}
            x1="28"
            y1="28"
            x2="28"
            y2="28"
            className={a.line}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text
            ref={(el) => {
              labels.current[i] = el
            }}
            textAnchor="middle"
            className={cn("text-caption font-semibold", a.text)}
          >
            {a.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

const UP_OPTIONS: { value: Up; label: string }[] = [
  { value: "z", label: t("Z 朝上", "Z up") },
  { value: "y", label: t("Y 朝上", "Y up") },
]

const lesson: LessonDef<CoordState, CoordinatesScene> = {
  id: "coordinates",
  codes: ["0.1.1", "0.1.2"],
  title: t("坐标系与视图", "Coordinate systems and views"),
  create: (v, emit) => new CoordinatesScene(v, emit),
  steps: [
    {
      title: t("三根轴与右手定则", "Three axes and the right-hand rule"),
      body: byLocale(
        <>
          <p>每个零件都有自己的坐标系：一个原点，三根互相垂直的轴。几乎所有 CAD 软件都用同一套颜色：X 红、Y 绿、Z 蓝。</p>
          <p>三根轴的方向不是随便定的，遵守右手定则：右手拇指指向 X，食指指向 Y，中指自然伸出的方向就是 Z。</p>
        </>,
        <>
          <p>Every part has its own coordinate system: an origin and three mutually perpendicular axes. Almost every CAD package colors them the same way: X red, Y green, Z blue.</p>
          <p>The directions of the axes aren't arbitrary. They follow the right-hand rule: point your right thumb along X and your index finger along Y, and your middle finger, held out naturally, points along Z.</p>
        </>,
      ),
      task: { label: t("比一下右手，点出 Z 轴的正方向", "Try it with your right hand, then click the positive Z direction"), done: (s) => s.zFound },
      extra: ({ s }) =>
        s.wrongZ && !s.zFound ? (
          <Hint tone="warning">{t("这边是 −Z。拇指朝红色的 X，食指朝绿色的 Y，中指朝哪边？", "That's −Z. Thumb toward the red X, index finger toward the green Y: which way does your middle finger point?")}</Hint>
        ) : s.zFound ? (
          <Hint>{t("对。Z = X × Y，这三根轴构成一个右手坐标系。", "Right. Z = X × Y: the three axes form a right-handed coordinate system.")}</Hint>
        ) : null,
    },
    {
      title: t("转、移、缩放", "Orbit, pan, zoom"),
      body: byLocale(
        <>
          <p>看 3D 模型只有三个动作：旋转（绕着看的中心转）、平移（把中心挪开）、缩放（拉近拉远）。</p>
          <p>在这里：左键拖动旋转，右键拖动平移，滚轮缩放。转乱了，点视图方块下面的小房子回到等轴测。</p>
        </>,
        <>
          <p>Looking at a 3D model takes only three moves: orbit (turn around the point you're looking at), pan (move that point aside), and zoom (move closer or farther away).</p>
          <p>Here, drag with the left button to orbit, drag with the right button to pan, and scroll to zoom. If you lose your way, click the little house under the view cube to go back to the isometric view.</p>
        </>,
      ),
      task: {
        label: t("转一下、平移一下、缩放一下，再点小房子回到等轴测", "Orbit, pan and zoom once each, then click the little house to go back to isometric"),
        done: (s) => s.orbited && s.panned && s.zoomed && s.backToIso,
      },
      extra: ({ s }) => (
        <Checklist
          items={[
            [t("旋转", "Orbit"), s.orbited],
            [t("平移", "Pan"), s.panned],
            [t("缩放", "Zoom"), s.zoomed],
            [t("回到等轴测", "Back to isometric"), s.backToIso],
          ]}
        />
      ),
      note: t(
        "每个软件的鼠标习惯不同：SOLIDWORKS 中键拖动旋转、Ctrl + 中键平移；Fusion 中键平移、Shift + 中键旋转；Onshape 右键拖动旋转、中键平移。滚轮都是缩放。",
        "Each package uses the mouse its own way. SOLIDWORKS: middle-drag to orbit, Ctrl + middle-drag to pan. Fusion: middle-drag to pan, Shift + middle-drag to orbit. Onshape: right-drag to orbit, middle-drag to pan. In all of them the scroll wheel zooms.",
      ),
    },
    {
      title: t("标准视图", "Standard views"),
      body: byLocale(
        <>
          <p>转来转去容易迷路。右上角的视图方块把常用方向固定下来：前、后、左、右、上、下六个正视图，加上等轴测。点方块的一个面，相机就转到正对那一面的方向。</p>
          <p>视图的名字说的是「站在哪边看」：右视图，就是站在 +X 那一侧往回看。</p>
        </>,
        <>
          <p>Orbiting around, it's easy to get lost. The view cube at the top right pins down the common directions: six straight-on views (Front, Back, Left, Right, Top, Bottom) plus isometric. Click a face of the cube and the camera turns to look squarely at that side.</p>
          <p>A view is named for “where you stand to look”: the right view is what you see standing on the +X side, looking back toward the origin.</p>
        </>,
      ),
      task: { label: t("用视图方块转到右视图", "Use the view cube to go to the right view"), done: (s) => s.atRight },
      extra: ({ c }) => (
        <Predict
          question={t("相机放在 +X 方向、朝原点看过去，看到的是哪个视图？", "The camera sits out along +X, looking toward the origin. Which view is that?")}
          options={byLocale(["前视图", "右视图", "左视图"], ["Front view", "Right view", "Left view"])}
          answer={1}
          explain={t(
            "从 +X 往 −X 看就是右视图。看到的是所有朝 +X 的面：底板的右端面，和立板朝里的那一面。",
            "Looking from +X toward −X gives the right view. You see every face that points +X: the right end of the base, and the inner face of the upright.",
          )}
          onReveal={() => c.view("right")}
        />
      ),
    },
    {
      title: t("用视图找面", "Finding a face with the views"),
      body: byLocale(
        <>
          <p>零件上有一个盲孔，开在某一个面上，从等轴测看不到。</p>
          <p>每个正视图都正对一组朝向相同的面：前视图正对朝 −Y 的面，右视图正对朝 +X 的面。换几个视图，把孔找出来。</p>
          <p>视图方块只露出朝着你的几面。想点「左」或「后」，先把画面转过去一点。</p>
        </>,
        <>
          <p>The part has a blind hole in one of its faces, and you can't see it from the isometric view.</p>
          <p>Each straight-on view looks squarely at the faces that point one way: the front view at faces pointing −Y, the right view at faces pointing +X. Try a few views and find the hole.</p>
          <p>The view cube only shows the faces turned toward you. To click “Left” or “Back”, orbit the view a little first.</p>
        </>,
      ),
      task: { label: t("找到带孔的那个面，在视图里点它", "Find the face with the hole and click it in the view"), done: (s) => s.foundHole },
      extra: ({ s, c }) => (
        <>
          {s.wrongFace && !s.foundHole && (
            <Hint tone="warning">{byLocale(<>这个面朝 {s.wrongFace}，上面没有孔。换个方向看看。</>, <>This face points {s.wrongFace} and has no hole. Look from another direction.</>)}</Hint>
          )}
          {s.foundHole && (
            <Hint>
              {t(
                "找到了。这个面朝 −X，只有左视图能正对它。在前视图和上视图里，这个孔被挡住，工程图上要画成虚线。",
                "Found it. This face points −X, so only the left view looks straight at it. In the front and top views the hole is hidden, and a drawing shows it with dashed hidden lines.",
              )}
            </Hint>
          )}
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.view("iso")}>
            {t("回到等轴测", "Back to isometric")}
          </Button>
        </>
      ),
    },
    {
      title: t("Z 朝上，还是 Y 朝上", "Z up, or Y up?"),
      body: byLocale(
        <>
          <p>零件放在桌上，「上」是哪根轴，各家软件的约定不同。Onshape、Fusion、Rhino、NX、build123d 默认 Z 朝上；SOLIDWORKS 默认 Y 朝上。</p>
          <p>切换看看：零件没动，坐标轴转了 90°。水平的那块「上视基准面」从 XY 变成了 XZ。</p>
        </>,
        <>
          <p>With a part sitting on a table, which axis is “up” depends on the software's convention. Onshape, Fusion, Rhino, NX and build123d are Z-up by default; SOLIDWORKS is Y-up.</p>
          <p>Switch and see: the part stays put while the axes turn 90°. The horizontal “Top plane” changes from XY to XZ.</p>
        </>,
      ),
      task: { label: t("切到 Y 朝上，再用视图方块看一次「上」", "Switch to Y up, then use the view cube to look from “Top”"), done: (s) => s.triedY && s.topInY },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Segmented size="sm" aria-label={t("向上轴", "Up axis")} value={s.up} onValueChange={(u) => c.setUp(u)} options={UP_OPTIONS} />
            <Button size="sm" variant="secondary" onClick={() => c.view("top")}>
              <Eye />
              {t("看上视", "Look from the top")}
            </Button>
          </div>
          {s.topInY && (
            <Hint>
              {t(
                "Y 朝上时，从上往下看到的是 XZ 平面。教程说「在上视基准面上画草图」，换一个软件，可能是另一对轴。",
                "With Y up, looking down from the top shows the XZ plane. When a tutorial says “sketch on the Top plane”, in another package that may be a different pair of axes.",
              )}
            </Hint>
          )}
        </>
      ),
      note: t(
        "Fusion 新建设计默认 Z 朝上，可以在首选项「常规 › 默认建模方向」里改成 Y 朝上，只影响之后新建的设计。早期的 Fusion 默认 Y 朝上，跟老教程做时先对一下。导入别的软件的模型时，零件如果「躺倒」了，多半是两边的向上轴不一样。",
        "New Fusion designs are Z-up by default. You can switch to Y-up in Preferences under “General › Default modeling orientation”; it only affects designs you create afterward. Early versions of Fusion were Y-up by default, so check this before you follow an old tutorial. If a model imported from another package comes in “lying down”, the two packages most likely use different up axes.",
      ),
    },
  ],
  quiz: [
    {
      q: t("X 轴朝右、Z 轴朝上，按右手定则，Y 轴朝哪？", "X points right and Z points up. By the right-hand rule, which way does Y point?"),
      options: byLocale(["朝屏幕外，指向你", "朝屏幕里，远离你", "朝下"], ["Out of the screen, toward you", "Into the screen, away from you", "Down"]),
      answer: 1,
      explain: t(
        "拇指朝右（X）、中指朝上（Z），食指就指向屏幕里面。这正是 Z 朝上软件的前视图：Y 轴指向远处。",
        "Thumb right (X), middle finger up (Z): your index finger points into the screen. That is exactly the front view in a Z-up package, with the Y axis pointing away from you.",
      ),
    },
    {
      q: t("在 SOLIDWORKS 里新建零件，水平的「上视基准面」是哪个平面？", "In a new SOLIDWORKS part, which plane is the horizontal “Top Plane”?"),
      options: byLocale(["XY 平面", "XZ 平面", "YZ 平面"], ["The XY plane", "The XZ plane", "The YZ plane"]),
      answer: 1,
      explain: t(
        "SOLIDWORKS 默认 Y 轴朝上，水平面是 XZ，前视基准面才是 XY。在 Onshape 这类 Z 朝上的软件里，上视基准面是 XY。",
        "SOLIDWORKS is Y-up by default, so the horizontal plane is XZ, and it's the Front Plane that is XY. In a Z-up package such as Onshape, the Top plane is XY.",
      ),
    },
    {
      q: t(
        "一个在 Onshape 里立着的零件，导进 SOLIDWORKS 后看起来「躺倒」了。最可能的原因是？",
        "A part that stands upright in Onshape looks like it's “lying down” once imported into SOLIDWORKS. What's the most likely cause?",
      ),
      options: byLocale(
        ["文件转换时损坏了", "两边的向上轴不同：原来朝上的 +Z，在 Y 朝上的软件里指向前方", "单位从毫米变成了英寸"],
        ["The file was damaged in translation", "The two use different up axes: the +Z that pointed up points toward the front in a Y-up package", "The units changed from millimeters to inches"],
      ),
      answer: 1,
      explain: t(
        "坐标值没变，变的是对「上」的约定。原来的 +Z 在 Y 朝上的软件里指向屏幕外，零件就像仰面躺下了。导入时选好向上轴，或者转 90° 摆正即可。",
        "The coordinates didn't change; the convention for “up” did. In a Y-up package the old +Z points out of the screen, so the part looks as if it's lying on its back. Choose the up axis when you import, or rotate the part 90° to stand it up.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "X 红、Y 绿、Z 蓝，三根轴的方向由右手定则决定",
      "视图名说的是从哪一侧看：右视图从 +X 往回看，正对朝 +X 的面",
      "Z 朝上还是 Y 朝上因软件而异，「上视基准面」可能是 XY，也可能是 XZ",
    ],
    [
      "X is red, Y green, Z blue, and the right-hand rule sets which way each axis points",
      "A view is named for the side you look from: the right view looks back from +X, straight at the faces that point +X",
      "Z-up or Y-up depends on the software, so the “Top plane” can be XY or XZ",
    ],
  ),
  next: {
    to: "/lesson/datum-planes",
    label: t("基准面", "Datum planes"),
    text: t("有了坐标系，再看建模的第一块参照。", "With the coordinate system in place, meet the first reference you model from."),
  },
  triad: false,
  overlay: ({ s, c }) => (
    <>
      {s.step === 4 && (
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
          <SceneChip tone="primary">{s.up === "z" ? t("Z 朝上 · Onshape、Fusion、NX", "Z up · Onshape, Fusion, NX") : t("Y 朝上 · SOLIDWORKS 默认", "Y up · SOLIDWORKS default")}</SceneChip>
        </div>
      )}
      <ModelTriad c={c} />
    </>
  ),
}

export default lesson
