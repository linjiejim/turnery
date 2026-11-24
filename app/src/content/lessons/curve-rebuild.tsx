import type { ReactNode } from "react"
import { CircleCheck, CircleDashed } from "lucide-react"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { MAX_POINTS, RebuildScene, type RebuildDegree, type RebuildState } from "./curve-rebuild.scene"
import { DIGITIZED, ORIGINAL_INFLECTIONS, TOL } from "./curve-rebuild.data"
import type { LessonDef, StepCtx } from "./types"

/** 5.1.2 「曲线质量与重建」. */
type Ctx = StepCtx<RebuildState, RebuildScene>

const TOLS = [1, 0.5, 0.2, 0.1]

function PointSlider({ s, c }: Ctx) {
  return (
    <ParamSlider
      className="mt-3 px-0"
      label={t("重建点数", "Rebuild point count")}
      unit=""
      value={s.count}
      min={s.degree + 1}
      max={MAX_POINTS}
      onChange={(v) => c.setCount(v)}
      hint={t(`原曲线有 ${DIGITIZED} 个控制点。`, `The original curve has ${DIGITIZED} control points.`)}
    />
  )
}

function Quality({ s, tol = TOL }: { s: RebuildState; tol?: number }) {
  return (
    <div className="mt-3 rounded-md bg-sunken px-3 py-2">
      <Readout label={t("最大偏差", "Max deviation")} value={s.dev.toFixed(2)} unit="mm" tone={s.dev < tol ? "success" : "warning"} />
      <Readout label={t("拐点", "Inflections")} value={s.inflections} tone={s.inflections ? "warning" : "success"} />
      <div className="mt-1">
        <Readout label={t("控制点", "Control points")} value={s.count} />
        <Readout label={t("跨度", "Spans")} value={s.count - s.degree} />
      </div>
    </div>
  )
}

function DegreeSwitch({ s, c }: Ctx) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("阶数", "Degree")}</span>
      <Segmented
        size="sm"
        aria-label={t("阶数", "Degree")}
        value={String(s.degree)}
        onValueChange={(d) => c.setDegree(Number(d) as RebuildDegree)}
        options={[
          { value: "3", label: t("3 阶", "Degree 3") },
          { value: "5", label: t("5 阶", "Degree 5") },
        ]}
      />
    </div>
  )
}

function Check({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2 text-small", done ? "text-success" : "text-muted-foreground")}>
      {done ? <CircleCheck className="size-4" /> : <CircleDashed className="size-4" />}
      {children}
    </li>
  )
}

function Checklist({ s, c }: Ctx) {
  const within = s.dev < TOL
  const smooth = s.inflections === 0
  const fewest = within && smooth && !c.canDropOne()
  return (
    <ul className="mt-3 space-y-1 rounded-md bg-sunken px-3 py-2">
      <Check done={within}>{t(`最大偏差 < ${TOL} mm`, `Max deviation < ${TOL} mm`)}</Check>
      <Check done={smooth}>{t("没有拐点（曲率梳不换边）", "No inflections (the comb never switches sides)")}</Check>
      <Check done={fewest}>{t("点数最少：再减一个就不行", "Fewest points: one fewer would fail")}</Check>
    </ul>
  )
}

const lesson: LessonDef<RebuildState, RebuildScene> = {
  id: "curve-rebuild",
  codes: ["5.1.2"],
  title: t("曲线质量与重建", "Curve quality and rebuilding"),
  create: (v, emit) => new RebuildScene(v, emit),
  steps: [
    {
      title: t("描出来的曲线", "A traced curve"),
      body: byLocale(
        <>
          <p>这条曲线是照着样件一个点一个点描下来的：{DIGITIZED} 个点，每个都有零点几毫米的误差。为了穿过每一个点，曲线用了同样多的控制点。</p>
          <p>肉眼看它很顺。可曲线质量不看「顺不顺眼」，要看曲率：放在反光的外壳上，曲率的抖动就是一条扭来扭去的高光。</p>
        </>,
        <>
          <p>
            This curve was traced from a sample part point by point: {DIGITIZED} points, each a few tenths of a millimetre off. To pass through every one of them, the curve uses just as
            many control points.
          </p>
          <p>To the eye it looks smooth. But curve quality isn't judged by eye; it's judged by curvature. On a glossy housing, wobbling curvature shows up as a highlight that wriggles.</p>
        </>,
      ),
      task: { label: t("先猜，再打开曲率梳", "Guess first, then turn on the curvature comb"), done: (s) => s.showComb },
      extra: ({ c }) => (
        <>
          <Predict
            question={t("这条曲线看着挺顺。打开曲率梳，会看到什么？", "This curve looks smooth. What will the curvature comb show?")}
            options={byLocale(["一条平滑的拱形", "梳齿密密麻麻、来回换边", "梳齿全部为 0"], ["A smooth arch", "A dense comb flipping from side to side", "All the teeth at zero"])}
            answer={1}
            explain={t(
              `描点的误差被曲线老老实实地穿过了，曲率跟着上下跳，梳齿换边 ${ORIGINAL_INFLECTIONS} 次。每一次换边都是一个拐点，设计里本来一个都没有。`,
              `The curve faithfully passes through every error in the traced points, so the curvature jumps up and down and the comb switches sides ${ORIGINAL_INFLECTIONS} times. Each switch is an inflection point, and the design had none.`,
            )}
            onReveal={() => c.revealComb()}
          />
          <div className="mt-3 rounded-md bg-sunken px-3 py-2">
            <Readout label={t("控制点", "Control points")} value={DIGITIZED} />
            <Readout label={t("拐点", "Inflections")} value={ORIGINAL_INFLECTIONS} tone="warning" />
          </div>
        </>
      ),
    },
    {
      title: t("重建：从少点开始", "Rebuild: start with few points"),
      body: byLocale(
        <>
          <p>重建（Rebuild）用指定的点数和阶数，生成一条新曲线去逼近原来的那条。新曲线的节点均匀分布，控制点也排得整齐。</p>
          <p>曲线下方是偏差图：沿曲线每一处，新曲线离原曲线多远，放大 30 倍画出来。虚线是 ±{TOL} mm 的公差带，偏差图要全部留在带子里。</p>
        </>,
        <>
          <p>A rebuild makes a new curve, with the point count and degree you specify, that approximates the original. Its knots are evenly spaced and its control points line up neatly.</p>
          <p>
            Under the curve is a deviation plot: how far the new curve is from the original at each place along it, drawn 30 times larger. The dashed lines are the ±{TOL} mm tolerance
            band, and the whole plot has to stay inside it.
          </p>
        </>,
      ),
      task: { label: t(`从 4 个点开始加，直到最大偏差小于 ${TOL} mm`, `Starting from 4 points, add points until the max deviation is under ${TOL} mm`), done: (s) => s.under },
      extra: (ctx) => (
        <>
          <PointSlider {...ctx} />
          <Quality s={ctx.s} />
        </>
      ),
      note: t(
        "Rhino 的 Rebuild 填点数和阶数，按「预览」后显示最大偏差。Alias 用 Curve Edit > Rebuild Curve，或在控制面板里直接改阶数和跨度数，提示行给出新旧曲线的最大偏差。",
        "Rhino's Rebuild takes a point count and a degree, and shows the maximum deviation after you click Preview. In Alias, use Curve Edit > Rebuild Curve, or change the degree and span count directly in the Control Panel; the prompt line reports the largest deviation between old and new.",
      ),
    },
    {
      title: t("点多了会怎样", "What too many points do"),
      body: byLocale(
        <>
          <p>偏差进了公差，再多加点好不好？偏差确实还会降，但新曲线也有了更多「自由」：它开始去贴原始数据里的误差。</p>
          <p>看曲率梳：点多到一定程度，梳齿又开始换边，橙色圆点就是冒出来的拐点。</p>
        </>,
        <>
          <p>
            Once the deviation is inside the tolerance, is it good to add more points? The deviation does keep falling, but the new curve also gains more freedom, and it starts to
            follow the errors in the original data.
          </p>
          <p>Watch the curvature comb: past a certain count, the teeth start switching sides again. The orange dots are the inflections that appear.</p>
        </>,
      ),
      task: { label: t("把点数加上去，找到拐点重新出现的地方", "Add points until inflections appear again"), done: (s) => s.sawWiggle },
      extra: (ctx) => (
        <>
          <Predict
            question={t("把点数加到 30，偏差和曲率梳会怎样？", "If you go up to 30 points, what happens to the deviation and the comb?")}
            options={byLocale(
              ["偏差更小，曲线也更顺", "偏差更小，但曲率梳又开始抖", "偏差反而变大"],
              ["The deviation drops and the curve gets smoother", "The deviation drops, but the comb starts wobbling again", "The deviation actually goes up"],
            )}
            answer={1}
            explain={t(
              "点越多，曲线越能贴住原始数据，包括里面的误差。偏差降到了零点一毫米左右，代价是一串拐点：这就是「点越多越抖」。",
              "The more points, the more closely the curve can follow the original data, errors and all. The deviation falls to about a tenth of a millimetre, at the price of a string of inflections: more points, more wiggles.",
            )}
            onReveal={() => ctx.c.setCount(30)}
          />
          <PointSlider {...ctx} />
          <Quality s={ctx.s} />
        </>
      ),
    },
    {
      title: t("最少的点", "The fewest points"),
      body: byLocale(
        <>
          <p>好曲线的标准：在公差内，用最少的点，没有多余的拐点。点少，曲线就没有余力去抖；控制点少而整齐，以后改形也容易。</p>
          <p>阶数也可以换：5 阶曲线每一段更「硬」，同样的点数下更光顺。</p>
        </>,
        <>
          <p>
            The standard for a good curve: within tolerance, with the fewest points, and no extra inflections. With few points, the curve has no room to wobble, and a small, tidy set of
            control points is easy to reshape later.
          </p>
          <p>You can change the degree too: each span of a degree 5 curve is stiffer, so it is smoother for the same number of points.</p>
        </>,
      ),
      task: { label: t("三项都打勾", "Tick all three"), done: (s) => s.best },
      extra: (ctx) => (
        <>
          <DegreeSwitch {...ctx} />
          <PointSlider {...ctx} />
          <Checklist {...ctx} />
          {ctx.s.best && (
            <Hint>
              {t(
                `找到了。${ctx.s.degree} 阶最少 ${ctx.c.minimum()} 个点；换另一个阶数，也找找它的最少点数。`,
                `Found it: ${ctx.c.minimum()} points is the fewest at degree ${ctx.s.degree}. Switch to the other degree and find its minimum too.`,
              )}
            </Hint>
          )}
        </>
      ),
    },
    {
      title: t("按公差拟合", "Fitting to a tolerance"),
      body: byLocale(
        <>
          <p>另一种做法是只给公差，让软件自己决定用多少点：Rhino 的 FitCrv 就是这样，还会在曲率大的地方把节点排密一些。这里简化成均匀节点。</p>
          <p>公差要按数据本身的精度定。这批描点有约 0.3 mm 的误差；公差比它还紧，软件只能去描噪声。</p>
        </>,
        <>
          <p>
            The other approach is to give only a tolerance and let the software decide how many points to use. Rhino's FitCrv works this way, and it also packs knots closer where the
            curvature is high. Here it is simplified to evenly spaced knots.
          </p>
          <p>Set the tolerance from the accuracy of the data itself. These traced points are off by about 0.3 mm; with a tighter tolerance than that, all the software can do is trace the noise.</p>
        </>,
      ),
      task: { label: t("把公差收紧到 0.1 mm，看点数和拐点", "Tighten the tolerance to 0.1 mm and watch the point count and inflections"), done: (s) => s.triedTight },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("公差", "Tolerance")}</span>
            <Segmented
              size="sm"
              aria-label={t("公差", "Tolerance")}
              value={String(s.tol)}
              onValueChange={(v) => c.setTol(Number(v))}
              options={TOLS.map((x) => ({ value: String(x), label: `${x} mm` }))}
            />
          </div>
          <Quality s={s} tol={s.tol} />
          {s.triedTight && (
            <Hint tone={s.tol <= 0.2 ? "warning" : undefined}>
              {t(
                "公差一收紧，点数成倍增加，拐点也回来了。拟合公差应该比数据误差宽，比设计要求紧；两者冲突时，先回去把数据测准。",
                "Tighten the tolerance and the point count multiplies, and the inflections come back. A fitting tolerance should be looser than the error in the data and tighter than the design requires; when the two clash, go back and measure the data more accurately first.",
              )}
            </Hint>
          )}
        </>
      ),
      note: t(
        "Alias 的 Rebuild Curve 也有按曲率加点（Curvature）、减少跨度（Reduce Spans）等方式。Rhino 说点数，Alias 说跨度数：点数 = 跨度数 + 阶数。",
        "Alias's Rebuild Curve also offers adding points by curvature (Curvature) and removing spans (Reduce Spans), among others. Rhino talks in points, Alias in spans: points = spans + degree.",
      ),
    },
  ],
  quiz: [
    {
      q: t("重建后的曲线已经在公差内。再多加些点，最可能怎样？", "A rebuilt curve is already within tolerance. What is most likely if you add more points?"),
      options: byLocale(
        ["更准也更顺，点越多越好", "偏差略降，但曲线开始跟着原始数据的误差起伏", "曲线会被拉直"],
        ["More accurate and smoother: the more points the better", "The deviation drops a little, but the curve starts to follow the errors in the original data", "The curve gets pulled straight"],
      ),
      answer: 1,
      explain: t(
        "多出来的点给了曲线自由，它会去贴数据里的误差，曲率梳开始抖，冒出拐点。好曲线是满足公差的最少点数。",
        "The extra points give the curve freedom, and it uses it to follow the errors in the data: the comb starts to wobble and inflections appear. A good curve uses the fewest points that meet the tolerance.",
      ),
    },
    {
      q: t("测量数据有约 0.3 mm 的误差，拟合公差设成 0.05 mm，结果最可能是？", "The measured data has errors of about 0.3 mm, and you set the fitting tolerance to 0.05 mm. What is the most likely result?"),
      options: byLocale(
        ["一条又准又顺的曲线", "点数很多，曲线在描噪声，曲率梳抖动", "软件自动忽略噪声"],
        ["A curve that is both accurate and smooth", "Lots of points, a curve tracing the noise, and a wobbly comb", "The software ignores the noise automatically"],
      ),
      answer: 1,
      explain: t(
        "公差比数据误差还紧，满足它的唯一办法就是把误差也描出来。公差要按数据精度和用途来定。",
        "With a tolerance tighter than the error in the data, the only way to meet it is to trace the errors too. Set the tolerance from the accuracy of the data and what the curve is for.",
      ),
    },
    {
      q: t("一条 3 阶、8 个控制点的曲线，在 Alias 的控制面板里显示为几个跨度？", "A degree 3 curve has 8 control points. How many spans does Alias's Control Panel show for it?"),
      options: ["8", "5", "11"],
      answer: 1,
      explain: t(
        "跨度数 = 点数 − 阶数 = 5。Rhino 的 Rebuild 让你填点数，Alias 让你填跨度数，换算时记住差一个阶数。",
        "Spans = points − degree = 5. Rhino's Rebuild asks for a point count and Alias for a span count; when converting, remember they differ by the degree.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "好曲线：在公差内用最少的点，曲率梳不抖，没有多余的拐点",
      "点越多越贴数据，也越会把数据的误差描出来；公差别比数据精度还紧",
      "Rhino 的 Rebuild / FitCrv、Alias 的 Rebuild Curve 都要看最大偏差；Rhino 说点数，Alias 说跨度数",
    ],
    [
      "A good curve meets the tolerance with the fewest points, with a calm comb and no extra inflections",
      "More points follow the data more closely, errors included; don't set the tolerance tighter than the data's accuracy",
      "Rhino's Rebuild / FitCrv and Alias's Rebuild Curve all report a maximum deviation: check it. Rhino counts points, Alias counts spans",
    ],
  ),
  next: {
    to: "/lesson/curvature-continuity",
    label: t("曲率梳与 G0 / G1 / G2 连续", "Curvature combs and G0 / G1 / G2 continuity"),
    text: t("一条曲线顺了，接下来看两条曲线怎样光顺地接起来。", "One curve is smooth; next, how two curves join smoothly."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>{t("上视基准面 XY", "Top plane XY")}</SceneChip>
      {s.step === 0 ? (
        <SceneChip tone="primary">{t(`原曲线 · ${DIGITIZED} 个点`, `Original · ${DIGITIZED} points`)}</SceneChip>
      ) : (
        <SceneChip tone="primary">
          {t(`重建 · ${s.degree} 阶 · ${s.count} 个点`, `Rebuild · degree ${s.degree} · ${s.count} points`)}
          {s.step === 4 ? t(` · 公差 ${s.tol} mm`, ` · tolerance ${s.tol} mm`) : ""}
        </SceneChip>
      )}
    </div>
  ),
}

export default lesson
