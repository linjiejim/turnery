import { Eye, LocateFixed, Scan } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { HierScene, type HierState } from "./fillet-hierarchy.scene"
import type { CornerMode } from "./fillet-hierarchy.geom"
import type { LessonDef } from "./types"

/** 6.1.2 「圆角的层级与角落」. */

const fmt = (v: number) => String(Math.round(v * 10) / 10)

function Sliders({ s, c }: { s: HierState; c: HierScene }) {
  return (
    <div className="mt-3">
      <ParamSlider className="px-0" label={t("竖边圆角", "Vertical edges")} value={s.rv} min={1} max={36} step={0.5} onChange={(v) => c.setRadius("rv", v)} />
      <ParamSlider className="px-0" label={t("顶边圆角", "Top edges")} value={s.rt} min={1} max={24} step={0.5} onChange={(v) => c.setRadius("rt", v)} />
      <ParamSlider className="px-0" label={t("底边圆角", "Bottom edges")} value={s.rb} min={0.5} max={12} step={0.5} onChange={(v) => c.setRadius("rb", v)} />
    </div>
  )
}

/** Hierarchy check: vertical biggest, then top, then bottom, each step at least 1.5×. */
const ranked = (s: HierState) => s.rv >= 1.5 * s.rt && s.rt >= 1.5 * s.rb

function Ratio({ s }: { s: HierState }) {
  return (
    <div className="mt-2 flex flex-wrap gap-y-1">
      <Readout label={t("竖边 : 顶边", "Vertical : top")} value={(s.rv / s.rt).toFixed(1)} tone={s.rv >= 1.5 * s.rt ? "success" : undefined} />
      <Readout label={t("顶边 : 底边", "Top : bottom")} value={(s.rt / s.rb).toFixed(1)} tone={s.rt >= 1.5 * s.rb ? "success" : undefined} />
    </div>
  )
}

function ModeSwitch({ s, c }: { s: HierState; c: HierScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("角落", "Corner")}</span>
      <Segmented
        size="sm"
        aria-label={t("角落", "Corner")}
        value={s.mode}
        onValueChange={(m: CornerMode) => c.setMode(m)}
        options={[
          { value: "roll", label: t("按顺序滚过去", "Roll round in order") },
          { value: "blend", label: t("角落过渡面", "Corner blend") },
        ]}
      />
    </div>
  )
}

function ZebraToggle({ s, c }: { s: HierState; c: HierScene }) {
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

const lesson: LessonDef<HierState, HierScene> = {
  id: "fillet-hierarchy",
  codes: ["6.1.2"],
  title: t("圆角的层级与角落", "Fillet hierarchy and corners"),
  create: (v, emit) => new HierScene(v, emit),
  steps: [
    {
      title: t("三组边", "Three groups of edges"),
      body: byLocale(
        <>
          <p>一个盒形产品（音箱、净化器）的边大致分三组：四条竖边决定俯视的轮廓；顶边一圈，用户最常看、最常摸；底边一圈，贴着桌面。</p>
          <p>做外观时，圆角按组来想，而不是一条边一条边地定。</p>
        </>,
        <>
          <p>
            The edges of a box-shaped product (a speaker, an air purifier) fall roughly into three groups: the four vertical edges set the outline seen from above; the top loop is what users look at and touch most; the
            bottom loop sits on the table.
          </p>
          <p>When you shape a product, think of the fillets group by group, not edge by edge.</p>
        </>,
      ),
      task: { label: t("给三组边都加上圆角", "Give all three groups a fillet"), done: (s) => s.touched === 7 },
      extra: ({ s, c }) => <Sliders s={s} c={c} />,
      note: t("单条边的圆角怎么做、半径为什么有上限，见「圆角与倒角」一课。", "How a single fillet is made, and why its radius has a limit, is in the “Fillets and chamfers” lesson."),
      noteTitle: t("前置", "Before this"),
      terms: ["fillet"],
    },
    {
      title: t("三条边交汇：半径相等", "Three edges meet: equal radii"),
      body: byLocale(
        <>
          <p>每个角上有三条边交汇：一条竖边、两条顶边（或底边）。三组圆角都做了，角上要多出一块面，把三个圆角连起来。</p>
          <p>高亮的就是这块角落面。它长什么样，由三个半径决定。</p>
        </>,
        <>
          <p>At each corner three edges meet: one vertical edge and two top (or bottom) edges. Once all three are filleted, the corner needs one more face to join the three fillets.</p>
          <p>The highlighted face is that corner patch. Its shape is decided by the three radii.</p>
        </>,
      ),
      task: { label: t("三组设成同一个半径（6 mm 以上）", "Set all three groups to the same radius (6 mm or more)"), done: (s) => s.rv >= 6 && Math.abs(s.rv - s.rt) < 0.3 && Math.abs(s.rv - s.rb) < 0.3 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("三组都用 R14，角上的那块面是什么形状？", "All three groups at R14. What shape is the corner patch?")}
            options={byLocale(
              ["一块球面：八分之一个球", "三个圆角在角上碰出一个尖点", "一块平的三角面"],
              ["A piece of a sphere: one eighth of a ball", "The three fillets meet in a sharp point", "A flat triangular face"],
            )}
            answer={0}
            explain={t(
              "圆角可以想成一个球沿着边滚过去。三个半径相等时，在角上球同时贴着三个面，球心不动，留下的就是八分之一个球面。",
              "Think of a fillet as a ball rolling along the edge. With all three radii equal, at the corner the ball touches all three faces at once and its centre stays put, leaving one eighth of a sphere.",
            )}
            onReveal={() => c.setAll(14)}
          />
          <Sliders s={s} c={c} />
        </>
      ),
    },
    {
      title: t("一个主圆角，其余让路", "One dominant radius, the rest give way"),
      body: byLocale(
        <>
          <p>现在三组都是 R12，哪条边都不突出。圆角上的高光带宽度和半径成正比：半径接近，高光就差不多宽，眼睛分不出哪组边是主角。</p>
          <p>常见的做法是先定一个主圆角，这里是竖边，它决定俯视的轮廓；顶边明显小一号；底边最小，因为它贴着桌面，太大会让底面缩小、底下露出一道缝。差多少没有标准，这里按每一级至少 1.5 倍来练。</p>
        </>,
        <>
          <p>All three groups are R12 now, so no edge stands out. The highlight on a fillet is as wide as the radius is large: with similar radii the highlights are about as wide, and the eye can't tell which edges lead.</p>
          <p>
            The usual approach is to pick one dominant radius, here the vertical edges, which set the outline from above. The top edges get a clearly smaller one; the bottom edges the smallest, because they sit on the
            table, and a big one would shrink the footprint and open a gap underneath. There's no standard for how much smaller; here, practise with at least 1.5× between levels.
          </p>
        </>,
      ),
      task: { label: t("竖边最大、顶边其次、底边最小，每级至少差 1.5 倍", "Vertical biggest, then top, then bottom, at least 1.5× between levels"), done: ranked },
      extra: ({ s, c }) => (
        <>
          <Sliders s={s} c={c} />
          <Ratio s={s} />
        </>
      ),
    },
    {
      title: t("半径不等：大的先做", "Unequal radii: biggest first"),
      body: byLocale(
        <>
          <p>竖边 R24、顶边 R8：先做竖边，顶边的圆角沿着一圈边滚过去，到角上绕着竖边的圆角转弯。竖边半径比它大，转得过去，角上是一块圆环面。</p>
          <p>SOLIDWORKS 帮助的建议正是这样：先加大圆角，再加小圆角；几个圆角汇到一个顶点时，先做大的。</p>
        </>,
        <>
          <p>
            Vertical R24, top R8. The vertical edges are done first; the top fillet then rolls along its loop and, at the corner, turns round the vertical fillet. The vertical radius is bigger, so it can make the turn, and
            the corner is a piece of a torus.
          </p>
          <p>That is exactly what the SOLIDWORKS help recommends: add larger fillets before smaller ones, and when several fillets converge at a vertex, create the larger ones first.</p>
        </>,
      ),
      task: {
        label: t("看过折痕，再把角修回光顺", "See the crease, then make the corner smooth again"),
        done: (s) => s.sawCrease && s.top !== "crease" && s.bottom !== "crease",
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("反过来：竖边 R10，顶边 R20。顶边绕到角上会怎样？", "The other way round: vertical R10, top R20. What happens when the top fillet reaches the corner?")}
            options={byLocale(
              ["照样光顺，只是角更圆", "绕不过比它小的弯：软件报错，或在角上留下一道折痕", "自动变成一块球面"],
              ["Still smooth, just a rounder corner", "It can't turn a bend tighter than itself: the software fails, or leaves a crease at the corner", "It turns into a sphere by itself"],
            )}
            answer={1}
            explain={t(
              "半径 20 的球要绕一个半径 10 的弯，球心的轨迹会自己打结。内核要么报错，要么把打结的部分剪掉，角上留下一道尖的折痕。",
              "A ball of radius 20 trying to go round a bend of radius 10: the path of its centre would loop back on itself. The kernel either fails or trims off the loop, leaving a sharp crease at the corner.",
            )}
            onReveal={() => c.setRadii({ rv: 10, rt: 20 })}
          />
          <Sliders s={s} c={c} />
          {s.top === "crease" && (
            <Hint tone="warning">
              {t("顶边比它要绕过的竖边大。把竖边改大，或者把顶边改小。", "The top fillet is bigger than the vertical fillet it has to go round. Make the vertical one bigger, or the top one smaller.")}
            </Hint>
          )}
        </>
      ),
      terms: ["fillet"],
    },
    {
      title: t("角落过渡面", "A corner blend patch"),
      body: byLocale(
        <>
          <p>有时就是要顶边比竖边大，比如顶部要一圈很软的大圆角。这时不靠顺序，改用专门的角落过渡：从顶点往回退一段距离，用一块新面把三个圆角接起来。</p>
          <p>SOLIDWORKS 在圆角里叫「逆转参数」，Fusion 的圆角有 Setback 拐角类型。这里的过渡面是示意，各软件算出来的形状不完全一样。</p>
        </>,
        <>
          <p>
            Sometimes the top really should be bigger than the vertical edges, say for a soft, generous round all along the top. Then don't rely on order: use a dedicated corner blend, which steps back some distance from the
            vertex and joins the three fillets with a new face.
          </p>
          <p>In SOLIDWORKS it's the fillet's Setback Parameters; Fusion's fillet has a Setback corner type. The patch here is illustrative; each package computes a slightly different shape.</p>
        </>,
      ),
      task: { label: t("顶边比竖边大，换成角落过渡面", "With the top bigger than the vertical edges, switch to a corner blend"), done: (s) => s.mode === "blend" && s.rt > s.rv + 1 },
      extra: ({ s, c }) => (
        <>
          <ModeSwitch s={s} c={c} />
          <Sliders s={s} c={c} />
        </>
      ),
    },
    {
      title: t("用反光检查角落", "Check the corner by its reflections"),
      body: byLocale(
        <>
          <p>角落是高光最容易出问题的地方。打开斑马纹：折痕处条纹断开错位；球面、圆环面和过渡面上，条纹能连着绕过去。</p>
          <p>等半径的球面和圆环面与相邻圆角只有相切（G1），条纹在边界上会拐一下；要更顺，需要曲率连续的圆角或过渡。</p>
        </>,
        <>
          <p>Corners are where highlights go wrong most easily. Turn on zebra stripes: at a crease the stripes break and jump; on a sphere, a torus or a blend patch they carry on round the corner.</p>
          <p>A constant-radius sphere or torus is only tangent (G1) to the fillets beside it, so the stripes kink at the boundaries. For smoother still, you need curvature-continuous fillets or blends.</p>
        </>,
      ),
      task: { label: t("在斑马纹下比较折痕和光顺的角", "Compare a creased corner with a smooth one under zebra stripes"), done: (s) => s.zebraSeen === 3 },
      extra: ({ s, c }) => (
        <>
          <ZebraToggle s={s} c={c} />
          <ModeSwitch s={s} c={c} />
          <Sliders s={s} c={c} />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => c.closeUp()}>
              <Scan />
              {t("看角落", "Look at the corner")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => c.overview()}>
              <LocateFixed />
              {t("看整体", "See the whole")}
            </Button>
          </div>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("竖边、顶边、底边都用 R10，角上是什么面？", "Vertical, top and bottom edges all at R10. What face forms at the corner?"),
      options: byLocale(["球面", "圆环面", "一个尖角"], ["A sphere", "A torus", "A sharp point"]),
      answer: 0,
      explain: t(
        "三个半径相等时，滚球在角上同时贴着三个面，球心不动，角上是八分之一个球面。",
        "With three equal radii, the rolling ball touches all three faces at the corner and its centre stays put: the corner is one eighth of a sphere.",
      ),
    },
    {
      q: t("竖边先做 R6，再给顶边一圈做 R15，常见的结果是？", "You fillet the vertical edges at R6 first, then the top loop at R15. What usually happens?"),
      options: byLocale(
        ["角上是光顺的圆环面", "报错，或者角上留下一道折痕", "软件自动把竖边改成 R15"],
        ["A smooth torus at the corner", "It fails, or leaves a crease at the corner", "The software changes the vertical edges to R15 for you"],
      ),
      answer: 1,
      explain: t(
        "后做的顶边圆角要绕过更小的竖边圆角，滚球转不过去。要么先做大的，要么用角落过渡（逆转参数 / Setback）。",
        "The later top fillet has to go round a smaller vertical fillet, and the rolling ball can't make the turn. Either do the big one first, or use a corner blend (Setback).",
      ),
    },
    {
      q: t("关于圆角的层级，哪种说法对？", "Which statement about fillet hierarchy is right?"),
      options: byLocale(
        ["所有边用同一个半径最协调", "定一个主圆角，其余明显小一号，大的先做", "相邻两级按黄金比例 1.618 递减才好看"],
        ["One radius on every edge looks most coherent", "Pick one dominant radius, make the others clearly smaller, and do the big one first", "Radii only look right when each level is the previous divided by the golden ratio, 1.618"],
      ),
      answer: 1,
      explain: t(
        "同一个半径让高光一样宽，分不出主次；黄金比例不是什么规则，差多少看产品。可验证的只有两点：主次要分得开，大的先做角上才收得好。",
        "One radius everywhere makes every highlight the same width, so nothing leads; the golden ratio is not a rule, and the step depends on the product. What you can check is that the levels are clearly apart, and that the big one goes first so the corners close cleanly.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先定一个主圆角（盒形产品常是竖边），其余明显小一号，底边通常最小",
      "三个半径相等，角上是球面；不等时让被绕的那个更大、先做，角上是圆环面",
      "顺序或半径不对，角上会报错或留折痕；必须反过来时用角落过渡（逆转参数 / Setback），再用斑马纹检查",
    ],
    [
      "Pick one dominant radius (often the vertical edges on a box-shaped product), make the others clearly smaller, and usually the bottom edges smallest",
      "Three equal radii make a spherical corner; with unequal ones, the fillet being turned round must be bigger and done first, and the corner becomes a torus",
      "Wrong order or radii give a failure or a crease at the corner; when it has to be the other way round, use a corner blend (Setback), then check it with zebra stripes",
    ],
  ),
  next: {
    to: "/lesson/zebra-stripes",
    label: t("斑马纹：用反光看曲面质量", "Zebra stripes: judging surfaces by their reflections"),
    text: t("G0、G1、G2 在条纹里各是什么样，以及圆角和曲率连续的混接差在哪。", "What G0, G1 and G2 look like in the stripes, and how a fillet differs from a curvature-continuous blend."),
  },
  overlay: ({ s }) => <Order s={s} />,
}

function Order({ s }: { s: HierState }) {
  const items: { n: string; name: string; r: number; bad: boolean }[] = [
    { n: "1", name: t("竖边", "Vertical"), r: s.rv, bad: false },
    { n: "2", name: t("顶边", "Top"), r: s.rt, bad: s.mode === "roll" && s.top === "crease" },
    { n: "3", name: t("底边", "Bottom"), r: s.rb, bad: s.mode === "roll" && s.bottom === "crease" },
  ]
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
      <SceneChip>
        {s.zebra ? <Eye /> : null}
        {t("圆角顺序", "Fillet order")}
        {s.mode === "blend" && <span className="text-muted-foreground"> · {t("角落过渡", "corner blend")}</span>}
      </SceneChip>
      {items.map((it) => (
        <SceneChip key={it.n} className={cn(it.bad && "text-destructive")}>
          <span className="text-muted-foreground">{it.n}</span>
          {it.name} R{fmt(it.r)}
          {it.bad && <span>· {t("比竖边大，转不过去", "bigger than the vertical, can't turn")}</span>}
        </SceneChip>
      ))}
    </div>
  )
}

export default lesson
