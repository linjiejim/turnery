import { ArrowUpFromLine, Check, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { ClassAScene, SAMPLES, samplePatch, type ClassAState, type Joint, type Reading } from "./bezier-class-a.scene"
import type { LessonDef, StepCtx } from "./types"

/** 5.4.3 · 5.4.4 「Bezier 与 NURBS、单跨度面与升阶；Class-A 的概念与质量标准」. */
type Ctx = StepCtx<ClassAState, ClassAScene>

const READING_LABEL: Record<Reading, string> = {
  bezier: t("单跨度 · 5 阶", "1 span · degree 5"),
  cubic: t("3 跨 · 3 阶", "3 spans · degree 3"),
  quadratic: t("4 跨 · 2 阶", "4 spans · degree 2"),
}

function ZebraToggle({ s, c }: Ctx) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("显示", "Display")}</span>
      <Segmented
        size="sm"
        aria-label={t("显示", "Display")}
        value={s.zebra ? "zebra" : "shaded"}
        onValueChange={(v) => c.setZebra(v === "zebra")}
        options={[
          { value: "shaded", label: t("着色", "Shaded") },
          { value: "zebra", label: t("斑马纹", "Zebra stripes") },
        ]}
      />
    </div>
  )
}

function Structure({ degree, points, spans }: { degree: string; points: string; spans: string }) {
  return (
    <div className="mt-4 rounded-md bg-sunken px-3 py-2">
      <Readout label={t("阶数", "Degree")} value={degree} />
      <Readout label={t("控制点", "Control points")} value={points} />
      <Readout label={t("跨度", "Spans")} value={spans} tone="primary" />
    </div>
  )
}

function readingStructure(r: Reading) {
  if (r === "bezier") return { degree: "5 × 3", points: "6 × 4", spans: "1 × 1" }
  if (r === "cubic") return { degree: "3 × 3", points: "6 × 4", spans: "3 × 1" }
  return { degree: "2 × 3", points: "6 × 4", spans: "4 × 1" }
}

const SAMPLE_FEEDBACK = {
  dense: {
    ok: false,
    text: t(
      "高光是顺的，但它有 7 个跨度、10 × 4 个点：内部每条节点线上只有 G2，点多难改，两边的连续性也难管干净。离 Class-A 的做法还差一步。",
      "The highlights are smooth, but it has 7 spans and 10 × 4 points: every internal knot line is only G2, there are many points to adjust, and the continuity at its edges is harder to keep clean. It falls short of Class-A practice.",
    ),
  },
  smooth: {
    ok: true,
    text: t(
      "对。单跨度、5 × 3 阶，控制网平顺，曲率梳单调，高光宽窄匀称地变化。",
      "Right. A single span at degree 5 × 3, with a smooth net, a steady comb and highlights that change width evenly.",
    ),
  },
  lumpy: {
    ok: false,
    text: t(
      "单跨度没错，可控制网有回折，高光在中间抖动：这正是前面理顺的问题。",
      "A single span is right, but the net folds back and the highlights wobble in the middle: exactly the problem you smoothed out earlier.",
    ),
  },
} as const

function BlindPick({ s, c }: Ctx) {
  const kind = SAMPLES[s.sample]
  const p = samplePatch(kind)
  const spans = p.net.length - p.pu
  const picked = s.guess !== null ? SAMPLE_FEEDBACK[SAMPLES[s.guess]] : null
  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-small font-medium">{t("样件", "Sample")}</span>
        <Segmented
          size="sm"
          aria-label={t("样件", "Sample")}
          value={String(s.sample)}
          onValueChange={(v) => c.setSample(Number(v))}
          options={SAMPLES.map((_, i) => ({ value: String(i), label: t(`样件 ${i + 1}`, `Sample ${i + 1}`) }))}
        />
      </div>
      <Structure degree={`${p.pu} × ${p.pv}`} points={`${p.net.length} × ${p.net[0].length}`} spans={`${spans} × 1`} />
      <Button size="sm" variant="primary" className="mt-3" onClick={() => c.guess()}>
        <Check />
        {t("选这个", "Pick this one")}
      </Button>
      {picked && <Hint tone={picked.ok ? undefined : "warning"}>{picked.text}</Hint>}
    </>
  )
}

const lesson: LessonDef<ClassAState, ClassAScene> = {
  id: "bezier-class-a",
  codes: ["5.4.3", "5.4.4"],
  title: t("Bezier 与 NURBS、单跨度面与升阶；Class-A 的概念与质量标准", "Bézier and NURBS, single-span patches and degree elevation; what Class-A means"),
  create: (v, emit) => new ClassAScene(v, emit),
  steps: [
    {
      title: t("单跨度的 Bézier 面", "A single-span Bézier patch"),
      body: byLocale(
        <>
          <p>这是一块微微拱起的面板，虚线网是它的控制网：长度方向 6 列，宽度方向 4 排。</p>
          <p>它是一块 Bézier 面：每个方向只有一个跨度，点数 = 阶数 + 1，所以是 5 × 3 阶。Bézier 面就是 NURBS 面的一个特例。</p>
          <p>只有一个跨度，意味着每个控制点都管着整块面：拖哪个点，整块面都会跟着动。</p>
        </>,
        <>
          <p>This is a gently crowned panel. The dashed net is its control net: 6 columns along its length and 4 rows across.</p>
          <p>It is a Bézier patch: one span in each direction, with points = degree + 1, so its degree is 5 × 3. A Bézier patch is a special case of a NURBS patch.</p>
          <p>With a single span, every control point acts on the whole patch: whichever point you drag, the whole patch moves.</p>
        </>,
      ),
      task: { label: t("上下拖动一个控制点", "Drag a control point up or down"), done: (s) => s.dragged },
      extra: (ctx) => (
        <>
          <Structure {...readingStructure("bezier")} />
          <ZebraToggle {...ctx} />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => ctx.c.resetNet()}>
            <RotateCcw />
            {t("恢复曲面", "Reset the patch")}
          </Button>
        </>
      ),
    },
    {
      title: t("同一个控制网，多个跨度", "The same net, several spans"),
      body: byLocale(
        <>
          <p>同样 6 列控制点，可以读成别的结构：3 阶、3 个跨度，或 2 阶、4 个跨度。面上的蓝色细线是跨度之间的节点线。</p>
          <p>跨度内部总是光滑的，问题出在节点线上。节点不重复时，跨度之间只连续到 阶数 − 1 阶导数：2 阶在节点处曲率跳变，只有 G1；3 阶曲率连续，但曲率的变化率会折，是 G2、不到 G3。</p>
          <p>单跨度的 Bézier 面没有内部节点，整块面内部处处光滑。</p>
        </>,
        <>
          <p>The same 6 columns of control points can be read as other structures: degree 3 with 3 spans, or degree 2 with 4 spans. The thin blue lines on the surface are the knot lines between spans.</p>
          <p>
            Inside a span everything is smooth; the trouble is at the knot lines. With no repeated knots, spans join with continuous derivatives only up to degree − 1: at degree 2 the
            curvature jumps at the knots, which is only G1; at degree 3 the curvature is continuous but its rate of change kinks, which is G2 and not G3.
          </p>
          <p>A single-span Bézier patch has no internal knots, so it is smooth everywhere inside.</p>
        </>,
      ),
      task: { label: t("三种读法都看一遍，盯住节点线上的曲率梳", "Look at all three readings and watch the comb at the knot lines"), done: (s) => s.readings.length === 3 },
      extra: (ctx) => (
        <>
          <Predict
            question={t("改成 3 阶、3 个跨度，节点线上的曲率梳会怎样？", "Switch to degree 3 with 3 spans. What happens to the comb at the knot lines?")}
            options={byLocale(
              ["和单跨度一样完全光顺", "齿长连续，但包络线在节点处折一下", "齿长突然跳变"],
              ["It stays perfectly smooth, like the single span", "The tooth length is continuous, but the envelope kinks at the knots", "The tooth length jumps"],
            )}
            answer={1}
            explain={t(
              "3 阶的跨度之间曲率连续（G2），曲率的变化率不连续，梳子的包络线在节点线上出现折角。再换成 2 阶看看：那里齿长直接跳，斑马纹也跟着拐。",
              "Degree 3 spans join with continuous curvature (G2), but the rate of change of curvature isn't continuous, so the comb's envelope has a corner at each knot line. Now try degree 2: there the tooth length jumps outright, and the zebra stripes kink with it.",
            )}
            onReveal={() => ctx.c.setReading("cubic")}
          />
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("读法", "Reading")}</span>
            <Segmented
              size="sm"
              aria-label={t("读法", "Reading")}
              value={ctx.s.reading}
              onValueChange={(r: Reading) => ctx.c.setReading(r)}
              options={(["bezier", "cubic", "quadratic"] as Reading[]).map((r) => ({ value: r, label: READING_LABEL[r] }))}
            />
          </div>
          <Structure {...readingStructure(ctx.s.reading)} />
        </>
      ),
    },
    {
      title: t("升阶：形状不变，点变多", "Degree elevation: same shape, more points"),
      body: byLocale(
        <>
          <p>升阶把曲面的阶数提高一阶，每个方向多一排控制点。曲面形状一点不变：新的点都落在旧控制网的边上。</p>
          <p>为什么要升阶？面片和邻面做 G2，接缝一侧要用 3 排控制点，G3 要用 4 排。两条对边都要做 G3，就得有 8 排点，也就是 7 阶。升阶在不改形状的前提下，多给几排点。</p>
          <p>反过来，降阶或减点一般只能近似，形状会变。</p>
        </>,
        <>
          <p>Degree elevation raises the degree by one and adds a row of control points in each direction. The shape doesn't change at all: the new points all lie on the legs of the old net.</p>
          <p>
            Why elevate? Matching a neighbour with G2 uses 3 rows of control points on that side of the seam, and G3 uses 4. To make two opposite edges G3, you need 8 rows: degree 7.
            Elevation gives you more rows without changing the shape.
          </p>
          <p>The reverse, lowering the degree or removing points, is generally only an approximation: the shape changes.</p>
        </>,
      ),
      task: { label: t("升到 5 × 5 阶", "Elevate to degree 5 × 5"), done: (s) => s.elev >= 2 },
      extra: ({ s, c }) => {
        const d = 3 + s.elev
        return (
          <>
            <Predict
              question={t("把这块 3 × 3 阶的面升到 4 × 4 阶，曲面会怎样？", "If you elevate this degree 3 × 3 patch to 4 × 4, what happens to the surface?")}
              options={byLocale(
                ["变得更光顺", "一点不变，只是控制点变多", "稍微变形，需要重新调"],
                ["It gets smoother", "Nothing changes except that there are more control points", "It changes slightly and needs adjusting again"],
              )}
              answer={1}
              explain={t(
                "升阶只是换一种写法：同一张曲面，用更多的点来描述。看淡线：新的点都滑到了旧控制网的边上。",
                "Elevation just writes the same surface another way, with more points. Look at the faint lines: the new points have all slid onto the legs of the old net.",
              )}
              onReveal={() => c.elevateOnce()}
            />
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="primary" disabled={s.elev >= 2} onClick={() => c.elevateOnce()}>
                <ArrowUpFromLine />
                {t("升一阶", "Elevate")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => c.resetElevation()}>
                <RotateCcw />
                {t("回到 3 阶", "Back to degree 3")}
              </Button>
            </div>
            <div className="mt-3 rounded-md bg-sunken px-3 py-2">
              <Readout label={t("阶数", "Degree")} value={`${d} × ${d}`} />
              <Readout label={t("控制点", "Control points")} value={`${(d + 1) ** 2}`} tone="primary" />
              <div className="mt-1">
                <Readout label={t("和原来的面相差", "Difference from the original")} value={c.elevationError().toFixed(3)} unit="mm" tone="success" />
              </div>
            </div>
          </>
        )
      },
    },
    {
      title: t("把控制网理顺", "Smoothing the control net"),
      body: byLocale(
        <>
          <p>Class-A 的面，控制网本身就要好看：每一排点的高低变化一路同向转弯，间距均匀，没有忽上忽下的回折。</p>
          <p>这块面有一排点（蓝色虚线）被弄乱了：斑马纹在中间抖动，曲率梳来回换边。上下拖这一排中间的 4 个点，让它和相邻的排一样平顺。</p>
        </>,
        <>
          <p>On a Class-A surface the control net itself has to look good: along each row, the heights keep turning the same way, the spacing is even, and nothing doubles back up and down.</p>
          <p>
            One row of this patch (the dashed blue line) has been knocked out of shape: the zebra stripes wobble in the middle and the curvature comb flips from side to side. Drag the 4
            middle points of that row up or down until it is as smooth as its neighbours.
          </p>
        </>,
      ),
      task: { label: t("理顺这一排：没有回折，曲率梳不换边", "Smooth this row: no fold-backs, and a comb that never switches sides"), done: (s) => s.smoothed },
      extra: (ctx) => (
        <>
          <div className="mt-4 rounded-md bg-sunken px-3 py-2">
            <Readout label={t("控制网回折", "Fold-backs in the net")} value={ctx.s.folds} tone={ctx.s.folds ? "warning" : "success"} />
            <Readout label={t("曲率梳拐点", "Comb inflections")} value={ctx.s.inflections} tone={ctx.s.inflections ? "warning" : "success"} />
          </div>
          <Hint>
            {t(
              "看相邻那一排：中间高、两头低，每一段比上一段平缓一点。照着它的节奏摆。",
              "Look at the neighbouring row: high in the middle, low at the ends, each leg a little flatter than the one before. Follow its rhythm.",
            )}
          </Hint>
          <ZebraToggle {...ctx} />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => ctx.c.resetNet()}>
            <RotateCcw />
            {t("恢复乱的那排", "Restore the lumps")}
          </Button>
        </>
      ),
    },
    {
      title: t("面与面之间：G2 和 G3", "Between patches: G2 and G3"),
      body: byLocale(
        <>
          <p>大的外观面由好几块面片拼成。接缝的连续性靠接缝两侧的几排控制点：G1 用到 2 排，G2 用到 3 排，G3 用到 4 排。</p>
          <p>Class-A 一般要求面片之间至少 G2，大面和主要的反光面常做到 G3。看接缝处的曲率梳：G1 齿长跳变，G2 接上了但包络线折一下，G3 连折角都没有。</p>
        </>,
        <>
          <p>A large appearance surface is made of several patches. Continuity at a seam comes from the rows of control points on either side of it: G1 involves 2 rows, G2 3 rows and G3 4 rows.</p>
          <p>
            Class-A generally asks for at least G2 between patches, and large, prominent reflective surfaces are often G3. Watch the comb at the seam: at G1 the tooth length jumps; at G2
            it joins up but the envelope kinks; at G3 even the kink is gone.
          </p>
        </>,
      ),
      task: { label: t("三种连接都看一遍", "Look at all three joins"), done: (s) => s.joints.length === 3 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("接缝", "Seam")}</span>
            <Segmented
              size="sm"
              aria-label={t("接缝", "Seam")}
              value={s.joint}
              onValueChange={(j: Joint) => c.setJoint(j)}
              options={(["G1", "G2", "G3"] as Joint[]).map((j) => ({ value: j, label: j }))}
            />
          </div>
          <div className="mt-3 rounded-md bg-sunken px-3 py-2 text-small text-muted-foreground">
            {s.joint === "G1" && t("B 的前 2 排由 A 决定：切线连续，曲率跳变。", "B's first 2 rows follow from A: tangent continuous, curvature jumps.")}
            {s.joint === "G2" && t("B 的前 3 排由 A 决定：曲率连续，曲率的变化率折一下。", "B's first 3 rows follow from A: curvature continuous, but its rate of change kinks.")}
            {s.joint === "G3" && t("B 的前 4 排由 A 决定：曲率的变化率也连续。", "B's first 4 rows follow from A: the rate of change of curvature is continuous too.")}
          </div>
        </>
      ),
      note: t(
        "Alias 的 Align 工具可以选到 G3；Rhino 的 BlendSrf 有 G3、G4 选项，MatchSrf 最高到曲率（G2）。",
        "Alias's Align tool goes up to G3; Rhino's BlendSrf offers G3 and G4, while MatchSrf goes up to curvature (G2).",
      ),
    },
    {
      title: t("Class-A：一套标准，不是文件格式", "Class-A: a standard, not a file format"),
      body: byLocale(
        <>
          <p>Class-A 是外观要求最高的那一级曲面：汽车外观、内饰里看得见摸得着的面，以及家电、消费电子等讲究外观的产品。没有统一标准，各主机厂和设计公司有自己的规范，要求大同小异：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>面片：多用单跨度 Bézier 或很少的跨度。</li>
            <li>连续：面与面之间至少 G2，主要大面 G3；间隙、角度偏差按各家标准。</li>
            <li>控制网：每排单调、间距均匀，没有回折。</li>
            <li>高光：流畅，宽窄渐变，没有抖动和折点。</li>
          </ul>
          <p>它规定曲面做到什么程度、怎么做、怎么检查，不是文件格式：数据照样用 IGES、STEP 或原生格式交付。</p>
        </>,
        <>
          <p>
            Class-A is the most demanding grade of appearance surface: car exteriors, the visible and touchable surfaces of interiors, and appliances, consumer electronics and other
            products where looks matter. There is no single standard; each carmaker and design studio has its own, and they ask for much the same things:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Patches: mostly single-span Bézier, or very few spans.</li>
            <li>Continuity: at least G2 between patches, G3 on the main surfaces; gap and angle limits per each company's standard.</li>
            <li>Control nets: each row monotonic and evenly spaced, with no fold-backs.</li>
            <li>Highlights: flowing, changing width gradually, with no wobbles or kinks.</li>
          </ul>
          <p>It sets how good the surfaces must be and how they are built and checked; it is not a file format. The data still goes out as IGES, STEP or native files.</p>
        </>,
      ),
      task: { label: t("找出最接近 Class-A 的样件", "Find the sample closest to Class-A"), done: (s) => s.guessedRight },
      extra: (ctx) => <BlindPick {...ctx} />,
      note: t("做 Class-A 常用 Autodesk Alias、ICEM Surf，以及 CATIA 里的相应模块。", "Class-A work is typically done in Autodesk Alias, ICEM Surf, and the corresponding modules in CATIA."),
      noteTitle: t("常用软件", "Typical software"),
    },
  ],
  quiz: [
    {
      q: t("把一块 Bézier 面从 3 × 3 阶升到 5 × 5 阶，会怎样？", "You elevate a Bézier patch from degree 3 × 3 to 5 × 5. What happens?"),
      options: byLocale(
        ["形状变得更光顺", "形状完全不变，控制点从 16 个变成 36 个", "形状不变，控制点数也不变"],
        ["The shape gets smoother", "The shape doesn't change at all, and the control points go from 16 to 36", "Neither the shape nor the number of control points changes"],
      ),
      answer: 1,
      explain: t(
        "升阶只是换一种写法，新点都在旧控制网上，曲面一点不动。点数从 (3 + 1)² = 16 变成 (5 + 1)² = 36，多出来的排数留给连续性。",
        "Elevation just writes the surface another way; the new points lie on the old net and the surface doesn't move. The points go from (3 + 1)² = 16 to (5 + 1)² = 36, and the extra rows are there for continuity.",
      ),
    },
    {
      q: t("Class-A 为什么偏爱单跨度的 Bézier 面？", "Why does Class-A work favour single-span Bézier patches?"),
      options: byLocale(
        ["Bézier 面渲染得更快", "没有内部节点，面内处处光滑；点少而整齐，连续性好控制", "Bézier 面能精确表示圆"],
        ["Bézier patches render faster", "There are no internal knots, so they're smooth everywhere inside; few, tidy points make continuity easy to control", "Bézier patches can represent circles exactly"],
      ),
      answer: 1,
      explain: t(
        "多跨度面在节点处只连续到 阶数 − 1 阶，高光可能在节点线上出问题。单跨度面没有这个隐患，点少、排列整齐，修高光、配邻面都更直接。精确的圆要用有理 NURBS，多项式的 Bézier 反而做不到。",
        "A multi-span patch is only continuous up to degree − 1 at its knots, and the highlights can suffer along the knot lines. A single span has no such risk, and its few, orderly points make fixing highlights and matching neighbours more direct. An exact circle needs rational NURBS; a polynomial Bézier can't do it.",
      ),
    },
    {
      q: t("关于 Class-A，哪个说法对？", "Which statement about Class-A is right?"),
      options: byLocale(
        ["它是一种曲面文件格式，导出时选择", "它是一套曲面质量和建模过程的要求，各家有自己的标准", "只要每个接缝都是 G2，就是 Class-A"],
        ["It is a surface file format you choose when exporting", "It is a set of requirements on surface quality and the modelling process, and each company has its own standard", "As long as every seam is G2, it's Class-A"],
      ),
      answer: 1,
      explain: t(
        "Class-A 讲的是做到什么程度、怎么做、怎么检查：面片结构、连续性、控制网、高光、公差都算，不只看一项。数据照样用 IGES、STEP 或原生格式交付。",
        "Class-A is about how good the surfaces are and how they're built and checked: patch structure, continuity, control nets, highlights and tolerances all count, not just one of them. The data still goes out as IGES, STEP or native files.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "Bézier 面 = 每个方向只有一个跨度的 NURBS 面；多跨度面在节点处只连续到 阶数 − 1 阶",
      "升阶不改形状、只加控制点，给连续性留出排数；降阶和减点只能近似",
      "Class-A 是质量和过程标准：单跨度为主、G2 / G3 连接、控制网平顺、高光干净，不是文件格式",
    ],
    [
      "A Bézier patch is a NURBS patch with one span each way; a multi-span patch is only continuous up to degree − 1 at its knots",
      "Degree elevation adds control points without changing the shape, leaving rows for continuity; lowering the degree or removing points only approximates",
      "Class-A is a quality and process standard: mostly single spans, G2 / G3 joins, smooth control nets and clean highlights. It is not a file format",
    ],
  ),
  next: {
    to: "/lesson/zebra-stripes",
    label: t("斑马纹", "Zebra stripes"),
    text: t("用反光检查曲面质量，盲测找出 G2。", "Judge surfaces by their reflections, and pick out G2 in a blind test."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>{s.zebra ? t("斑马纹", "Zebra stripes") : t("着色", "Shaded")}</SceneChip>
      {s.step <= 1 && <SceneChip tone="primary">{READING_LABEL[s.step === 0 ? "bezier" : s.reading]}</SceneChip>}
      {s.step === 2 && <SceneChip tone="primary">{t(`单跨度 · ${3 + s.elev} × ${3 + s.elev} 阶`, `1 span · degree ${3 + s.elev} × ${3 + s.elev}`)}</SceneChip>}
      {s.step === 3 && <SceneChip tone="primary">{t("单跨度 · 5 × 3 阶", "1 span · degree 5 × 3")}</SceneChip>}
      {s.step === 4 && <SceneChip tone="primary">{t(`接缝 · ${s.joint}`, `Seam · ${s.joint}`)}</SceneChip>}
      {s.step === 5 && (
        <SceneChip tone="primary">
          {t("样件", "Sample")} {s.sample + 1}
        </SceneChip>
      )}
    </div>
  ),
}

export default lesson
