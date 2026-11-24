import { Layers, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { deviationOf, METHODS, SurfaceFromCurvesScene, type Method, type SfcState } from "./surface-from-curves.scene"
import type { LessonDef } from "./types"

/** 5.2.1 「由曲线生成曲面」. */

const SHORT: Record<Method, string> = {
  loft: t("放样", "Loft"),
  sweep1: t("单轨", "Sweep1"),
  sweep2: t("双轨", "Sweep2"),
  network: t("网线", "Network"),
  edge: t("边缘", "Edges"),
}

const FULL: Record<Method, string> = {
  loft: t("放样", "Loft"),
  sweep1: t("单轨扫掠", "Sweep along one rail"),
  sweep2: t("双轨扫掠", "Sweep along two rails"),
  network: t("网线", "Curve network"),
  edge: t("边缘曲线", "Edge curves"),
}

function methodNote(m: Method, dev: number) {
  const d = dev.toFixed(1)
  switch (m) {
    case "loft":
      return t(
        "放样：结构线落在三条截面上。截面之间的形状靠插值，两条长边没有曲线管着，这里碰巧吻合。",
        "Loft: the structure lines sit on the three sections. Between them the shape comes from interpolation; nothing holds the long edges, and here they happen to fit.",
      )
    case "sweep1":
      return t(
        `单轨扫掠：中间截面沿中线走，形状处处一样。两端本该矮一些，结果四个角离设计意图 ${d} mm。`,
        `Sweep along one rail: the middle section travels along the spine and keeps its shape everywhere. The ends should be lower, so the four corners end up ${d} mm off the intent.`,
      )
    case "sweep2":
      return t(
        "双轨扫掠：两条轨道管住两条长边，三条截面管住形状，和设计意图吻合。",
        "Sweep along two rails: the rails hold the long edges and the three sections hold the shape. It matches the intent.",
      )
    case "network":
      return t(
        "网线：两个方向的六条曲线全用上，结构线顺着输入曲线走，和设计意图吻合。",
        "Curve network: all six curves in both directions are used, and the structure lines follow them. It matches the intent.",
      )
    case "edge":
      return t(
        `边缘曲线：只用四条边。中间只是四条边的混合，比设计意图低了 ${d} mm。`,
        `Edge curves: only the four edges are used. The middle is just a blend of the edges, ${d} mm lower than the intent.`,
      )
  }
}

function MethodSwitch({ s, c }: { s: SfcState; c: SurfaceFromCurvesScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("建法", "Method")}</span>
      <Segmented size="sm" aria-label={t("建法", "Method")} value={s.method} onValueChange={(m: Method) => c.setMethod(m)} options={METHODS.map((m) => ({ value: m, label: SHORT[m] }))} />
    </div>
  )
}

/** What the right pick teaches, per curve set. */
const SET_OK: string[] = [
  t("两个方向各三条曲线，互相交叉：网线把六条全用上，面同时贴住每一条。", "Three curves each way, crossing: a curve network uses all six, and the surface follows every one of them."),
  t("一条 U 形截面加一条路径：截面沿路径走，形状处处一样。排水槽、装饰条、密封条都这样建。", "One U-shaped section and one path: the section travels along the path and keeps its shape. Gutters, trim strips and seals are built this way."),
  t("四条边首尾相接围成一圈，中间没有别的曲线：边缘曲线最直接。", "Four edges joined end to end in a loop, with nothing in between: edge curves is the direct way."),
  t("四条截面排开，彼此不相交：放样依次穿过它们。船体、瓶身、机翼都这样建。", "Four sections spaced out, not touching: a loft passes through them in turn. Hulls, bottles and wings are built this way."),
  t("两条轨道管住两条边，起点有一条截面：截面沿两条轨道走，跟着变宽。", "Two rails hold the two edges, with one section at the start: it travels along both rails and widens with them."),
]
const ALSO_OK = t(
  "也能建出来：四条边也可以看成 2 × 2 的网，或两条轨道加两条截面。只有四条边时，边缘曲线最省事。",
  "That works too: four edges are also a 2 × 2 network, or two rails and two sections. With only four edges, edge curves is the simplest.",
)
const NEEDS: Record<Method, string> = {
  loft: t("放样要几条排开、互不相交的截面。", "A loft needs several sections spaced out, not crossing each other."),
  sweep1: t("单轨扫掠要一条截面加一条路径。", "Sweep along one rail needs a section and a path."),
  sweep2: t("双轨扫掠要两条轨道，截面横跨在两条轨道之间。", "Sweep along two rails needs two rails, with sections spanning between them."),
  network: t("网线要两个方向互相交叉的曲线。", "A curve network needs curves in two directions that cross each other."),
  edge: t("边缘曲线要 2–4 条首尾相接、围成一圈的边。", "Edge curves needs two to four edges joined end to end in a loop."),
}
/** Picks that do build something but throw input away. */
const PARTLY: Record<string, string> = {
  "0:loft": t("能放样出来，但只用上一个方向的三条，另一个方向的三条被忽略，面不一定贴得住它们。", "You can loft it, but only the three curves in one direction are used. The other three are ignored, and the surface may not follow them."),
  "0:sweep2": t("能扫出来：两条做轨道，三条做截面。但中间那条纵向曲线被忽略了。", "You can sweep it: two curves as rails, three as sections. But the middle curve along the rails is ignored."),
  "2:loft": t("能在两条对边之间放样，但另外两条边被忽略了。", "You can loft between two opposite edges, but the other two edges are ignored."),
  "4:sweep1": t("能扫出来，但只有一条轨道起作用，另一条边管不住。", "You can sweep it, but only one rail counts. The other edge isn't held."),
}

function MatchGame({ s, c }: { s: SfcState; c: SurfaceFromCurvesScene }) {
  const cs = c.curveSet(s.set)
  const pick = s.pick
  const ok = pick && (pick === cs.best || cs.also.includes(pick))
  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-small font-medium">{t("曲线组", "Curve set")}</span>
        <Segmented
          size="sm"
          aria-label={t("曲线组", "Curve set")}
          value={String(s.set)}
          onValueChange={(v) => c.setSet(Number(v))}
          options={s.matched.map((m, i) => ({ value: String(i), label: m ? `${i + 1} ✓` : String(i + 1) }))}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {METHODS.map((m) => (
          <Button key={m} size="sm" variant={pick === m ? "primary" : "secondary"} onClick={() => c.pickMethod(m)}>
            {FULL[m]}
          </Button>
        ))}
      </div>
      {pick && ok && <Hint>{pick === cs.best ? SET_OK[s.set] : ALSO_OK}</Hint>}
      {pick && !ok && <Hint tone="warning">{PARTLY[`${s.set}:${pick}`] ?? `${NEEDS[pick]}${t("再看看这组曲线。", " Look at this set again.")}`}</Hint>}
    </>
  )
}

const lesson: LessonDef<SfcState, SurfaceFromCurvesScene> = {
  id: "surface-from-curves",
  codes: ["5.2.1"],
  title: t("由曲线生成曲面", "Surfaces from curves"),
  create: (v, emit) => new SurfaceFromCurvesScene(v, emit),
  steps: [
    {
      title: t("同一个面，五种建法", "One surface, five ways to build it"),
      body: byLocale(
        <>
          <p>这块面板 120 × 80 mm，四条边都拱起，中间再多拱 4 mm，像车顶或一个盖子。同一个设计意图，可以用不同的曲线、不同的命令建出来。</p>
          <p>蓝线是命令用到的输入曲线，细线是结果的结构线（isoparm），它们表示曲面的控制点排在哪里。灰色半透明的是设计意图，结果偏离时才显示。</p>
        </>,
        <>
          <p>This panel is 120 × 80 mm. All four edges are arched, and the middle rises another 4 mm, like a car roof or a lid. The same design intent can be built from different curves with different commands.</p>
          <p>
            The blue lines are the input curves each command uses. The thin lines are the result's structure lines (isoparms): they show where the surface's control points sit. The
            translucent grey is the design intent, shown only when the result strays from it.
          </p>
        </>,
      ),
      task: { label: t("五种建法都看一遍", "Look at all five methods"), done: (s) => METHODS.every((m) => s.seen.includes(m)) },
      extra: ({ s, c }) => (
        <>
          <MethodSwitch s={s} c={c} />
          <Hint>{methodNote(s.method, deviationOf(s.method, s.crown).d)}</Hint>
        </>
      ),
      note: t(
        "Rhino：放样 Loft、单轨扫掠 Sweep1、双轨扫掠 Sweep2、网线 NetworkSrf、边缘曲线 EdgeSrf。SOLIDWORKS：放样曲面、扫描曲面、边界曲面（两个方向都能给曲线，接近网线）、填充曲面。Fusion：放样、扫掠、面片。各软件的算法不同，同样的曲线建出来的面会有细微差别。",
        "Rhino: Loft, Sweep1, Sweep2, NetworkSrf, EdgeSrf. SOLIDWORKS: Lofted Surface, Swept Surface, Boundary Surface (takes curves in both directions, close to a network) and Filled Surface. Fusion: Loft, Sweep, Patch. The algorithms differ, so the same curves give slightly different surfaces in each package.",
      ),
      noteTitle: t("各软件叫法", "What each package calls them"),
      terms: ["loft", "sweep"],
    },
    {
      title: t("谁在听中间那条线", "Who listens to the middle curve"),
      body: byLocale(
        <>
          <p>设计意图里，中间的拱高是独立的。拖动蓝色圆点，抬高或压低中间截面和中线。</p>
          <p>命令只知道你选给它的曲线。放样、双轨扫掠、网线都用了中间的曲线，会跟着变；单轨扫掠的截面处处一样，整块面一起变；边缘曲线根本没用中间的线。</p>
        </>,
        <>
          <p>In the design intent, the crown in the middle is independent. Drag the blue dot to raise or lower the middle section and the spine.</p>
          <p>
            A command only knows the curves you give it. Loft, sweep along two rails and the network all use the middle curve, so they follow it. Sweep along one rail has the same
            section everywhere, so the whole panel changes. Edge curves doesn't use the middle curve at all.
          </p>
        </>,
      ),
      task: {
        label: t("拖动中间的拱高，再切到「边缘」看看", "Drag the crown in the middle, then switch to Edges"),
        done: (s) => s.crownChanged && s.sawEdgeAfterCrown,
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把中间拱高从 4 mm 加到 12 mm，「边缘曲线」建出来的面会怎样？", "You raise the extra crown in the middle from 4 mm to 12 mm. What happens to the edge-curve surface?")}
            options={byLocale(
              ["跟着拱起来", "不变：中间的曲线根本没被选进去", "报错，曲线不再首尾相接"],
              ["It rises with it", "Nothing: the middle curve was never selected", "It fails, because the curves no longer meet end to end"],
            )}
            answer={1}
            explain={t(
              "边缘曲线只用四条边，中间是四条边的混合。想让中间听话，就得把中间的曲线交给命令：网线、双轨扫掠，或者放样多加一条截面。",
              "Edge curves uses only the four edges, and the middle is a blend of them. To control the middle, give the command the middle curve: a network, a two-rail sweep, or a loft with one more section.",
            )}
            onReveal={() => c.raiseCrown()}
          />
          <MethodSwitch s={s} c={c} />
          <div className="mt-3">
            <Readout label={t("中间拱高", "Crown in the middle")} value={s.crown.toFixed(1)} unit="mm" tone="primary" />
            <Readout label={t("离设计意图", "Off the intent")} value={deviationOf(s.method, s.crown).d.toFixed(1)} unit="mm" tone={deviationOf(s.method, s.crown).d > 0.2 ? "warning" : "success"} />
          </div>
        </>
      ),
    },
    {
      title: t("看曲线，选命令", "Read the curves, pick the command"),
      body: byLocale(
        <>
          <p>拿到一组曲线，先看它们之间的关系：一条截面加一条路径？几条排开的截面？两个方向互相交叉？还是首尾相接围成一圈？关系决定用哪个命令。</p>
          <p>有的曲线组用几种命令都能建，但会丢掉一部分曲线。选能把所有曲线都用上的那个。</p>
        </>,
        <>
          <p>When you're handed a set of curves, look first at how they relate: one section and a path? Several sections spaced out? Curves crossing in two directions? Or edges joined end to end in a loop? The relationship decides the command.</p>
          <p>Some sets can be built several ways, but some ways throw curves away. Pick the one that uses all of them.</p>
        </>,
      ),
      task: { label: t("五组曲线都配上合适的命令", "Match all five curve sets to a suitable command"), done: (s) => s.matched.every(Boolean) },
      extra: ({ s, c }) => <MatchGame s={s} c={c} />,
    },
    {
      title: t("放样：顺序和方向", "Loft: order and direction"),
      body: byLocale(
        <>
          <p>放样按你选截面的顺序连接，并把每条截面的起点连起点、终点连终点。圆点是起点，箭头是方向。</p>
          <p>顺序乱了，曲面会折回来；有一条方向反了，曲面会拧成麻花。在视图里点截面就是选它，点箭头可以把方向反过来。</p>
        </>,
        <>
          <p>A loft joins the sections in the order you pick them, start point to start point and end to end. The dot marks each section's start, the arrow its direction.</p>
          <p>Pick them out of order and the surface folds back on itself; if one runs the other way, the surface twists. Click a section in the view to pick it, and click an arrow to flip that section's direction.</p>
        </>,
      ),
      task: {
        label: t("把 C 的箭头翻过来，再依次点选 A、B、C、D", "Flip C's arrow, then pick A, B, C and D in turn"),
        done: (s) => s.clean,
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("按 A、B、C、D 的顺序放样，其中 C 的箭头朝另一边，会得到什么？", "You loft A, B, C, D in order, and C's arrow points the other way. What do you get?")}
            options={byLocale(
              ["一张正常的面，软件会自动对齐方向", "C 附近拧成麻花", "C 被跳过"],
              ["A normal surface: the software lines the directions up for you", "A twist around C", "C gets skipped"],
            )}
            answer={1}
            explain={t(
              "放样把起点连起点。C 的起点在另一侧，连线交叉，面就拧过去了。不要指望软件替你对齐：Rhino 要在曲线的同一端点选，或用「对齐曲线」点端点反转；SOLIDWORKS 里点选轮廓的位置决定连接点。",
              "A loft joins start to start. C starts on the other side, so the connections cross and the surface twists. Don't count on the software to line them up: in Rhino, pick the curves near the same end or use Align curves to flip one; in SOLIDWORKS, where you click on each profile decides the connection points.",
            )}
            onReveal={() => c.loftAsIs()}
          />
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={() => c.resetOrder()}>
              <RotateCcw />
              {t("重新选择", "Pick again")}
            </Button>
            <Readout label={t("已选", "Picked")} value={s.order.length ? s.order.map((i) => "ABCD"[i]).join(" → ") : "–"} />
          </div>
          {s.clean && <Hint>{t("顺序对，方向一致：一张干净的面，结构线均匀地排在四条截面上。", "In order and all one way: a clean surface, its structure lines evenly on the four sections.")}</Hint>}
        </>
      ),
      terms: ["loft"],
    },
    {
      title: t("截面越多越好吗", "Are more sections better?"),
      body: byLocale(
        <>
          <p>测量或描出来的截面难免有零点几毫米的误差。放样必须穿过每一条截面：截面越多，误差就越多地变成曲面上的波纹。这里用斑马纹把它放大出来。</p>
          <p>好的做法：用尽量少的截面表达形状，各截面的点数和阶数一致；多出来的测量数据留着做检查，不拿来建面。</p>
        </>,
        <>
          <p>Measured or traced sections always carry errors of a few tenths of a millimetre. A loft must pass through every section, so the more sections, the more of those errors turn into ripples in the surface. Zebra stripes magnify them here.</p>
          <p>Good practice: describe the shape with as few sections as you can, each with the same point count and degree. Keep the extra measurements for checking, not for building.</p>
        </>,
      ),
      task: { label: t("3 条和 9 条截面都看一看", "Look at both 3 and 9 sections"), done: (s) => s.sawMany && s.sawFew },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("同一块面板，用 9 条带 ±0.5 mm 误差的截面放样，会比 3 条截面更好吗？", "The same panel, lofted through 9 sections with errors of ±0.5 mm. Is it better than 3 sections?")}
            options={byLocale(
              ["更好：截面越多越准", "斑马纹出现波纹：面要硬穿过每一条误差", "看不出区别"],
              ["Better: more sections, more accuracy", "Ripples in the zebra stripes: the surface has to pass through every error", "No visible difference"],
            )}
            answer={1}
            explain={t(
              "截面靠得越近，同样的误差造成的斜率变化越大，反光就跟着起伏。点数一多，曲面也更「重」，后面更难改。",
              "The closer the sections, the bigger the change in slope from the same error, and the reflections ripple with it. More points also make the surface heavier and harder to edit later.",
            )}
            onReveal={() => c.setMany(true)}
          />
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("截面", "Sections")}</span>
            <Segmented
              size="sm"
              aria-label={t("截面", "Sections")}
              value={s.many ? "9" : "3"}
              onValueChange={(v) => c.setMany(v === "9")}
              options={[
                { value: "3", label: t("3 条", "3") },
                { value: "9", label: t("9 条，带误差", "9, with errors") },
              ]}
            />
          </div>
          <div className="mt-3">
            <Readout label={t("控制点", "Control points")} value={s.many ? "9 × 5 = 45" : "3 × 5 = 15"} />
          </div>
        </>
      ),
      note: t(
        "要消掉截面之间的波纹，得减少截面，或建完后把曲面重建成更少的控制点；代价是曲面不再严格穿过每条截面。只重建每条截面本身，消不掉截面之间的起伏。",
        "To remove ripples between sections, use fewer sections, or rebuild the finished surface with fewer control points; the cost is that it no longer passes exactly through every section. Rebuilding each section on its own doesn't remove the waviness between them.",
      ),
      noteTitle: t("怎么消掉波纹", "Getting rid of ripples"),
    },
  ],
  quiz: [
    {
      q: t("手上有两个方向互相交叉的曲线，各三条，想让面同时贴住所有曲线，用哪个？", "You have curves crossing in two directions, three each way, and want the surface to follow all of them. Which command?"),
      options: byLocale(["放样，选一个方向的三条", "网线（SOLIDWORKS 用边界曲面）", "单轨扫掠"], ["A loft through three of them", "A curve network (Boundary Surface in SOLIDWORKS)", "Sweep along one rail"]),
      answer: 1,
      explain: t(
        "放样只用一个方向的曲线，另一个方向会被忽略。网线（边界曲面）两个方向都用上。",
        "A loft uses curves in one direction only and ignores the rest. A network (boundary surface) uses both directions.",
      ),
    },
    {
      q: t("放样出来的面在中间拧成了麻花，最可能的原因是？", "A lofted surface twists in the middle. What's the most likely cause?"),
      options: byLocale(
        ["截面太少", "有一条截面的方向（或起点）和其他的相反", "建模公差太小"],
        ["Too few sections", "One section's direction (or start point) is opposite to the others", "The modelling tolerance is too tight"],
      ),
      answer: 1,
      explain: t(
        "放样把起点连起点、终点连终点。一条反了，连线交叉，面就拧过去。把它反过来，或在同一端点选。",
        "A loft joins start to start and end to end. If one section is reversed, the connections cross and the surface twists. Flip it, or pick every section near the same end.",
      ),
    },
    {
      q: t("为了更准，用 15 条测量截面放样，斑马纹出现了波纹。该怎么改？", "For accuracy you lofted through 15 measured sections, and the zebra stripes ripple. How do you fix it?"),
      options: byLocale(
        ["把每条截面重建成更多控制点", "减少截面，只留表达形状所需的几条，并统一点数和阶数", "再加几条截面，把误差平均掉"],
        ["Rebuild each section with more control points", "Use fewer sections, just enough to describe the shape, with the same point count and degree", "Add more sections so the errors average out"],
      ),
      answer: 1,
      explain: t(
        "放样必须穿过每一条截面，误差不会被平均，只会变成波纹。少而干净的截面，面才光顺；多余的数据拿来检查偏差。",
        "A loft must pass through every section, so the errors aren't averaged out; they become ripples. Few, clean sections give a smooth surface. Use the extra data to check the deviation.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先看曲线的关系再选命令：排开的截面用放样，截面加路径用扫掠，两个方向交叉用网线，围成一圈的边用边缘曲线",
      "命令只知道你给它的曲线：边缘曲线不管中间，单轨扫掠的截面处处一样",
      "放样的截面要顺序对、方向一致、少而干净，否则会折、会扭、会起波纹",
    ],
    [
      "Read how the curves relate before picking a command: spaced sections → loft, section plus path → sweep, curves crossing both ways → network, edges in a loop → edge curves",
      "A command only knows the curves you give it: edge curves ignores the middle, and a one-rail sweep keeps the same section everywhere",
      "Loft sections need the right order, one direction, and few clean curves; otherwise the surface folds, twists or ripples",
    ],
  ),
  next: {
    to: "/lesson/surface-matching",
    label: t("曲面连续性与匹配", "Surface continuity and matching"),
    text: t("面建好了，下一步让相邻的面接得光顺。", "With the surfaces built, the next step is making neighbours meet smoothly."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        <Layers />
        {s.step <= 1 ? FULL[s.method] : s.step === 2 ? t(`曲线组 ${s.set + 1}`, `Curve set ${s.set + 1}`) : s.step === 3 ? t("放样", "Loft") : t("斑马纹", "Zebra stripes")}
      </SceneChip>
      {s.step === 1 && <SceneChip tone="primary">{t(`中间拱高 ${s.crown.toFixed(1)} mm`, `Crown ${s.crown.toFixed(1)} mm`)}</SceneChip>}
      {s.step === 4 && <SceneChip tone="primary">{s.many ? t("9 条截面", "9 sections") : t("3 条截面", "3 sections")}</SceneChip>}
    </div>
  ),
}

export default lesson
