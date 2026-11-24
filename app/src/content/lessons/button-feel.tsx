import { Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { domeCurve, F1_RANGE, SNAP_RANGE, type Curve } from "./button-feel.dome"
import { ButtonFeelScene, SAMPLES, type DomeState } from "./button-feel.scene"
import type { LessonDef } from "./types"

/** 6.2.3 「按键手感：力–行程曲线」: press a rubber dome, read F1 / F2 / travel, snap ratio, tune the web, bistable failure. */

const curveOf = (s: DomeState) => domeCurve({ t: s.thick, angle: s.angle })
const pct = (x: number) => `${Math.round(x * 100)}%`
const inSnap = (c: Curve) => c.snap >= SNAP_RANGE[0] && c.snap <= SNAP_RANGE[1]
const inF1 = (c: Curve) => c.F1 >= F1_RANGE[0] && c.F1 <= F1_RANGE[1]

function PressButton({ c }: { c: ButtonFeelScene }) {
  return (
    <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.pressOnce()}>
      <Play />
      {t("自动按一次", "Press it once")}
    </Button>
  )
}

function Values({ s }: { s: DomeState }) {
  const c = curveOf(s)
  return (
    <div className="mt-3">
      <Readout label="F1" value={c.F1.toFixed(0)} unit="gf" tone={s.step === 3 ? (inF1(c) ? "success" : "warning") : undefined} />
      <Readout label="F2" value={c.F2.toFixed(0)} unit="gf" />
      <Readout label={t("咔嗒比", "Snap ratio")} value={pct(c.snap)} tone={inSnap(c) ? "success" : "warning"} />
    </div>
  )
}

// ------------------------------------------------------------------ the chart

const W = 300
const H = 206
const L = 34
const R = W - 10
const T = 24
const B = H - 30
const XMAX = 2
const YMAX = 300
const px = (w: number) => L + (w / XMAX) * (R - L)
const py = (f: number) => B - (Math.max(-30, Math.min(YMAX, f)) / YMAX) * (B - T)

function path(pts: [number, number][]) {
  return pts.length > 1 ? `M${pts.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" L")}` : ""
}

/** Recorded samples as runs of visited points (a gap where a sample wasn't visited). */
function runs(arr: number[], c: Curve) {
  const out: [number, number][][] = []
  let cur: [number, number][] = []
  arr.forEach((f, k) => {
    if (Number.isNaN(f)) {
      if (cur.length) out.push(cur)
      cur = []
    } else cur.push([(k / SAMPLES) * c.end, f])
  })
  if (cur.length) out.push(cur)
  return out
}

function ForceChart({ s }: { s: DomeState }) {
  const c = curveOf(s)
  const theory: [number, number][] = []
  for (let w = 0; w <= c.end + 1e-6; w += c.end / 80) theory.push([w, c.press(w)])
  const ret: [number, number][] = []
  for (let w = 0; w <= c.contact + 1e-6; w += c.contact / 60) ret.push([w, c.ret(w)])
  const showTheory = s.step >= 1
  const now = (s.bottomed && !s.dragging) || s.stuck ? c.ret(Math.min(s.travel, c.contact)) : c.press(s.travel)
  const marks = s.step >= 1
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block text-foreground" aria-label={t("力–行程曲线", "Force–travel curve")}>
      {s.step === 3 && (
        <g className="text-success">
          <rect x={L} y={py(F1_RANGE[1])} width={R - L} height={py(F1_RANGE[0]) - py(F1_RANGE[1])} fill="currentColor" fillOpacity={0.12} />
          <text x={R - 4} y={py(F1_RANGE[1]) - 3} textAnchor="end" fill="currentColor" className="text-caption">
            {t("F1 目标", "F1 target")}
          </text>
        </g>
      )}
      {[0, 100, 200, 300].map((f) => (
        <g key={f} className="text-muted-foreground">
          <line x1={L} x2={R} y1={py(f)} y2={py(f)} stroke="currentColor" strokeOpacity={f === 0 ? 0.5 : 0.12} />
          <text x={L - 4} y={py(f) + 4} textAnchor="end" fill="currentColor" className="text-caption tabular">
            {f}
          </text>
        </g>
      ))}
      {[0, 0.5, 1, 1.5, 2].map((w) => (
        <text key={w} x={px(w)} y={B + 15} textAnchor="middle" fill="currentColor" className="text-caption tabular text-muted-foreground">
          {w}
        </text>
      ))}
      <text x={R} y={B + 28} textAnchor="end" fill="currentColor" className="text-caption text-muted-foreground">
        {t("行程 mm", "Travel, mm")}
      </text>
      <text x={L - 30} y={T - 12} fill="currentColor" className="text-caption text-muted-foreground">
        {t("力 gf", "Force, gf")}
      </text>
      {showTheory && (
        <g className="text-muted-foreground">
          <path d={path(theory)} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeDasharray="3 3" />
          <path d={path(ret)} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 3" />
        </g>
      )}
      {marks && (
        <g className="text-muted-foreground">
          <line x1={px(c.contact)} x2={px(c.contact)} y1={T} y2={B} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="2 2" />
          <text x={px(c.contact) + 3} y={T + 10} fill="currentColor" className="text-caption">
            {t("接触", "Contact")}
          </text>
        </g>
      )}
      {runs(s.down, c).map((r, i) => (
        <path key={`d${i}`} d={path(r)} fill="none" className="text-primary" stroke="currentColor" strokeWidth={2} />
      ))}
      {runs(s.up, c).map((r, i) => (
        <path key={`u${i}`} d={path(r)} fill="none" className="text-foreground" stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.5} />
      ))}
      {marks && (
        <g className="text-foreground">
          <circle cx={px(c.S1)} cy={py(c.F1)} r={3.5} fill="currentColor" />
          <text x={px(c.S1)} y={py(c.F1) - 7} textAnchor="middle" fill="currentColor" className="text-caption font-medium tabular">
            F1 {c.F1.toFixed(0)}
          </text>
          <circle cx={px(c.contact)} cy={py(c.F2)} r={3.5} fill="currentColor" />
          <text x={px(c.contact) - 5} y={py(c.F2) + (c.F2 < 40 ? -8 : 14)} textAnchor="end" fill="currentColor" className="text-caption font-medium tabular">
            F2 {c.F2.toFixed(0)}
          </text>
        </g>
      )}
      <circle cx={px(s.travel)} cy={py(now)} r={4.5} className="text-primary" fill="currentColor" stroke="var(--background)" strokeWidth={1.5} />
    </svg>
  )
}

function Panel({ s }: { s: DomeState }) {
  const c = curveOf(s)
  return (
    <div className="w-[20rem] rounded-lg border bg-popover p-3 shadow-popover">
      <div className="mb-1 flex items-baseline justify-between text-small">
        <span className="font-medium">{t("力–行程曲线", "Force–travel curve")}</span>
        <span className="text-caption text-muted-foreground">{t("实线：这次按下 · 细线：回弹", "Solid: this press · thin: return")}</span>
      </div>
      <ForceChart s={s} />
      {s.step >= 2 && (
        <div className={cn("mt-1 text-small", inSnap(c) ? "text-success" : "text-warning")}>
          {t("咔嗒比", "Snap ratio")} (F1 − F2) / F1 = {pct(c.snap)}
          {c.minReturn <= 0 && <span className="text-destructive">{t(" · 回不来", " · won't return")}</span>}
        </div>
      )}
    </div>
  )
}

const lesson: LessonDef<DomeState, ButtonFeelScene> = {
  id: "button-feel",
  codes: ["6.2.3"],
  title: t("按键手感：力–行程曲线", "Button feel: the force–travel curve"),
  create: (v, emit) => new ButtonFeelScene(v, emit),
  steps: [
    {
      title: t("按下去，画出曲线", "Press it and draw the curve"),
      body: byLocale(
        <>
          <p>遥控器、计算器上的硅胶按键，底下是一圈薄薄的锥形裙边，按键就架在上面。视图把一个按键从中间剖开：灰色是硅胶，蓝色是裙边的剖面，按键下面黑色的是导电碳粒，最底下是电路板上的触点。</p>
          <p>拖住按键上的圆点往下压，压到底再松开。左上会同步画出每一点的力：这就是力–行程曲线。</p>
        </>,
        <>
          <p>
            Under the silicone keys of a remote control or a calculator is a thin conical skirt, the web, and the key sits on top of it. The view cuts one key in half: grey is silicone, blue is
            the web's section, the black disc under the key is a conductive carbon pill, and at the bottom are the contacts on the circuit board.
          </p>
          <p>Drag the dot on the key down, all the way, then let go. The force at every point is drawn at the top left as you go: that's the force–travel curve.</p>
        </>,
      ),
      task: { label: t("按到底，再松开", "Press all the way down, then let go"), done: (s) => s.pressedOnce && s.releasedOnce },
      extra: ({ c }) => <PressButton c={c} />,
    },
    {
      title: t("读曲线：F1 和 F2", "Reading the curve: F1 and F2"),
      body: byLocale(
        <>
          <p>力先上升，到峰值 F1（动作力）后，裙边失稳，力反而往下掉。碳粒碰到触点时的力叫 F2（接触力），之后再压就是在压实心的橡胶，力陡升。</p>
          <p>松手时走下面那条回程曲线：橡胶有滞后，弹回来的力比按下时小。</p>
        </>,
        <>
          <p>
            The force rises to a peak, F1 (the actuation force). Then the web buckles and the force actually falls. The force when the pill touches the contacts is F2 (the contact force); press
            further and you are squeezing solid rubber, so the force climbs steeply.
          </p>
          <p>When you let go, the key follows the lower, return curve: rubber has hysteresis, so it pushes back with less force than it took to press.</p>
        </>,
      ),
      task: { label: t("把按键停在 F1 峰值附近", "Stop the key near the F1 peak"), done: (s) => s.stoppedAtPeak },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("手指按下去，哪一刻感到「咔嗒」？", "As a finger presses, when does it feel the “click”?")}
            options={byLocale(
              ["刚碰到按键时", "力过了 F1、开始变小的那一刻", "碳粒碰到触点时"],
              ["When it first touches the key", "When the force passes F1 and starts to fall", "When the pill touches the contacts"],
            )}
            answer={1}
            explain={t(
              "手指施加的力大致不变。过了 F1，裙边的反力越来越小，手指一下子落到底：这一下就是「咔嗒」。测试机控制的是位移，所以能把下降段画出来；手指做不到。",
              "A finger pushes with roughly constant force. Past F1 the web pushes back less and less, so the finger drops straight through to the bottom: that is the click. A test machine controls travel, so it can trace the falling part; a finger can't.",
            )}
            onReveal={() => c.pressOnce()}
          />
          <Values s={s} />
        </>
      ),
    },
    {
      title: t("咔嗒比", "Snap ratio"),
      body: byLocale(
        <>
          <p>手感好不好，主要看过峰后力掉了多少：咔嗒比 =（F1 − F2）/ F1。金属弹片厂商 Snaptron 把它叫触感比，算法一样：0 表示力一路上升，没有咔嗒；100% 表示按下去不用力也能停住。</p>
          <p>硅胶按键的设计指南建议做到 40–60%（Diamond HMI）。低于这个范围手感发闷，但寿命更长。</p>
          <p>这个按键的裙边很厚，按下去软绵绵的。把壁厚调薄试试。</p>
        </>,
        <>
          <p>
            How a key feels depends mostly on how far the force drops after the peak: the snap ratio = (F1 − F2) / F1. Snaptron, a metal dome maker, calls it the tactile ratio and computes it the
            same way: 0 means the force keeps rising, with no click; 100% means the key stays down with no force at all.
          </p>
          <p>Silicone keypad design guides recommend 40–60% (Diamond HMI). Below that the feel goes mushy, though the key lasts longer.</p>
          <p>This key has a thick web and feels mushy. Try making the wall thinner.</p>
        </>,
      ),
      task: { label: t("把咔嗒比调到 40–60%", "Bring the snap ratio to 40–60%"), done: (s) => inSnap(curveOf(s)) },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-4 px-0" label={t("裙边壁厚", "Web thickness")} value={s.thick} min={0.3} max={0.9} step={0.05} onChange={(v) => c.setThick(v)} />
          <Values s={s} />
          <PressButton c={c} />
        </>
      ),
    },
    {
      title: t("用结构调手感", "Tuning the feel with the structure"),
      body: byLocale(
        <>
          <p>裙边越厚、角度越陡，F1 越大，这是硅胶按键厂商设计指南里的共识（比如 Silicone Technology）。Silicone Dynamics 建议一般消费类按键用约 130 gf、咔嗒比约 50%。</p>
          <p>这个按键又重又脆。同时调壁厚和角度，把 F1 调到 120–160 gf、咔嗒比 40–60%。两个参数都会同时改变轻重和咔嗒比，要一起调。</p>
        </>,
        <>
          <p>
            A thicker or steeper web gives a higher F1: silicone keypad makers' design guides agree on that (Silicone Technology's, for one). Silicone Dynamics suggests about 130 gf with a snap
            ratio of about 50% for most consumer keys.
          </p>
          <p>This key is heavy and too snappy. Adjust thickness and angle together to bring F1 to 120–160 gf and the snap ratio to 40–60%. Each one changes both the force and the snap, so tune them together.</p>
        </>,
      ),
      task: { label: t("F1 调到 120–160 gf，咔嗒比 40–60%", "F1 at 120–160 gf, snap ratio 40–60%"), done: (s) => inF1(curveOf(s)) && inSnap(curveOf(s)) },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-4 px-0" label={t("裙边壁厚", "Web thickness")} value={s.thick} min={0.3} max={0.9} step={0.05} onChange={(v) => c.setThick(v)} />
          <ParamSlider className="px-0" label={t("裙边角度", "Web angle")} unit="°" value={s.angle} min={30} max={55} onChange={(v) => c.setAngle(v)} />
          <Values s={s} />
          <PressButton c={c} />
        </>
      ),
      note: t(
        "曲线来自一个简化模型：把裙边当成会失稳的斜撑，再加上随壁厚变化的弯曲刚度。它能画出真实曲线的形状和趋势，数值只是示意；真实按键要靠打样和测试机定。",
        "The curve comes from a simplified model: the web is treated as a strut pair that snaps through, plus a bending stiffness that grows with thickness. It reproduces the shape and the trends of a real curve, but the numbers are illustrative; real keys are settled by sampling and testing.",
      ),
      noteTitle: t("关于模型", "About the model"),
    },
    {
      title: t("太脆会卡住", "Too snappy and it sticks"),
      body: byLocale(
        <>
          <p>咔嗒比不是越高越好。裙边太薄、太陡，过峰后的力会掉到零以下：松手后按键停在下面，弹不回来。Snaptron 把这种状态叫双稳态，只有一次性开关之类的场合才会故意这样做。</p>
          <p>回程曲线要一直留着足够的回弹力，才能把按键推回去。把壁厚调到最薄、角度调到最陡，按一下试试，再调回来。</p>
        </>,
        <>
          <p>
            A higher snap ratio isn't always better. With a web that's too thin and too steep, the force after the peak falls below zero: let go and the key stays down. Snaptron calls this bistable,
            and it's only done on purpose for things like one-time switches.
          </p>
          <p>The return curve has to keep enough force all the way up to push the key back. Set the thinnest wall and the steepest angle, press, then set them back.</p>
        </>,
      ),
      task: { label: t("让按键卡住一次，再调到能弹回来", "Make the key stick once, then make it come back"), done: (s) => s.sawStuck && !s.stuck && curveOf(s).minReturn > 0 },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-4 px-0" label={t("裙边壁厚", "Web thickness")} value={s.thick} min={0.3} max={0.9} step={0.05} onChange={(v) => c.setThick(v)} />
          <ParamSlider className="px-0" label={t("裙边角度", "Web angle")} unit="°" value={s.angle} min={30} max={55} onChange={(v) => c.setAngle(v)} />
          <Values s={s} />
          <PressButton c={c} />
          {s.stuck && (
            <Hint tone="warning">
              {t("回程的力掉到了零以下，按键自己回不来。加厚裙边或减小角度，让回程曲线一直在零以上。", "The return force fell below zero, so the key can't come back by itself. Thicken the web or reduce the angle until the return curve stays above zero.")}
            </Hint>
          )}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("一个硅胶按键 F1 = 150 gf，F2 = 75 gf。咔嗒比是多少？", "A silicone key has F1 = 150 gf and F2 = 75 gf. What is its snap ratio?"),
      options: byLocale(["50%", "200%", "75 gf"], ["50%", "200%", "75 gf"]),
      answer: 0,
      explain: t(
        "（150 − 75）/ 150 = 50%。咔嗒比是力的下降量占峰值的比例，不是 F1 和 F2 的比值，也不是下降了多少克力。",
        "(150 − 75) / 150 = 50%. The snap ratio is the drop as a share of the peak: not F1 divided by F2, and not the drop in gf.",
      ),
    },
    {
      q: t("用户说按键「软绵绵，没有段落感」。最直接的改法是？", "Users say a key feels “mushy, with no click”. What's the most direct fix?"),
      options: byLocale(
        ["把行程加长", "加大过峰后的力降，提高咔嗒比，比如减薄裙边", "把键帽做大"],
        ["Make the travel longer", "Make the force drop more after the peak, raising the snap ratio, for example with a thinner web", "Make the keycap bigger"],
      ),
      answer: 1,
      explain: t(
        "段落感来自过峰后的力降。咔嗒比低就发闷；改裙边的壁厚或角度，把咔嗒比拉回 40–60%。只加长行程或放大键帽，曲线的形状不变。",
        "The click comes from the drop in force after the peak. A low snap ratio feels mushy; change the web's thickness or angle to bring it back to 40–60%. A longer travel or a bigger cap leaves the shape of the curve as it was.",
      ),
    },
    {
      q: t("把咔嗒比做到接近 100%，会怎样？", "What happens if the snap ratio approaches 100%?"),
      options: byLocale(
        ["手感最好，越高越好", "过峰后力掉到零附近，按键可能卡在下面回不来", "按键力变成零，一碰就触发"],
        ["The best feel: the higher the better", "After the peak the force drops to about zero, and the key may stay down", "The actuation force becomes zero, so it triggers at a touch"],
      ),
      answer: 1,
      explain: t(
        "100% 意味着按下去不用力也能停住，也就是双稳态。回程没有足够的力，按键回不来。F1 并没有变成零：按下去照样要先过峰。",
        "100% means the key holds itself down with no force: it's bistable. Without enough return force, the key doesn't come back. F1 hasn't become zero: you still have to push past the peak.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "力–行程曲线：力先升到峰值 F1，过峰后降到接触点的 F2，再陡升；回程曲线在下面",
      "咔嗒比 =（F1 − F2）/ F1，硅胶按键一般做 40–60%：太低发闷，太高寿命短，接近 100% 会卡住",
      "裙边越厚、越陡，F1 越大；结构要和咔嗒比一起调，最后靠打样和测试定",
    ],
    [
      "The force–travel curve: force rises to the F1 peak, falls to F2 at contact, then climbs steeply; the return curve runs below",
      "Snap ratio = (F1 − F2) / F1, usually 40–60% for silicone keys: too low feels mushy, too high wears faster, near 100% sticks",
      "A thicker or steeper web raises F1; tune the structure and the snap ratio together, and settle them with samples and testing",
    ],
  ),
  next: {
    to: "/lesson/reach-vision",
    label: t("视线与可达范围", "Sight lines and reach"),
    text: t("按键放在哪里，才看得见、够得着。", "Where to put the buttons so they can be seen and reached."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>{t("硅胶按键 · 剖开一半", "Silicone key · cut in half")}</SceneChip>
        <SceneChip>{t("简化模型", "Simplified model")}</SceneChip>
      </div>
      <Panel s={s} />
    </div>
  ),
}

export default lesson
