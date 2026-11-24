import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { EXACT_W, MAX_COUNT, NurbsScene, curveOf, radiusError, type Degree, type NurbsState } from "./nurbs-curves.scene"
import { knotSpans, spansInfluenced } from "./nurbs-curves.nurbs"
import type { LessonDef, StepCtx } from "./types"

/** 5.1.1 「NURBS 曲线：控制点、阶数、节点」. */
type Ctx = StepCtx<NurbsState, NurbsScene>

const DEGREES: Degree[] = [1, 2, 3, 5]

function DegreeSwitch({ s, c }: Ctx) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("阶数", "Degree")}</span>
      <Segmented
        size="sm"
        aria-label={t("阶数", "Degree")}
        value={String(s.degree)}
        onValueChange={(d) => c.setDegree(Number(d) as Degree)}
        options={DEGREES.map((d) => ({ value: String(d), label: t(`${d} 阶`, `Degree ${d}`) }))}
      />
    </div>
  )
}

function Structure({ s }: { s: NurbsState }) {
  const spans = s.count - s.degree
  return (
    <div className="mt-4 rounded-md bg-sunken px-3 py-2">
      <Readout label={t("控制点", "Control points")} value={s.count} />
      <Readout label={t("阶数", "Degree")} value={s.degree} />
      <Readout label={t("跨度", "Spans")} value={spans} tone="primary" />
      <div className="mt-1 text-small text-muted-foreground">
        {t(`跨度 = 点数 − 阶数 = ${s.count} − ${s.degree} = ${spans}`, `Spans = points − degree = ${s.count} − ${s.degree} = ${spans}`)}
      </div>
    </div>
  )
}

function Reach({ s }: { s: NurbsState }) {
  const c = curveOf(s)
  const total = knotSpans(c).length
  const cont = s.degree === 1 ? "C0" : `C${s.degree - 1}`
  return (
    <div className="mt-4 rounded-md bg-sunken px-3 py-2">
      {s.focus !== null && s.focus < s.count ? (
        <Readout label={t(`P${s.focus} 影响`, `P${s.focus} moves`)} value={`${spansInfluenced(c, s.focus)} / ${total}`} unit={t("个跨度", "spans")} tone="primary" />
      ) : (
        <Readout label={t("跨度", "Spans")} value={total} />
      )}
      <div className="mt-1">
        <Readout label={t("每点最多影响", "Each point moves at most")} value={s.degree + 1} unit={t("个跨度", "spans")} />
      </div>
      <div className="mt-1">
        <Readout label={t("节点处连续", "Continuity at knots")} value={cont} />
      </div>
    </div>
  )
}

function KnotVector({ s }: { s: NurbsState }) {
  const U = curveOf(s).U
  const f = (u: number) => (u === 0 || u === 1 ? String(u) : u.toFixed(2).replace(/^0/, ""))
  return (
    <div className="mt-3 rounded-md bg-sunken px-3 py-2">
      <div className="text-small text-muted-foreground">{t(`节点向量（${U.length} 个 = 点数 + 阶数 + 1）`, `Knot vector (${U.length} values = points + degree + 1)`)}</div>
      <div className="mt-1 font-mono text-caption tabular break-words">{U.map(f).join("  ")}</div>
    </div>
  )
}

function ResetButton({ c }: { c: NurbsScene }) {
  return (
    <Button size="sm" variant="ghost" className="mt-2" onClick={() => c.reset()}>
      <RotateCcw />
      {t("恢复曲线", "Reset the curve")}
    </Button>
  )
}

const lesson: LessonDef<NurbsState, NurbsScene> = {
  id: "nurbs-curves",
  codes: ["5.1.1"],
  title: t("NURBS 曲线：控制点、阶数、节点", "NURBS curves: control points, degree and knots"),
  create: (v, emit) => new NurbsScene(v, emit),
  steps: [
    {
      title: t("控制点拉着曲线走", "Control points pull the curve"),
      body: byLocale(
        <>
          <p>NURBS 曲线由一串控制点决定。曲线不穿过中间的控制点，而是被它们「拉」着走。虚线连成的折线叫控制多边形。</p>
          <p>首尾两点例外。常用的曲线两端是「夹紧」的（clamped）：曲线从首点出发，到末点结束，在端点处和控制多边形的第一段、最后一段相切。</p>
        </>,
        <>
          <p>A NURBS curve is defined by a row of control points. The curve doesn't pass through the inner control points; they pull it towards them. The dashed polyline joining them is the control polygon.</p>
          <p>
            The first and last points are the exception. The ends of the usual curve are “clamped”: the curve starts at the first point and ends at the last one, and at each end it is
            tangent to the first or last leg of the control polygon.
          </p>
        </>,
      ),
      task: { label: t("拖动首点和中间的控制点，看曲线怎样跟着动", "Drag the first point and an inner control point, and watch how the curve follows"), done: (s) => s.dragged },
      extra: ({ c }) => <ResetButton c={c} />,
      note: t(
        "Rhino 用 PointsOn 显示控制点，Curve 命令按控制点画线；SOLIDWORKS 的样条曲线可以显示控制多边形。",
        "In Rhino, PointsOn shows the control points and the Curve command draws by control points; SOLIDWORKS splines can show their control polygon.",
      ),
    },
    {
      title: t("局部控制：只动 阶数 + 1 个跨度", "Local control: only degree + 1 spans move"),
      body: byLocale(
        <>
          <p>曲线由一段段跨度（span）接成，曲线上的细刻线就是跨度之间的分界。</p>
          <p>每个控制点只管它附近的几个跨度。3 阶曲线上，一个点最多影响 4 个跨度，也就是 阶数 + 1。改曲线的一头，另一头纹丝不动：这叫局部控制。靠近两端的点，影响的跨度更少。</p>
        </>,
        <>
          <p>A curve is made of spans joined end to end; the small ticks across the curve mark the boundaries between spans.</p>
          <p>
            Each control point only affects the spans near it. On a degree 3 curve, a point moves at most 4 spans: degree + 1. Change one end of the curve and the other end doesn't budge.
            This is local control. Points near the ends move even fewer spans.
          </p>
        </>,
      ),
      task: { label: t("拖动一个中间的控制点，看高亮的范围", "Drag an inner control point and watch the highlighted range"), done: (s) => s.draggedLocal },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("这条 3 阶曲线有 7 个跨度。把中间一个控制点往上拉，会有几个跨度变形？", "This degree 3 curve has 7 spans. If you pull an inner control point up, how many spans change shape?")}
            options={byLocale(["全部 7 个", "4 个：阶数 + 1", "只有离它最近的 1 个"], ["All 7", "4: degree + 1", "Only the 1 nearest to it"])}
            answer={1}
            explain={t(
              "3 阶曲线上，控制点只在它前后共 4 个跨度里起作用。高亮的是它的影响范围；淡线是拉之前的曲线，其余部分和新曲线完全重合。",
              "On a degree 3 curve, a control point only acts on the 4 spans around it. The highlight shows that range; the faint line is the curve before the pull, and everywhere else it lies exactly on the new curve.",
            )}
            onReveal={() => c.demoLocal()}
          />
          <Reach s={s} />
          <ResetButton c={c} />
        </>
      ),
    },
    {
      title: t("阶数：光顺与局部的取舍", "Degree: smoothness against locality"),
      body: byLocale(
        <>
          <p>阶数（degree）是每个跨度的多项式次数。1 阶是直线段，2 阶是抛物线段，3 阶最常用，外观面常用到 5 阶或更高。</p>
          <p>阶数越高，曲线越光顺，离控制多边形越远；代价是每个点管得更宽，局部控制变弱。</p>
          <p>节点不重复时，跨度之间连续到 阶数 − 1 阶导数：2 阶曲线在节点处曲率会跳（看曲率梳的台阶），3 阶起曲率连续。</p>
        </>,
        <>
          <p>The degree is the polynomial degree of each span. Degree 1 gives straight segments, degree 2 parabolic ones; degree 3 is the most common, and appearance surfaces often use degree 5 or more.</p>
          <p>The higher the degree, the smoother the curve and the further it sits from the control polygon. The price is that each point reaches further, so control becomes less local.</p>
          <p>
            With no repeated knots, spans join with continuous derivatives up to degree − 1: a degree 2 curve's curvature jumps at the knots (look for steps in the comb), and from degree 3
            on the curvature is continuous.
          </p>
        </>,
      ),
      task: { label: t("四种阶数都试一遍，看曲率梳和高亮范围", "Try all four degrees and watch the comb and the highlighted range"), done: (s) => DEGREES.every((d) => s.tried.includes(d)) },
      extra: (ctx) => (
        <>
          <Predict
            question={t("控制点不动，把 3 阶换成 5 阶，曲线会怎样？", "With the control points left alone, what happens when you switch from degree 3 to degree 5?")}
            options={byLocale(
              ["更贴近控制多边形", "更光顺、离控制多边形更远，每个点管得更宽", "形状不变，只是计算更精确"],
              ["It hugs the control polygon more closely", "It gets smoother and moves away from the polygon, and each point reaches further", "The shape stays the same; it's just computed more precisely"],
            )}
            answer={1}
            explain={t(
              "高阶曲线的每一点由更多控制点加权平均而来，所以更平滑，也更「懒得」贴近某一个点。每个点影响 6 个跨度，高亮范围变宽了。",
              "Each point of a higher-degree curve is a weighted average of more control points, so it is smoother and less inclined to follow any single point. Each point now moves 6 spans, and the highlighted range is wider.",
            )}
            onReveal={() => ctx.c.setDegree(5)}
          />
          <DegreeSwitch {...ctx} />
          <Reach s={ctx.s} />
          <ParamSlider
            className="mt-3 px-0"
            label={t("梳齿长度倍数", "Comb scale")}
            unit=""
            value={ctx.s.combScale}
            min={200}
            max={2000}
            step={50}
            onChange={(v) => ctx.c.setCombScale(v)}
            hint={t("只改显示比例，不改曲线。", "Changes only how the comb is drawn, not the curve.")}
          />
        </>
      ),
    },
    {
      title: t("节点与点数", "Knots and point count"),
      body: byLocale(
        <>
          <p>跨度的分界叫节点（knot），全部节点按顺序排成节点向量。这里的节点均匀分布，两端各重复 阶数 + 1 次，曲线就被「夹」在首尾两点上。</p>
          <p>点数、阶数、跨度之间有固定关系：跨度数 = 控制点数 − 阶数。所以最少要 阶数 + 1 个点。正好这么多时只有一个跨度：这就是一条 Bézier 曲线。</p>
        </>,
        <>
          <p>
            The boundaries between spans are knots, and all the knots in order make up the knot vector. Here the knots are evenly spaced, and each end repeats degree + 1 times; that is
            what clamps the curve to its first and last points.
          </p>
          <p>
            Points, degree and spans are tied together: spans = control points − degree. So you need at least degree + 1 points. With exactly that many there is a single span, and that
            is a Bézier curve.
          </p>
        </>,
      ),
      task: { label: t("把点数减到最少，得到只有 1 个跨度的曲线", "Cut the point count to the minimum, leaving a curve with a single span"), done: (s) => s.single },
      extra: (ctx) => (
        <>
          <DegreeSwitch {...ctx} />
          <ParamSlider
            className="mt-3 px-0"
            label={t("控制点数", "Control points")}
            unit=""
            value={ctx.s.count}
            min={ctx.s.degree + 1}
            max={MAX_COUNT}
            onChange={(v) => ctx.c.setCount(v)}
            hint={t(`最少 ${ctx.s.degree + 1} 个（阶数 + 1）。改点数会重新生成控制点。`, `At least ${ctx.s.degree + 1} (degree + 1). Changing the count regenerates the points.`)}
          />
          <Structure s={ctx.s} />
          <KnotVector s={ctx.s} />
        </>
      ),
      note: t(
        "Rhino 存的节点比这里少首尾各一个（点数 + 阶数 − 1 个），读写 IGES 等格式时自动补上或去掉；多数教材和其他软件用 点数 + 阶数 + 1 个。",
        "Rhino stores one knot fewer at each end (points + degree − 1 in all) and adds or drops them automatically when reading and writing formats such as IGES; most textbooks and other packages use points + degree + 1.",
      ),
    },
    {
      title: t("编辑点：曲线上的点", "Edit points: points on the curve"),
      body: byLocale(
        <>
          <p>控制点在曲线外面，编辑点（菱形）在曲线上。Rhino 给每个控制点配一个编辑点，位置由节点的平均值（Greville 点）算出。</p>
          <p>拖编辑点，曲线就穿过你放的位置，其余编辑点不动。代价是软件要反算控制点：一个编辑点会牵动好几个控制点，有的还往反方向走，曲线容易出现小起伏。</p>
          <p>所以：要修形，优先拖控制点；要让曲线经过某个确定的位置，才用编辑点。</p>
        </>,
        <>
          <p>Control points sit off the curve; edit points (the diamonds) sit on it. Rhino gives each control point an edit point, placed at the average of nearby knots (a Greville point).</p>
          <p>
            Drag an edit point and the curve passes through where you put it, while the other edit points stay put. The price is that the software has to work the control points out
            again: one edit point pulls on several control points, some of which move the opposite way, and small ripples creep into the curve.
          </p>
          <p>So to reshape a curve, prefer control points; use edit points when the curve has to pass through a definite position.</p>
        </>,
      ),
      task: { label: t("拖动一个编辑点", "Drag an edit point"), done: (s) => s.draggedEdit },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把中间一个编辑点往上拉 20 mm，控制点会怎么动？", "If you pull an inner edit point up 20 mm, how do the control points move?")}
            options={byLocale(
              ["只有对应的那一个控制点动", "附近好几个控制点一起动，离得越远动得越少", "所有控制点一起平移 20 mm"],
              ["Only its own control point moves", "Several nearby control points move, less the further away they are", "All the control points shift up 20 mm"],
            )}
            answer={1}
            explain={t(
              "其余编辑点要留在原地，只能反算一组控制点来满足。影响随距离衰减，相邻的点还可能反向移动。带光环的是动过的控制点。",
              "The other edit points have to stay where they are, so a whole set of control points is solved for. The effect fades with distance, and neighbouring points may move the opposite way. The control points with a ring around them are the ones that moved.",
            )}
            onReveal={() => c.demoEdit()}
          />
          <div className="mt-4 rounded-md bg-sunken px-3 py-2">
            <Readout label={t("这次动了", "This drag moved")} value={s.moved} unit={t(`个控制点（共 ${s.count} 个）`, `of ${s.count} control points`)} tone={s.moved > 1 ? "primary" : undefined} />
          </div>
          <ResetButton c={c} />
        </>
      ),
      note: t(
        "Alias 的编辑点不同：它画在跨度分界（节点）上，用来表示曲线有几个跨度；拖它时软件同样是去挪控制点。Rhino 用 EditPtOn 打开编辑点；Fusion 草图里分「控制点样条曲线」和「拟合点样条曲线」。",
        "Alias edit points are different: they sit at the span boundaries (the knots) and show how many spans a curve has; dragging one also moves control points behind the scenes. In Rhino, EditPtOn shows edit points; Fusion sketches have separate Control Point Spline and Fit Point Spline tools.",
      ),
    },
    {
      title: t("权重：NURBS 能画出真正的圆", "Weights: NURBS can draw a true circle"),
      body: byLocale(
        <>
          <p>NURBS 的 R 是 Rational（有理）：每个控制点可以带一个权重。权重大于 1，曲线被拉向这个点；小于 1，被推开。权重全是 1 时，就是普通的多项式曲线。</p>
          <p>多项式曲线（包括 Bézier）画不出精确的圆，阶数再高也只是逼近。圆要用有理曲线：2 阶、3 个点、中间点权重 √2/2 ≈ 0.707，正好是精确的 1/4 圆。</p>
        </>,
        <>
          <p>
            The R in NURBS stands for rational: each control point can carry a weight. A weight above 1 pulls the curve towards that point; below 1 pushes it away. With every weight at 1,
            you have an ordinary polynomial curve.
          </p>
          <p>
            A polynomial curve (Bézier included) can't draw an exact circle; however high the degree, it only approximates one. A circle needs a rational curve: degree 2, 3 points, and a
            weight of √2/2 ≈ 0.707 on the middle point give an exact quarter circle.
          </p>
        </>,
      ),
      task: { label: t("调中间点的权重，让曲率梳完全均匀", "Adjust the middle point's weight until the comb is perfectly even"), done: (s) => s.circle },
      extra: ({ s, c }) => {
        const err = radiusError(s.weight)
        return (
          <>
            <ParamSlider
              className="mt-3 px-0"
              label={t("中间点权重 w", "Middle weight w")}
              unit=""
              value={s.weight === EXACT_W ? 0.7071 : s.weight}
              min={0.2}
              max={2.5}
              step={0.01}
              onChange={(v) => c.setWeight(v)}
            />
            <div className="mt-3 rounded-md bg-sunken px-3 py-2">
              <Readout label={t("离圆最远", "Furthest from the circle")} value={err < 0.0005 ? "0.000" : err.toFixed(3)} unit="mm" tone={err < 0.0005 ? "success" : "warning"} />
            </div>
            {s.circle && (
              <Hint>
                {t(
                  "梳齿一样长：曲率处处相等，这就是圆。Rhino 的整圆正是 2 阶、9 个控制点，4 个角点的权重是 0.707。",
                  "Every tooth is the same length: equal curvature everywhere, which is a circle. A full circle in Rhino is exactly this: degree 2, 9 control points, with a weight of 0.707 on the 4 corner points.",
                )}
              </Hint>
            )}
          </>
        )
      },
    },
  ],
  quiz: [
    {
      q: t("一条 3 阶 NURBS 曲线有 8 个控制点，它有几个跨度？", "A degree 3 NURBS curve has 8 control points. How many spans does it have?"),
      options: byLocale(["8 个", "5 个", "12 个"], ["8", "5", "12"]),
      answer: 1,
      explain: t(
        "跨度数 = 控制点数 − 阶数 = 8 − 3 = 5。12 是节点向量的长度（点数 + 阶数 + 1），不是跨度数。",
        "Spans = control points − degree = 8 − 3 = 5. 12 is the length of the knot vector (points + degree + 1), not the number of spans.",
      ),
    },
    {
      q: t("控制点不动，把一条曲线从 3 阶改成 5 阶，哪个说法对？", "You change a curve from degree 3 to degree 5 without moving its control points. Which statement is right?"),
      options: byLocale(
        ["曲线更贴近控制点，局部控制更强", "曲线更光顺，但每个点影响的范围更宽", "阶数只影响显示精度，形状不变"],
        ["The curve hugs the control points more and control is more local", "The curve is smoother, but each point reaches further", "Degree only affects display accuracy; the shape doesn't change"],
      ),
      answer: 1,
      explain: t(
        "每个点影响 阶数 + 1 个跨度：5 阶是 6 个。阶数高换来光顺，代价是局部性变弱、曲线离控制多边形更远。",
        "Each point moves degree + 1 spans: 6 at degree 5. A higher degree buys smoothness at the cost of locality, and the curve sits further from the control polygon.",
      ),
    },
    {
      q: t("为什么 NURBS 能精确表示圆，而多项式 Bézier 曲线不能？", "Why can NURBS represent a circle exactly when a polynomial Bézier curve can't?"),
      options: byLocale(
        ["因为 NURBS 的控制点更多", "因为 NURBS 能给控制点加权重（有理），圆正好能写成有理的二次曲线", "因为 Bézier 的阶数不够，升到 7 阶就精确了"],
        [
          "Because NURBS have more control points",
          "Because NURBS can weight their control points (they're rational), and a circle can be written exactly as a rational quadratic",
          "Because the Bézier degree is too low; at degree 7 it would be exact",
        ],
      ),
      answer: 1,
      explain: t(
        "圆不是多项式曲线，点再多、阶数再高也只是逼近。2 阶有理曲线配上合适的权重就能精确表示它，Rhino 的圆就是这样存的。",
        "A circle isn't a polynomial curve, so more points or a higher degree only approximate it. A degree 2 rational curve with the right weights represents it exactly, and that is how Rhino stores circles.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "控制点拉着曲线走，两端夹紧时曲线穿过首尾两点；编辑点在曲线上，拖它会反算好几个控制点",
      "跨度 = 点数 − 阶数，最少 阶数 + 1 个点（单跨度就是 Bézier）；每个点只影响 阶数 + 1 个跨度",
      "阶数越高越光顺、局部性越弱；权重让 NURBS 能精确表示圆",
    ],
    [
      "Control points pull the curve; with clamped ends the curve passes through the first and last points. Edit points sit on the curve, and dragging one re-solves several control points",
      "Spans = points − degree, so you need at least degree + 1 points (a single span is a Bézier curve); each point moves only degree + 1 spans",
      "A higher degree is smoother but less local; weights let NURBS represent a circle exactly",
    ],
  ),
  next: {
    to: "/lesson/curve-rebuild",
    label: t("曲线质量与重建", "Curve quality and rebuilding"),
    text: t("点不是越多越好：用最少的点重建一条抖动的曲线。", "More points aren't better: rebuild a wobbly curve with as few points as it takes."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>{t("上视基准面 XY", "Top plane XY")}</SceneChip>
      {s.step < 5 ? (
        <SceneChip tone="primary">
          {t(`${s.degree} 阶 · ${s.count} 个点 · ${s.count - s.degree} 个跨度`, `Degree ${s.degree} · ${s.count} points · ${s.count - s.degree} span${s.count - s.degree === 1 ? "" : "s"}`)}
        </SceneChip>
      ) : (
        <SceneChip tone="primary">{t(`2 阶有理 · w = ${s.weight === EXACT_W ? "0.707" : s.weight.toFixed(2)}`, `Rational degree 2 · w = ${s.weight === EXACT_W ? "0.707" : s.weight.toFixed(2)}`)}</SceneChip>
      )}
    </div>
  ),
}

export default lesson
