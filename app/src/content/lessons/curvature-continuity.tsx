import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { CurvatureScene, type Continuity, type CurvatureState } from "./curvature-continuity.scene"
import type { LessonDef, StepCtx } from "./types"

/** 5.1.3 · 5.1.4 · 5.1.5 「曲率梳与 G0 / G1 / G2 连续」. */
type Ctx = StepCtx<CurvatureState, CurvatureScene>

const fmtK = (k: number) => (Math.abs(k) < 5e-5 ? "0" : k.toFixed(4))
const fmtR = (k: number) => (Math.abs(k) < 5e-5 ? "∞" : Math.abs(1 / k).toFixed(0))

function ModeSwitch({ s, c }: Ctx) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("接点", "Joint")}</span>
      <Segmented
        size="sm"
        aria-label={t("连续性", "Continuity")}
        value={s.mode}
        onValueChange={(m: Continuity) => c.setMode(m)}
        options={[
          { value: "G0", label: t("G0 位置", "G0 position") },
          { value: "G1", label: t("G1 相切", "G1 tangent") },
          { value: "G2", label: t("G2 曲率", "G2 curvature") },
        ]}
      />
    </div>
  )
}

function JointReadout({ s }: { s: CurvatureState }) {
  return (
    <div className="mt-4 rounded-md bg-sunken px-3 py-2">
      <Readout label={t("切线夹角", "Angle between tangents")} value={s.angleDiff.toFixed(1)} unit="°" tone={s.angleDiff > 0.5 ? "warning" : "success"} />
      <div className="mt-1">
        <Readout label={t("κ A 末端", "κ at the end of A")} value={fmtK(s.kA)} unit={`/mm · R ${fmtR(s.kA)}`} />
      </div>
      <div className="mt-1">
        <Readout
          label={t("κ B 起点", "κ at the start of B")}
          value={fmtK(s.kB)}
          unit={`/mm · R ${fmtR(s.kB)}`}
          tone={Math.abs(s.kA - s.kB) < 2e-4 ? "success" : undefined}
        />
      </div>
    </div>
  )
}

function ResetButton({ c }: { c: CurvatureScene }) {
  return (
    <Button size="sm" variant="ghost" className="mt-2" onClick={() => c.reset()}>
      <RotateCcw />
      {t("恢复曲线", "Reset the curves")}
    </Button>
  )
}

const lesson: LessonDef<CurvatureState, CurvatureScene> = {
  id: "curvature-continuity",
  codes: ["5.1.3", "5.1.4", "5.1.5"],
  title: t("曲率梳与 G0 / G1 / G2 连续", "Curvature combs and G0 / G1 / G2 continuity"),
  create: (v, emit) => new CurvatureScene(v, emit),
  steps: [
    {
      title: t("曲率梳怎么读", "How to read a curvature comb"),
      body: byLocale(
        <>
          <p>曲率是半径的倒数：弯得越急，曲率越大；直线的曲率是 0。</p>
          <p>曲率梳在曲线上每隔一段立一根齿：齿垂直于曲线，长度和这一点的曲率成正比。连起齿尖的那条线叫包络线，它比曲线本身更能暴露起伏。</p>
          <p>梳齿从曲线一侧换到另一侧的地方，就是拐点：曲率在那里过零、换号。</p>
        </>,
        <>
          <p>Curvature is the reciprocal of the radius: the tighter the bend, the larger the curvature. A straight line has zero curvature.</p>
          <p>
            A curvature comb stands a tooth on the curve at regular intervals. Each tooth is normal to the curve, and its length is proportional to the curvature at that point. The line
            through the tips of the teeth is the envelope, and it shows up unevenness much better than the curve itself does.
          </p>
          <p>Where the teeth switch from one side of the curve to the other is an inflection point: the curvature passes through zero and changes sign there.</p>
        </>,
      ),
      task: { label: t("拖动控制点，做出一个拐点（梳齿换边）", "Drag the control points to make an inflection point (the teeth switch sides)"), done: (s) => s.inflection },
      extra: ({ s, c }) => (
        <>
          <ParamSlider
            className="mt-3 px-0"
            label={t("梳齿长度倍数", "Comb scale")}
            unit=""
            value={s.combScale}
            min={100}
            max={1500}
            step={50}
            onChange={(v) => c.setCombScale(v)}
            hint={t("只改显示比例，不改曲线。", "Changes only how the comb is drawn, not the curve.")}
          />
          <ResetButton c={c} />
        </>
      ),
      note: t(
        "Rhino 用 CurvatureGraph，SOLIDWORKS 在曲线上右键「显示曲率梳形图」，Fusion 用 Curvature Comb Analysis。",
        "In Rhino, use CurvatureGraph; in SOLIDWORKS, right-click the curve and choose “Show Curvature Comb”; in Fusion, use Curvature Comb Analysis.",
      ),
    },
    {
      title: t("G0：只是接上", "G0: just touching"),
      body: byLocale(
        <>
          <p>两条曲线在接点重合，叫 G0（位置连续）。软件能把它们接成一条，但接点处可以有折角。</p>
          <p>看接点两侧的梳齿：方向不一致，说明切线在这里突然转了一下。</p>
        </>,
        <>
          <p>Two curves whose ends meet at the joint are G0 (positional continuity). Software can join them into one curve, but there may be a sharp corner at the joint.</p>
          <p>Look at the teeth on either side of the joint: if they point in different directions, the tangent turns suddenly there.</p>
        </>,
      ),
      task: { label: t("拖动曲线 B 的控制点，看切线夹角怎么变", "Drag the control points of curve B and watch the angle between the tangents change"), done: (s) => s.draggedB },
      extra: (ctx) => (
        <>
          <JointReadout s={ctx.s} />
          <ResetButton c={ctx.c} />
        </>
      ),
    },
    {
      title: t("G1：切线连续", "G1: tangent continuity"),
      body: byLocale(
        <>
          <p>G1（相切连续）要求两侧的切线方向相同。对贝塞尔曲线，切线由端部的两个控制点决定：接点和它两侧的第一个控制点共线，就是 G1。</p>
          <p>切换后，B 的第一个控制点变成方块：它被约束在切线上，只能前后滑。</p>
        </>,
        <>
          <p>
            G1 (tangent continuity) requires the tangent direction to be the same on both sides. For Bézier curves, the tangent is set by the two control points at the end: when the joint
            and the first control point on each side of it lie on one line, the joint is G1.
          </p>
          <p>Once you switch, B's first control point turns into a square: it is constrained to the tangent line and can only slide back and forth along it.</p>
        </>,
      ),
      task: { label: t("切换到 G1，让切线夹角变成 0°", "Switch to G1 so that the angle between the tangents becomes 0°"), done: (s) => s.mode !== "G0" && s.angleDiff < 0.5 },
      extra: (ctx) => (
        <>
          <Predict
            question={t("切换到 G1 后，接点两侧的梳齿会怎样？", "After you switch to G1, what happens to the teeth on either side of the joint?")}
            options={byLocale(
              ["完全对齐，看不出接缝", "方向一致了，但长度可能跳变", "梳齿会消失"],
              ["They line up perfectly and the seam disappears", "They point the same way, but their length can jump", "The teeth disappear"],
            )}
            answer={1}
            explain={t(
              "G1 只管切线方向，不管弯曲程度。两侧曲率不同，梳齿在接点处一长一短，包络线出现台阶。反光面上，这一跳就是一道高光折痕。",
              "G1 only controls the tangent direction, not how sharply the curve bends. With different curvature on each side, the teeth at the joint are long on one side and short on the other, and the envelope has a step. On a reflective surface, that jump shows up as a kink in the highlight.",
            )}
            onReveal={() => ctx.c.setMode("G1")}
          />
          <ModeSwitch {...ctx} />
          <JointReadout s={ctx.s} />
        </>
      ),
    },
    {
      title: t("G2：曲率也相等", "G2: equal curvature too"),
      body: byLocale(
        <>
          <p>G2（曲率连续）在 G1 之上，还要求两侧的曲率相等：梳齿在接点处一样长，包络线接上了。这要用到端部的第三个控制点。</p>
          <p>切到 G2，再拖曲线 A 的点：B 的前三个控制点跟着调整，始终保持 G2。</p>
          <p>
            再往上是 G3：曲率的变化率也连续，包络线在接点处连折角都没有。汽车外观的 Class-A 曲面追求近乎完美的高光，常用到 G3；一般产品以 G2 为基本要求。
          </p>
        </>,
        <>
          <p>
            G2 (curvature continuity) builds on G1 and also requires the curvature to be equal on both sides: the teeth at the joint are the same length, and the envelope joins up. This
            brings in the third control point from the end.
          </p>
          <p>Switch to G2, then drag the points of curve A: B's first three control points adjust to keep the joint G2 at all times.</p>
          <p>
            One level up is G3: the rate of change of curvature is continuous too, so the envelope doesn't even have a corner at the joint. Class-A surfaces on car exteriors aim for
            near-perfect highlights and often use G3; for general products, G2 is the basic requirement.
          </p>
        </>,
      ),
      task: { label: t("切到 G2，然后拖动曲线 A 的控制点", "Switch to G2, then drag the control points of curve A"), done: (s) => s.mode === "G2" && s.draggedInG2 },
      extra: (ctx) => (
        <>
          <ModeSwitch {...ctx} />
          <JointReadout s={ctx.s} />
          <Hint>
            {t(
              "常听到的口诀「接点两侧各一个共线点约等于 G1，各两个约等于 G2」是简化说法。严格的 G2 只要求两侧曲率相等；三个点都共线，只是接点曲率为 0 的特例。",
              "You'll often hear the rule of thumb “one collinear point on each side of the joint is roughly G1, two on each side is roughly G2”. That is a simplification. Strict G2 only requires equal curvature on both sides; having all three points in line (the joint and the next two control points) is only the special case where the curvature at the joint is 0.",
            )}
          </Hint>
        </>
      ),
      note: t(
        "Rhino 用 MatchCrv 匹配、BlendCrv 混接；SOLIDWORKS 草图里有「相等曲率」几何关系，Fusion 有曲率（Curvature）约束。",
        "In Rhino, use MatchCrv to match curves and BlendCrv to blend them; SOLIDWORKS sketches have an “Equal Curvature” relation, and Fusion has a Curvature constraint.",
      ),
    },
    {
      title: t("圆角矩形：圆弧只有 G1", "Rounded rectangles: arcs are only G1"),
      body: byLocale(
        <>
          <p>最常见的反例：Rhino 默认的圆角矩形由 4 条直线和 4 段 1/4 圆弧组成。直线曲率为 0，圆弧曲率是 1/R，在切点处一下子跳上去，只有 G1。</p>
          <p>换成 G2 混接：曲率从 0 慢慢升起再落回 0，梳子没有台阶。产品外壳上，这就是高光是否「一刀切断」的区别。</p>
          <p>注意 G2 混接的包络线和直线相交成一个角：它是 G2，但不是 G3。</p>
        </>,
        <>
          <p>
            The most common counterexample: Rhino's default rounded rectangle is made of 4 lines and 4 quarter-circle arcs. A line has zero curvature and an arc has curvature 1/R, so at
            each tangent point the curvature jumps straight up: only G1.
          </p>
          <p>Switch to a G2 blend: the curvature rises gradually from 0 and falls back to 0, and the comb has no step. On a product housing, this decides whether the highlight is “sliced off” at the seam.</p>
          <p>Notice that the G2 blend's envelope meets the line at an angle: it is G2, but not G3.</p>
        </>,
      ),
      task: { label: t("两种圆角都看一遍", "Look at both kinds of corner"), done: (s) => s.triedArc && s.triedBlend },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("圆角", "Corner")}</span>
            <Segmented
              size="sm"
              aria-label={t("圆角类型", "Corner type")}
              value={s.corner}
              onValueChange={(k) => c.setCorner(k)}
              options={[
                { value: "arc", label: t("圆弧（G1）", "Arc (G1)") },
                { value: "blend", label: t("G2 混接", "G2 blend") },
              ]}
            />
          </div>
          <ParamSlider className="mt-3 px-0" label={t("梳齿长度倍数", "Comb scale")} unit="" value={s.combScale} min={100} max={1500} step={50} onChange={(v) => c.setCombScale(v)} />
        </>
      ),
      terms: ["fillet"],
    },
  ],
  quiz: [
    {
      q: t(
        "曲率梳在接点处方向一致，但齿长一长一短，这是什么连续？",
        "At a joint, the curvature comb's teeth point the same way, but they are long on one side and short on the other. What continuity is this?",
      ),
      options: ["G0", "G1", "G2"],
      answer: 1,
      explain: t(
        "方向一致说明切线连续（G1）；齿长跳变说明曲率不连续，到不了 G2。",
        "Teeth pointing the same way mean the tangent is continuous (G1); the jump in tooth length means the curvature isn't, so it falls short of G2.",
      ),
    },
    {
      q: t("一个由直线和 1/4 圆弧组成的圆角矩形，在切点处是几阶连续？", "A rounded rectangle is made of lines and quarter-circle arcs. What continuity does it have at the tangent points?"),
      options: byLocale(
        ["G0，有折角", "G1，曲率从 0 跳到 1/R", "G2，因为圆弧和直线相切"],
        ["G0, with a corner", "G1: the curvature jumps from 0 to 1/R", "G2, because the arcs are tangent to the lines"],
      ),
      answer: 1,
      explain: t(
        "相切只保证 G1。直线曲率为 0，圆弧曲率为 1/R，曲率梳在切点处出现台阶。",
        "Tangency only guarantees G1. A line has zero curvature and an arc 1/R, so the curvature comb steps at the tangent points.",
      ),
    },
    {
      q: t("两条三次贝塞尔曲线已经 G1 相接，要做到 G2，还需要调整什么？", "Two cubic Bézier curves already meet with G1. What else do you need to adjust to get G2?"),
      options: byLocale(
        ["只需把接点两侧的第一个控制点拉得一样长", "调整端部第三个控制点到切线的距离，让两侧曲率相等", "把所有控制点放到一条直线上"],
        [
          "Just pull the first control points on either side of the joint out to the same length",
          "Adjust how far the third control point from each end sits from the tangent line, so the curvature is equal on both sides",
          "Put all the control points on one straight line",
        ],
      ),
      answer: 1,
      explain: t(
        "端点曲率由第三个控制点离切线的距离和第一段臂长共同决定。全部共线只会让曲率为 0，那是特例，不是一般做法。",
        "The curvature at an end point depends on both the third control point's distance from the tangent line and the length of the first leg. Putting them all on one line just makes the curvature 0: a special case, not the general method.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "曲率梳：齿长 ∝ 曲率，换边是拐点，台阶是曲率跳变",
      "G0 位置、G1 切线、G2 曲率；G1 看端部 2 个控制点，G2 还要第 3 个",
      "圆弧圆角只有 G1，要光顺的高光用 G2 混接；G3 和 Class-A 再往上一级",
    ],
    [
      "Curvature comb: tooth length ∝ curvature; teeth switching sides mark an inflection point, a step marks a jump in curvature",
      "G0 is position, G1 tangent, G2 curvature. G1 depends on the 2 control points at the end, G2 on the 3rd as well",
      "Arc fillets are only G1; for smooth highlights, use a G2 blend. G3 and Class-A are one level further up",
    ],
  ),
  next: {
    to: "/lesson/zebra-stripes",
    label: t("斑马纹", "Zebra stripes"),
    text: t("同样的连续性，换到曲面上用反光来看。", "The same continuity, now on surfaces and judged by their reflections."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>{t("上视基准面 XY", "Top plane XY")}</SceneChip>
      {s.step >= 1 && s.step <= 3 && (
        <SceneChip tone="primary">
          {s.mode} · {t("夹角", "angle")} {s.angleDiff.toFixed(1)}°
        </SceneChip>
      )}
      {s.step === 4 && <SceneChip tone="primary">{s.corner === "arc" ? t("圆弧圆角 · G1", "Arc fillet · G1") : t("G2 混接", "G2 blend")}</SceneChip>}
    </div>
  ),
}

export default lesson
