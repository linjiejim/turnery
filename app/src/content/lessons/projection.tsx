import { Layers, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { ProjectionScene, viewName, type Angle, type ProjState } from "./projection.scene"
import type { LessonDef } from "./types"

/** 0.2.1 · 0.2.2 「正投影」: glass box, hidden lines, unfolding, first vs third angle. */

const ANGLE_OPTIONS: { value: Angle; label: string }[] = [
  { value: "first", label: t("第一角 · GB", "First angle · GB") },
  { value: "third", label: t("第三角 · ASME", "Third angle · ASME") },
]

/**
 * The projection symbol: a truncated cone (small end on the left) and its
 * end view seen from the small end. First angle puts the circles on the
 * right of the cone, third angle on the left.
 */
function ProjectionSymbol({ angle }: { angle: Angle }) {
  const cone = (x: number) => `${x},9 ${x + 20},4 ${x + 20},24 ${x},19`
  const coneX = angle === "first" ? 4 : 34
  const cx = angle === "first" ? 46 : 14
  return (
    <svg viewBox="0 0 60 28" className="h-10 w-20 text-foreground" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <polygon points={cone(coneX)} strokeLinejoin="round" />
      <circle cx={cx} cy="14" r="10" />
      <circle cx={cx} cy="14" r="5" />
      <g strokeWidth="0.6" strokeDasharray="5 1.5 1 1.5">
        <line x1="1" y1="14" x2="59" y2="14" />
        <line x1={cx} y1="1" x2={cx} y2="27" />
      </g>
    </svg>
  )
}

function Symbols({ angle }: { angle: Angle }) {
  const items: { a: Angle; title: string; text: string }[] = [
    {
      a: "first",
      title: t("第一角画法", "First-angle projection"),
      text: t("圆在右，圆台小头背着圆。GB 国标优先。", "Circles on the right; the cone's small end points away from them. Preferred by GB."),
    },
    {
      a: "third",
      title: t("第三角画法", "Third-angle projection"),
      text: t("圆在左，圆台小头朝着圆。ASME、多数英文教程。", "Circles on the left; the cone's small end points toward them. ASME and most English tutorials."),
    },
  ]
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {items.map((it) => (
        <div key={it.a} className={cn("rounded-lg border p-2.5 transition-colors duration-(--duration-fast)", angle === it.a && "border-primary bg-selected")}>
          <ProjectionSymbol angle={it.a} />
          <div className="mt-1.5 text-small font-medium">{it.title}</div>
          <div className="text-caption text-muted-foreground">{it.text}</div>
        </div>
      ))}
    </div>
  )
}

const lesson: LessonDef<ProjState, ProjectionScene> = {
  id: "projection",
  codes: ["0.2.1", "0.2.2"],
  title: t("正投影：三视图与第一角、第三角", "Orthographic projection: three views, first and third angle"),
  create: (v, emit) => new ProjectionScene(v, emit),
  steps: [
    {
      title: t("玻璃盒里的零件", "A part in a glass box"),
      body: byLocale(
        <>
          <p>工程图用正投影：一束互相平行的投射线垂直打在投影面上，把零件「压扁」成一张平面图。每个视图只能反映三个方向里的两个。</p>
          <p>把零件放进一个盒子，盒子的面就是投影面。国标用第一角画法：零件在你和投影面之间，轮廓投到它后面、下面和右侧的三块面上。</p>
        </>,
        <>
          <p>
            Engineering drawings use orthographic projection: parallel projection lines strike the plane of projection at right angles and “flatten” the part into a flat picture. Each view shows only two of the three
            directions.
          </p>
          <p>
            Put the part inside a box: the faces of the box are the planes of projection. GB uses first-angle projection: the part sits between you and the plane of projection, and its outline is projected onto the three
            faces behind it, below it and to its right.
          </p>
        </>,
      ),
      task: { label: t("点「投影」，看棱线怎么压到三个面上", "Click “Project” and watch the edges flatten onto the three faces"), done: (s) => s.projected },
      extra: ({ s, c }) => (
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.projected} onClick={() => c.project()}>
          <Layers />
          {t("投影", "Project")}
        </Button>
      ),
    },
    {
      title: t("看不见的线画虚线", "Hidden lines are dashed"),
      body: byLocale(
        <>
          <p>投影时，被挡住的轮廓也要画出来，只是改用细虚线；看得见的轮廓用粗实线。这样一张图就能交代零件背后和内部的形状。</p>
          <p>底板上有一个竖直的通孔，从前面看，它被底板挡住了。</p>
        </>,
        <>
          <p>
            Outlines that are hidden from view are drawn too, but as thin dashed lines; visible outlines are thick continuous lines. That way one drawing can show the shape at the back of the part and inside it.
          </p>
          <p>The base has a vertical through hole. Seen from the front, the base hides it.</p>
        </>,
      ),
      task: { label: t("先猜，再看主视图里的孔", "Guess first, then look at the hole in the front view"), done: (s) => s.xray },
      extra: ({ c }) => (
        <Predict
          question={t("底板上的通孔，在主视图里画成什么样？", "How is the through hole in the base drawn in the front view?")}
          options={byLocale(["一个圆", "两条竖直的虚线", "不画，因为看不见"], ["A circle", "Two vertical dashed lines", "It isn't drawn, because you can't see it"])}
          answer={1}
          explain={t(
            "从前面看，孔被底板挡住。孔壁最左和最右的两条轮廓线投到主视图上，是两条竖直的细虚线；只有俯视图正对着孔，画成圆。",
            "Seen from the front, the base hides the hole. The leftmost and rightmost outlines of the hole's wall project into the front view as two vertical thin dashed lines. Only the top view looks straight down the hole, so only there is it drawn as a circle.",
          )}
          onReveal={() => c.xray()}
        />
      ),
    },
    {
      title: t("把盒子摊平", "Unfold the box"),
      body: byLocale(
        <>
          <p>三块投影面不在同一个平面上，没法画在一张纸上。于是把它们摊平：正对你的主视图不动，另外两块绕着和它相交的那条棱翻转 90°。</p>
        </>,
        <>
          <p>
            The three planes of projection don't lie in one plane, so they can't be drawn on one sheet. So you unfold them: the front view, facing you, stays put, and the other two each swing 90° about the edge they share
            with it.
          </p>
        </>,
      ),
      task: { label: t("把盒子完全展开", "Unfold the box all the way"), done: (s) => s.unfold >= 1 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("按国标的第一角画法展开，俯视图会落在主视图的哪一边？", "Unfolded in GB's first-angle projection, where does the top view end up relative to the front view?")}
            options={byLocale(["上方", "下方", "右边"], ["Above it", "Below it", "To its right"])}
            answer={1}
            explain={t(
              "第一角画法里，俯视图投在零件下方的那块面上。这块面向下翻平，俯视图就落在主视图正下方；右边那块面上是左视图。",
              "In first-angle projection, the top view is projected onto the face below the part. Fold that face down flat and the top view lands directly below the front view; the face on the right carries the left view.",
            )}
            onReveal={() => c.unfoldTo(1)}
          />
          <ParamSlider className="mt-4 px-0" label={t("展开", "Unfold")} unit="%" value={Math.round(s.unfold * 100)} min={0} max={100} onChange={(v) => c.setUnfold(v / 100)} />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.unfoldTo(1)}>
            <Play />
            {t("播放展开", "Play the unfolding")}
          </Button>
        </>
      ),
    },
    {
      title: t("长对正、高平齐、宽相等", "Lengths aligned, heights level, widths equal"),
      body: byLocale(
        <>
          <p>展开后，三个视图之间有固定的对应关系：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>主视图和俯视图长对正：左右对齐。</li>
            <li>主视图和左视图高平齐：上下对齐。</li>
            <li>俯视图和左视图宽相等：前后方向的尺寸一样，借 45° 线转过去。</li>
          </ul>
          <p>画图、读图都靠这九个字。</p>
        </>,
        <>
          <p>Once unfolded, the three views are tied together by fixed rules:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Front and top views have their lengths aligned: left-to-right positions match.</li>
            <li>Front and left views have their heights level: top-to-bottom positions match.</li>
            <li>Top and left views have their widths equal: front-to-back sizes are the same, carried across by a 45° line.</li>
          </ul>
          <p>Drawing views and reading them both rest on these three rules.</p>
        </>,
      ),
      task: { label: t("拖动孔的位置，看哪几个视图跟着变", "Drag the hole and watch which views change with it"), done: (s) => s.holeMoved },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把孔往右移，三个视图里哪一个不变？", "Move the hole to the right. Which of the three views doesn't change?")}
            options={byLocale(["主视图", "俯视图", "左视图"], ["Front view", "Top view", "Left view"])}
            answer={2}
            explain={t(
              "孔左右移动只改变它的 X 坐标。左视图顺着 X 方向看，看不出左右位置；主视图和俯视图都反映长度，所以一起变，这就是长对正。",
              "Moving the hole left or right changes only its X coordinate. The left view looks along X, so it can't show left-right position. The front and top views both show length, so they change together: that's “lengths aligned”.",
            )}
            onReveal={() => c.setHoleX(22)}
          />
          <ParamSlider className="mt-4 px-0" label={t("孔的 X 位置", "Hole X position")} value={s.holeX} min={-10} max={22} onChange={(v) => c.setHoleX(v)} />
        </>
      ),
    },
    {
      title: t("第一角与第三角", "First angle and third angle"),
      body: byLocale(
        <>
          <p>国标规定优先用第一角画法，有合同约定等必要时才用第三角（GB/T 14692《技术制图 投影法》）。美国的 ASME 标准用第三角画法：投影面在你和零件之间，像隔着玻璃往里看，俯视图画在主视图上方，右视图画在右边。很多英文教程默认第三角。</p>
          <p>两种画法里每个视图本身一样，只是摆放位置不同。所以图纸上用投影符号说明用的是哪种。按国标，用第三角画法时必须画出符号；用第一角时常省略。</p>
        </>,
        <>
          <p>
            GB prefers first-angle projection and allows third angle only when needed, for example when a contract calls for it (GB/T 14692, Technical drawings: Projection methods). The American ASME standards use third-angle
            projection: the plane of projection sits between you and the part, like looking in through glass. The top view goes above the front view, and the right view to its right. Many English tutorials default to third
            angle.
          </p>
          <p>
            Each view looks the same in both methods; only where it is placed differs. So a drawing carries a projection symbol to say which method it uses. Under GB, the symbol is required with third angle and is often left
            off with first angle.
          </p>
        </>,
      ),
      task: { label: t("切换到第三角，看视图怎么换位置", "Switch to third angle and watch the views change places"), done: (s) => s.triedThird },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3">
            <Segmented size="sm" aria-label={t("投影画法", "Projection method")} value={s.angle} onValueChange={(a) => c.setAngle(a)} options={ANGLE_OPTIONS} />
          </div>
          <Symbols angle={s.angle} />
        </>
      ),
      note: t(
        "SOLIDWORKS 中文版在「图纸属性 › 投影类型」里选「第一视角」或「第三视角」，就是国标说的第一角、第三角画法。默认值跟着工程图模板走，出图前先确认一次。拿到外企图纸，先看投影符号。",
        "In SOLIDWORKS, choose First angle or Third angle under Sheet Properties › Type of projection. The default comes from the drawing template, so check it before you release a drawing. When a drawing comes from another company, especially one abroad, look at its projection symbol first.",
      ),
    },
    {
      title: t("认出俯视图", "Find the top view"),
      body: byLocale(
        <>
          <p>拿到一张图，先看投影符号，再判断每个视图是从哪边看的。视图名字先藏起来了。</p>
        </>,
        <>
          <p>Given a drawing, look at the projection symbol first, then work out which side each view is seen from. The view names are hidden for now.</p>
        </>,
      ),
      task: { label: t("在展开的视图里点出俯视图", "Click the top view in the unfolded layout"), done: (s) => s.foundTop },
      extra: ({ s }) => (
        <>
          {s.clicked && !s.foundTop && (
            <Hint tone="warning">
              {byLocale(
                <>
                  这是{viewName(s.angle, s.clicked)}。{s.angle === "first" ? "第一角画法里，俯视图在主视图下方。" : "第三角画法里，俯视图在主视图上方。"}
                </>,
                <>
                  That's the {viewName(s.angle, s.clicked).toLowerCase()}.{" "}
                  {s.angle === "first" ? "In first-angle projection, the top view is below the front view." : "In third-angle projection, the top view is above the front view."}
                </>,
              )}
            </Hint>
          )}
          {s.foundTop && (
            <Hint>
              {t(
                "对。它和主视图左右对齐（长对正），反映零件的长和宽，孔在这里画成圆。",
                "Right. It lines up with the front view left to right (lengths aligned), shows the part's length and width, and draws the hole as a circle.",
              )}
            </Hint>
          )}
          <div className="mt-3 flex items-center gap-3 text-small text-muted-foreground">
            <ProjectionSymbol angle={s.angle} />
            {t("这张图的投影符号", "This drawing's projection symbol")}
          </div>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("按国标（第一角画法）布置三视图，左视图放在主视图的哪一边？", "Laying out three views to GB (first-angle projection), which side of the front view does the left view go on?"),
      options: byLocale(["左边", "右边", "下方"], ["Left", "Right", "Below"]),
      answer: 1,
      explain: t(
        "从左往右看到的图，投在零件右侧那块面上，展开后在主视图右边。别和第三角混淆：第三角是右视图放在右边。",
        "The view you get looking from the left toward the right is projected onto the face to the right of the part, so after unfolding it sits to the right of the front view. Don't confuse this with third angle, where it's the right view that goes on the right.",
      ),
    },
    {
      q: t("图纸角上的投影符号是：两个同心圆在左，圆台在右。这张图用的是？", "The projection symbol in the corner of a drawing shows two concentric circles on the left and a truncated cone on the right. Which method does the drawing use?"),
      options: byLocale(["第一角画法", "第三角画法", "看不出来"], ["First-angle projection", "Third-angle projection", "You can't tell"]),
      answer: 1,
      explain: t(
        "第三角符号里圆在左、圆台在右，圆台小头朝着圆；第一角的符号正好左右对调。",
        "In the third-angle symbol the circles are on the left and the cone on the right, with the cone's small end pointing toward the circles. The first-angle symbol swaps the two, left for right.",
      ),
    },
    {
      q: t("主视图和俯视图之间应该满足哪个关系？", "Which rule must the front and top views satisfy?"),
      options: byLocale(["高平齐", "长对正", "宽相等"], ["Heights level", "Lengths aligned", "Widths equal"]),
      answer: 1,
      explain: t(
        "主视图和俯视图都反映零件的长度，所以左右对齐，叫长对正。高平齐说的是主视图和左视图，宽相等说的是俯视图和左视图。",
        "The front and top views both show the part's length, so they line up left to right: lengths aligned. Heights level is about the front and left views; widths equal is about the top and left views.",
      ),
    },
  ],
  takeaways: byLocale(
    ["正投影沿平行的投射线把零件压扁：看得见的轮廓画粗实线，看不见的画细虚线", "三视图之间：长对正、高平齐、宽相等", "国标用第一角（俯视图在下、左视图在右），ASME 用第三角（俯视图在上、右视图在右），靠投影符号分辨"],
    [
      "Orthographic projection flattens the part along parallel projection lines: visible outlines are thick continuous lines, hidden ones thin dashed lines",
      "Between the three views: lengths aligned, heights level, widths equal",
      "GB uses first angle (top view below, left view on the right); ASME uses third angle (top view above, right view on the right). The projection symbol tells you which",
    ],
  ),
  next: {
    to: "/lesson/section-views",
    label: t("剖视", "Section views"),
    text: t("孔和空腔在视图里只是虚线，切开来看才清楚。", "In ordinary views, holes and cavities are only dashed lines; cut the part open to see them clearly."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip tone="primary">{s.angle === "first" ? t("第一角画法 · GB", "First-angle projection · GB") : t("第三角画法 · ASME", "Third-angle projection · ASME")}</SceneChip>
      {s.step >= 2 && <SceneChip>{t(`展开 ${Math.round(s.unfold * 100)}%`, `Unfolded ${Math.round(s.unfold * 100)}%`)}</SceneChip>}
    </div>
  ),
}

export default lesson
