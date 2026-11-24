import { Play, Shuffle, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { CAP_MAX_STRETCH, CurvatureAnalysisScene, type CurvState, type DevShape, type MapKind, type Probe, type Shape } from "./curvature-analysis.scene"
import type { LessonDef } from "./types"

/** 5.3.2 「曲率分析（高斯曲率、平均曲率）与拔模分析」. */

const SHAPES: { value: Shape; label: string }[] = [
  { value: "dome", label: t("球面", "Dome") },
  { value: "saddle", label: t("马鞍面", "Saddle") },
  { value: "cylinder", label: t("圆柱面", "Cylinder") },
  { value: "cone", label: t("圆锥面", "Cone") },
]

function ShapeSwitch({ s, c }: { s: CurvState; c: CurvatureAnalysisScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("曲面", "Surface")}</span>
      <Segmented size="sm" aria-label={t("曲面", "Surface")} value={s.shape} onValueChange={(v: Shape) => c.setShape(v)} options={SHAPES} />
    </div>
  )
}

function MapSwitch({ s, c, shaded }: { s: CurvState; c: CurvatureAnalysisScene; shaded?: boolean }) {
  const opts: { value: MapKind; label: string }[] = [
    ...(shaded ? [{ value: "shaded" as const, label: t("着色", "Shaded") }] : []),
    { value: "gauss", label: t("高斯曲率", "Gaussian") },
    { value: "mean", label: t("平均曲率", "Mean") },
  ]
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("显示", "Display")}</span>
      <Segmented size="sm" aria-label={t("显示", "Display")} value={s.map} onValueChange={(v: MapKind) => c.setMap(v)} options={opts} />
    </div>
  )
}

function Scale({ map }: { map: MapKind }) {
  if (map === "shaded") return null
  const [neg, zero, pos] =
    map === "gauss"
      ? [t("负 · 马鞍", "Negative · saddle"), t("0 · 可展", "0 · developable"), t("正 · 穹顶", "Positive · dome")]
      : [t("负 · 凹", "Negative · concave"), "≈ 0", t("正 · 凸", "Positive · convex")]
  return (
    <div className="mt-3">
      <div className="h-2 rounded-xs bg-linear-to-r from-primary via-scene-good to-axis-x" />
      <div className="mt-1 flex justify-between text-caption text-muted-foreground">
        <span>{neg}</span>
        <span>{zero}</span>
        <span>{pos}</span>
      </div>
    </div>
  )
}

const kText = (k: number) => (Math.abs(k) < 1e-4 ? "0" : `${k < 0 ? "−" : ""}1/${Math.round(1 / Math.abs(k))}`)
const signText = (x: number, eps: number) => (x > eps ? "> 0" : x < -eps ? "< 0" : "= 0")

function ProbeReadout({ p }: { p: Probe | null }) {
  if (!p) return <p className="mt-3 text-small text-muted-foreground">{t("在面上点一下，看那一点的两条主截线。", "Click a point on the surface to see its two principal sections.")}</p>
  return (
    <div className="mt-3">
      <Readout label="k1" value={kText(p.k1)} unit="/mm" />
      <Readout label="k2" value={kText(p.k2)} unit="/mm" />
      <Readout label="K = k1·k2" value={signText(p.K, 2e-7)} tone="primary" />
      <Readout label="H" value={kText(p.H)} unit="/mm" />
    </div>
  )
}

const DEVS: { value: DevShape; label: string }[] = [
  { value: "cylinder", label: t("圆柱", "Cylinder") },
  { value: "cone", label: t("圆锥", "Cone") },
  { value: "sphere", label: t("球面", "Sphere") },
]

function DraftLegend() {
  const rows = [
    { cls: "bg-scene-good", text: t("拔模足够：随所在一侧的模具脱出", "Enough draft: releases with its mold half") },
    { cls: "bg-scene-modified", text: t("拔模不足：低于 1°", "Too little draft: under 1°") },
    { cls: "bg-axis-x", text: t("倒扣：反着开模方向倾斜", "Undercut: leans against the pull direction") },
  ]
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      {rows.map((r) => (
        <div key={r.cls} className="contents">
          <span className={`size-3 rounded-xs ${r.cls}`} />
          <span>{r.text}</span>
        </div>
      ))}
    </div>
  )
}

const lesson: LessonDef<CurvState, CurvatureAnalysisScene> = {
  id: "curvature-analysis",
  codes: ["5.3.2"],
  title: t("曲率分析与拔模分析", "Curvature analysis and draft analysis"),
  create: (v, emit) => new CurvatureAnalysisScene(v, emit),
  steps: [
    {
      title: t("两个主曲率", "Two principal curvatures"),
      body: byLocale(
        <>
          <p>在曲面上一点沿不同方向切开，截线弯曲的程度不同。最弯和最不弯的两个方向互相垂直，叫主方向，对应的曲率 k1、k2 叫主曲率。</p>
          <p>高斯曲率 K = k1 × k2。两个方向朝同一边弯（穹顶）为正，朝两边弯（马鞍）为负，有一个方向是直的（圆柱、圆锥）为零。</p>
        </>,
        <>
          <p>Cut a surface through a point in different directions and the cuts bend by different amounts. The most and least curved directions are at right angles; they are the principal directions, and their curvatures k1 and k2 are the principal curvatures.</p>
          <p>Gaussian curvature K = k1 × k2. If both bend the same way (a dome) it is positive; if they bend opposite ways (a saddle) it is negative; if one of them is straight (a cylinder, a cone) it is zero.</p>
        </>,
      ),
      task: { label: t("四种面都看一遍，并在面上点一个点", "Look at all four surfaces and click a point on one"), done: (s) => s.seenShapes.length === 4 && s.probed },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("圆柱面明明是弯的。它的高斯曲率是？", "A cylinder is clearly curved. What is its Gaussian curvature?")}
            options={byLocale(["正：它是凸的", "零：沿轴线方向是直的，k2 = 0", "负"], ["Positive: it's convex", "Zero: it is straight along the axis, so k2 = 0", "Negative"])}
            answer={1}
            explain={t(
              "高斯曲率是两个主曲率的乘积。圆柱沿轴线方向不弯，乘出来就是 0，整个面都是绿色。",
              "Gaussian curvature is the product of the two principal curvatures. Along its axis a cylinder doesn't bend, so the product is 0, and the whole surface is green.",
            )}
            onReveal={() => c.setShape("cylinder")}
          />
          <ShapeSwitch s={s} c={c} />
          <Scale map={s.map} />
          <ProbeReadout p={s.probe} />
        </>
      ),
      note: t(
        "Rhino：曲率分析 CurvatureAnalysis，样式有高斯、平均、最小半径、最大半径。SOLIDWORKS：视图里的「曲率」显示。Fusion：曲率映射分析，类型含高斯。软件里平均曲率的正负取决于曲面法向朝哪边。",
        "Rhino: CurvatureAnalysis, with Gaussian, Mean, Min radius and Max radius styles. SOLIDWORKS: the Curvature display. Fusion: Curvature Map Analysis, including a Gaussian type. In software, the sign of mean curvature depends on which way the surface normal points.",
      ),
      noteTitle: t("各软件叫法", "What each package calls it"),
    },
    {
      title: t("平均曲率：弯得多厉害", "Mean curvature: how much it bends"),
      body: byLocale(
        <>
          <p>平均曲率 H = (k1 + k2) / 2，说明这一点平均弯得多厉害、朝哪边弯。这里按「向外凸为正」上色。</p>
          <p>高斯曲率看「是什么形」：穹顶、马鞍还是可展。平均曲率看「弯多少、朝哪边」：凸、凹，还是两边抵消。</p>
        </>,
        <>
          <p>Mean curvature H = (k1 + k2) / 2 says how much the surface bends at a point on average, and which way. Here it is coloured with convex as positive.</p>
          <p>Gaussian curvature tells you what kind of shape it is: dome, saddle or developable. Mean curvature tells you how much it bends and which way: convex, concave, or cancelling out.</p>
        </>,
      ),
      task: { label: t("用平均曲率看马鞍面和圆柱面", "Look at the saddle and the cylinder in mean curvature"), done: (s) => s.seenMean.includes("saddle") && s.seenMean.includes("cylinder") },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("马鞍面中心的平均曲率是多少？", "What is the mean curvature at the centre of the saddle?")}
            options={byLocale(["很大的正值", "接近 0：两个方向一正一负，抵消了", "很大的负值"], ["Large and positive", "Close to 0: one direction is positive, the other negative, and they cancel", "Large and negative"])}
            answer={1}
            explain={t(
              "马鞍一个方向向上弯、一个方向向下弯，曲率一正一负。平均下来接近 0，可高斯曲率是负的。两种着色要配合着看。",
              "A saddle bends up one way and down the other, so its curvatures have opposite signs. They average to about 0, yet the Gaussian curvature is negative. Read the two maps together.",
            )}
            onReveal={() => {
              c.setMap("mean")
              c.setShape("saddle")
            }}
          />
          <MapSwitch s={s} c={c} />
          <ShapeSwitch s={s} c={c} />
          <Scale map={s.map} />
          <ProbeReadout p={s.probe} />
        </>
      ),
    },
    {
      title: t("盲测：找出凹坑", "Blind test: find the dent"),
      body: byLocale(
        <>
          <p>这块微凸的面板上藏着一个 0.3 mm 深的浅凹，像碰伤或缩痕。着色下几乎看不出来。</p>
          <p>切到曲率着色找到它，在视图里点它。平均曲率在凹坑处翻成负的（凹）；高斯曲率在凹坑中心是正的，周围一圈是负的，那是马鞍状的过渡。</p>
        </>,
        <>
          <p>This gently domed panel hides a dent 0.3 mm deep, like a ding or a sink mark. In the shaded view you can hardly see it.</p>
          <p>Switch to a curvature map, find it, and click it in the view. Mean curvature turns negative (concave) in the dent; Gaussian curvature is positive at its centre and negative in a ring around it, the saddle-shaped transition.</p>
        </>,
      ),
      task: { label: t("在视图里点中凹坑", "Click the dent in the view"), done: (s) => s.found },
      extra: ({ s, c }) => (
        <>
          <MapSwitch s={s} c={c} shaded />
          <Scale map={s.map} />
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={() => c.newPanel()}>
              <Shuffle />
              {t("换一块面板", "New panel")}
            </Button>
            <Readout label={t("点了", "Clicks")} value={s.guesses.length} />
          </div>
          {s.found && (
            <Hint>
              {t(
                "找到了。浅凹在着色里只是一点点明暗变化，曲率着色却把它变成一块颜色反过来的斑。检查外观件时，曲率和斑马纹要一起用。",
                "Found it. In the shaded view a shallow dent is a barely visible change in shading; a curvature map turns it into a patch of opposite colour. On visible parts, use curvature maps and zebra stripes together.",
              )}
            </Hint>
          )}
          {!s.found && s.guesses.length > 0 && <Hint tone="warning">{t("不在这里。换成曲率着色再找。", "Not here. Switch to a curvature map and look again.")}</Hint>}
        </>
      ),
    },
    {
      title: t("可展面：能不能摊平", "Developable surfaces: can it lie flat?"),
      body: byLocale(
        <>
          <p>高斯曲率处处为 0 的面叫可展面：圆柱、圆锥，以及由它们接成的面。它们能不拉伸地摊平；反过来，一张平板也能不拉伸地弯成它们。</p>
          <p>钣金卷圆和折弯、纸盒和平板包装、胶合板弯曲、贴膜和包覆，都靠这一点。球面这类高斯曲率不为 0 的面，摊平时一定要拉伸或压缩：钣金要冲压，薄膜要加热拉伸，布料要收省。</p>
        </>,
        <>
          <p>A surface whose Gaussian curvature is 0 everywhere is developable: cylinders, cones, and surfaces joined from them. They unroll flat without stretching, and a flat sheet bends into them without stretching.</p>
          <p>
            Rolled and bent sheet metal, cardboard boxes and flat-pack, bent plywood, film wraps and coverings all rely on this. A surface with non-zero Gaussian curvature, like a
            sphere, has to stretch or shrink to lie flat: sheet metal is pressed, film is heated and stretched, fabric gets darts.
          </p>
        </>,
      ),
      task: {
        label: t("把圆柱和圆锥完全摊开，再试试球面", "Unroll the cylinder and the cone completely, then try the sphere"),
        done: (s) => s.unrolledCyl && s.unrolledCone && s.triedSphere,
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把这片球面摊平，会怎样？", "You flatten this piece of a sphere. What happens?")}
            options={byLocale(
              ["和圆柱一样平整摊开", "边缘要被拉长约 9%，纸或薄板会撕开、起皱", "中间被拉长，边缘不变"],
              ["It lies flat like the cylinder", "The rim has to stretch by about 9%; paper or thin sheet tears or wrinkles", "The middle stretches and the rim stays the same"],
            )}
            answer={1}
            explain={t(
              "保持从中心量出去的距离，摊平后的外圈比球面上的那一圈长，边缘就得被拉长。这片球面的边缘要拉长约 9%。",
              "Keep the distances measured out from the centre and the outer circle on the flat is longer than the same circle on the sphere, so the rim must stretch. For this piece, about 9%.",
            )}
            onReveal={() => c.playUnroll("sphere")}
          />
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("曲面", "Surface")}</span>
            <Segmented size="sm" aria-label={t("曲面", "Surface")} value={s.dev} onValueChange={(v: DevShape) => c.setDev(v)} options={DEVS} />
          </div>
          <ParamSlider className="mt-3 px-0" label={t("摊平", "Flatten")} unit="%" value={Math.round(s.unroll * 100)} min={0} max={100} step={5} onChange={(v) => c.setUnroll(v / 100)} />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={() => c.playUnroll()}>
              <Play />
              {t("播放摊平", "Play")}
            </Button>
            <Readout
              label={t("最大拉伸", "Largest stretch")}
              value={s.dev === "sphere" ? (CAP_MAX_STRETCH * s.unroll * 100).toFixed(1) : "0"}
              unit="%"
              tone={s.dev === "sphere" && s.unroll > 0.1 ? "warning" : "success"}
            />
          </div>
        </>
      ),
    },
    {
      title: t("拔模分析：同一张面，换个看法", "Draft analysis: the same surface, another view"),
      body: byLocale(
        <>
          <p>曲率分析看形状，拔模分析看能不能脱模：按每一点的法向和开模方向的夹角上色。造型面上拔模角连续变化，分析结果是一片片区域，而不是一个个面。</p>
          <p>这个外壳最宽处在 8 mm 高。分型线在底部时，最宽处以下朝里收的一圈是倒扣。把分型线移到最宽处，倒扣就没了；最宽处附近的侧面却是竖直的，还剩一条橙色带：要在造型上给侧面加一点斜度，让分型线落在上下两段斜面相交的折线上。</p>
        </>,
        <>
          <p>Curvature analysis checks the shape; draft analysis checks whether it will come out of the mold, colouring each point by the angle between its normal and the pull direction. On a styled surface the draft changes continuously, so the result is a set of regions rather than whole faces.</p>
          <p>
            This housing is widest 8 mm up. With the parting line at the bottom, the band below the widest line, which tucks inward, is an undercut. Move the parting line up to the
            widest line and the undercut is gone, but the sides near it are vertical, leaving an orange band. The styling itself needs a little slope there, so the parting line sits on
            the crease where an upper and a lower sloped face meet.
          </p>
        </>,
      ),
      task: {
        label: t("移动分型线，再给侧面加斜度，去掉红色和橙色", "Move the parting line, then slope the sides, until no red or orange is left"),
        done: (s) => s.undercut < 0.05 && s.lowDraft < 0.2,
      },
      extra: ({ s, c }) => (
        <>
          <DraftLegend />
          <ParamSlider className="mt-3 px-0" label={t("分型线高度", "Parting line height")} value={s.parting} min={0} max={20} step={0.5} onChange={(v) => c.setParting(v)} />
          <ParamSlider
            className="px-0"
            label={t("侧面斜度（造型上加的拔模）", "Side slope (draft added to the styling)")}
            unit="°"
            value={s.taper}
            min={0}
            max={3}
            step={0.25}
            onChange={(v) => c.setTaper(v)}
          />
          <div className="mt-2">
            <Readout label={t("倒扣", "Undercut")} value={s.undercut.toFixed(1)} unit="%" tone={s.undercut < 0.05 ? "success" : "warning"} />
            <Readout label={t("拔模不足", "Too little draft")} value={s.lowDraft.toFixed(1)} unit="%" tone={s.lowDraft < 0.2 ? "success" : "warning"} />
          </div>
        </>
      ),
      note: t(
        "这里按 1° 判断拔模是否足够。实际最小拔模角看材料、深度和表面纹理，以模具厂和材料商的建议为准。Rhino：拔模角度分析；SOLIDWORKS 和 Fusion：拔模分析。",
        "Here 1° counts as enough draft. The real minimum depends on the material, the depth and the surface texture; follow your molder's and material supplier's advice. Rhino: DraftAngleAnalysis; SOLIDWORKS and Fusion: Draft Analysis.",
      ),
      terms: ["draft"],
    },
  ],
  quiz: [
    {
      q: t("圆柱面和圆锥面的高斯曲率是多少？", "What is the Gaussian curvature of a cylinder or a cone?"),
      options: byLocale(["正", "零：有一个主曲率为 0，它们是可展面", "负"], ["Positive", "Zero: one principal curvature is 0, so they are developable", "Negative"]),
      answer: 1,
      explain: t(
        "高斯曲率是两个主曲率的乘积。圆柱、圆锥沿母线方向是直的，乘积为 0，所以能不拉伸地摊平。",
        "Gaussian curvature is the product of the principal curvatures. Cylinders and cones are straight along their rulings, so the product is 0 and they unroll without stretching.",
      ),
    },
    {
      q: t("要在一块微凸的面板上找一个很浅的凹坑，最直接的是？", "What's the most direct way to find a very shallow dent in a gently domed panel?"),
      options: byLocale(
        ["在着色视图里转着看", "平均曲率着色：凹坑处变成负的，颜色翻过来", "拔模分析"],
        ["Orbit around it in the shaded view", "A mean curvature map: the dent turns negative and changes colour", "A draft analysis"],
      ),
      answer: 1,
      explain: t(
        "0.3 mm 的浅凹在着色里几乎看不出。面板本身是凸的，凹坑处平均曲率变成负的，一眼就能找到。拔模分析只看倾斜角度，对浅凹不敏感。",
        "A 0.3 mm dent hardly shows in shading. The panel is convex, so the dent's negative mean curvature stands out at once. Draft analysis only looks at slope and barely notices a shallow dent.",
      ),
    },
    {
      q: t("要用一整张薄膜包覆外壳，为什么设计师偏爱可展面？", "When a housing is to be wrapped in one piece of film, why do designers prefer developable surfaces?"),
      options: byLocale(
        ["可展面更好看", "平的膜能不拉伸地贴上，不起皱、不变薄", "可展面的高斯曲率是正的，更结实"],
        ["Developable surfaces look better", "Flat film goes on without stretching, so it doesn't wrinkle or thin out", "Their Gaussian curvature is positive, so they're stronger"],
      ),
      answer: 1,
      explain: t(
        "可展面的高斯曲率为 0，平膜弯上去长度不变。双曲面要靠拉伸才能贴合，拉伸处变薄、容易起皱或回弹翘起。",
        "A developable surface has zero Gaussian curvature, so flat film bends onto it without changing length. A doubly curved surface needs stretching to fit; stretched areas thin out and tend to wrinkle or lift.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "k1、k2 是一点上最弯和最不弯的两个方向；高斯 K = k1·k2 看形状类型，平均 H = (k1 + k2) / 2 看弯多少、朝哪边",
      "K > 0 是穹顶，K < 0 是马鞍，K = 0 可展：能由平板不拉伸地弯成",
      "曲率着色能找出肉眼看不出的浅凹；拔模分析按开模方向上色，分型线放在最宽处，侧面要留斜度",
    ],
    [
      "k1 and k2 are the most and least curved directions at a point; Gaussian K = k1·k2 tells the kind of shape, mean H = (k1 + k2) / 2 how much and which way it bends",
      "K > 0 is a dome, K < 0 a saddle, K = 0 developable: it bends from a flat sheet without stretching",
      "Curvature maps find dents your eye misses; draft analysis colours by the pull direction: put the parting line at the widest line and give the sides some slope",
    ],
  ),
  next: {
    to: "/lesson/draft-analysis",
    label: t("注塑：拔模与分型线", "Injection molding: draft and parting lines"),
    text: t("在一个注塑盖子上，看拔模、分型线、倒扣和滑块怎么配合。", "See how draft, parting lines, undercuts and slides work together on a molded cover."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        <Palette />
        {s.step <= 2
          ? s.map === "gauss"
            ? t("高斯曲率", "Gaussian curvature")
            : s.map === "mean"
              ? t("平均曲率", "Mean curvature")
              : t("着色", "Shaded")
          : s.step === 3
            ? t("拉伸量", "Stretch")
            : t("拔模分析 · 最小 1°", "Draft analysis · min 1°")}
      </SceneChip>
      {s.step <= 1 && <SceneChip tone="primary">{SHAPES.find((x) => x.value === s.shape)?.label}</SceneChip>}
    </div>
  ),
}

export default lesson
