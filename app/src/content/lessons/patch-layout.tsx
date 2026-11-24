import { Eraser, Eye, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { kindOf, roleOf, type Role } from "./patch-layout.mouse"
import { PatchScene, type Display, type PatchState } from "./patch-layout.scene"
import type { LessonDef, StepCtx } from "./types"

/** 5.4.1 「分面/布面：主面、过渡面、圆角面的层级」. */
type Ctx = StepCtx<PatchState, PatchScene>

const DISPLAY_LABEL: Record<Display, string> = {
  shade: t("着色", "Shaded"),
  iso: t("等参线", "Isoparms"),
  zebra: t("斑马纹", "Zebra"),
}

const ROLE_LABEL: Record<Role, string> = {
  primary: t("主面", "Primary"),
  transition: t("过渡面", "Transition"),
  fillet: t("圆角面", "Fillet"),
}

const DOT: Record<Role, string> = {
  primary: "bg-(--scene-highlight)",
  transition: "bg-(--scene-good)",
  fillet: "bg-(--scene-modified)",
}

const KIND_TEXT = {
  top: t("顶面：最大、最缓的一块，定下整体体量。", "The top: the largest, gentlest patch; it sets the overall volume."),
  wall: t("侧面：大而简单，和顶面一起定下体量。", "A side: large and simple; together with the top it sets the volume."),
  cornerWall: t("竖向转角：把两块侧面接起来的带子，宽窄可以单独调。", "A vertical corner: the band that joins two sides, with a width you can adjust on its own."),
  edgeBlend: t("顶面和侧面之间的过渡带：两边都 G2 接上，决定边缘看着软还是硬。", "The band between top and side: G2 to both, it decides whether the edge looks soft or crisp."),
  cornerPatch: t("三条过渡汇到一起的角片：靠周围的面定形，最后才做，和圆角同一层。", "The corner patch where three transitions meet: shaped by its neighbours and made last, in the same layer as fillets."),
}

function DisplaySwitch({ s, c, only }: Ctx & { only?: Display[] }) {
  const all: Display[] = only ?? ["shade", "iso", "zebra"]
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("显示", "Display")}</span>
      <Segmented size="sm" aria-label={t("显示", "Display")} value={s.display} onValueChange={(d: Display) => c.setDisplay(d)} options={all.map((d) => ({ value: d, label: DISPLAY_LABEL[d] }))} />
    </div>
  )
}

function RoleName({ r }: { r: Role }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${DOT[r]}`} />
      {ROLE_LABEL[r]}
    </span>
  )
}

function Labelling({ s, c }: Ctx) {
  const sc = PatchScene.score(s)
  const last = s.last
  const right = last ? s.labels[last] === roleOf(last) : false
  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-small font-medium">{t("标为", "Label as")}</span>
        <Segmented
          size="sm"
          aria-label={t("标为", "Label as")}
          value={s.brush}
          onValueChange={(r: Role) => c.setBrush(r)}
          options={(["primary", "transition", "fillet"] as Role[]).map((r) => ({ value: r, label: <RoleName r={r} /> }))}
        />
      </div>
      <div className="mt-3 flex items-center">
        <Readout label={t("已标", "Labelled")} value={sc.done} unit={`/ ${sc.total}`} />
        <Readout label={t("标对", "Correct")} value={sc.right} unit={`/ ${sc.total}`} tone={sc.right === sc.total ? "success" : undefined} />
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => c.clearLabels()}>
          <Eraser />
          {t("全部清除", "Clear all")}
        </Button>
      </div>
      {last && (
        <Hint tone={right ? undefined : "warning"}>
          {right ? t("对。", "Right. ") : t(`不是${ROLE_LABEL[s.labels[last]!]}。`, `Not a ${ROLE_LABEL[s.labels[last]!].toLowerCase()}. `)}
          {KIND_TEXT[kindOf(last)]}
        </Hint>
      )}
    </>
  )
}

function LayerStepper({ s, c }: Ctx) {
  const names = byLocale(["主面", "过渡面", "角片与圆角"], ["Primaries", "Transitions", "Corners and fillets"])
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {names.map((n, i) => (
        <Button key={n} size="sm" variant={s.layer === i + 1 ? "primary" : "secondary"} onClick={() => c.setLayer(i + 1)}>
          {i + 1}. {n}
        </Button>
      ))}
    </div>
  )
}

const lesson: LessonDef<PatchState, PatchScene> = {
  id: "patch-layout",
  codes: ["5.4.1"],
  title: t("分面/布面：主面、过渡面、圆角面的层级", "Patch layout: primary, transition and fillet surfaces"),
  create: (v, emit) => new PatchScene(v, emit),
  steps: [
    {
      title: t("同一只鼠标，两种布面", "One mouse, two patch layouts"),
      body: byLocale(
        <>
          <p>左边 A：顶面连同边缘的圆滚，全交给一张大面，再用侧壁硬剪出轮廓。右边 B：先定几张大而简单的主面（顶面和四个侧面），再用过渡面把它们接起来，四个角上是三条过渡汇合的角片。</p>
          <p>细线是等参线，曲面内部 u、v 两个方向的参数线。A 的等参线是一张规则的网，被剪裁边随意切断，和造型没有关系；B 的等参线顺着造型走。</p>
        </>,
        <>
          <p>
            On the left, A: the top and the roll over the edge are all left to one big surface, and the side wall trims the outline out of it. On the right, B: first a few large, simple
            primary surfaces (the top and four sides), then transitions that join them, and in each corner a patch where three transitions meet.
          </p>
          <p>
            The thin lines are isoparms, the parameter lines running through a surface in its u and v directions. A's isoparms are a regular net cut off at random by the trim edge,
            with nothing to do with the form; B's isoparms follow the form.
          </p>
        </>,
      ),
      task: { label: t("转动视图，比较两边的等参线", "Orbit the view and compare the isoparms of the two"), done: (s) => s.orbited },
      extra: (ctx) => <DisplaySwitch {...ctx} only={["shade", "iso"]} />,
    },
    {
      title: t("斑马纹：谁更顺", "Zebra stripes: which is smoother?"),
      body: byLocale(
        <>
          <p>B 的条纹在主面上平稳、宽窄渐变，经过过渡面时顺滑地转弯。</p>
          <p>A 只有一张面，却要同时做平缓的顶面和急转的边缘。控制点不够用的地方，条纹就扭动、疏密不匀，到了剪裁边又突然折断。</p>
        </>,
        <>
          <p>On B, the stripes run steadily over the primaries, widening and narrowing gradually, and turn smoothly as they cross the transitions.</p>
          <p>
            A has a single surface that has to be both the gentle top and the sharp turn at the edge. Where it runs out of control points, the stripes wriggle and bunch up, then
            break off at the trim edge.
          </p>
        </>,
      ),
      task: { label: t("打开斑马纹，对比两边", "Turn on zebra stripes and compare the two"), done: (s) => s.zebraSeen },
      extra: (ctx) => (
        <>
          <Predict
            question={t("A 用一张面包住顶面和边缘。它的斑马纹在边缘附近会怎样？", "A wraps the top and the edge in one surface. What will its zebra stripes do near the edge?")}
            options={byLocale(
              ["和 B 一样顺", "条纹扭动、疏密不匀，到剪裁边就断", "整张面都是平行的直条纹"],
              ["Just as smooth as B", "They wriggle and bunch up, then break at the trim edge", "Straight, parallel stripes over the whole surface"],
            )}
            answer={1}
            explain={t(
              "一张面的控制点是一张规则的网，不能只在边缘加密。顶面嫌多、边缘不够，急转的地方曲率起伏，反光就扭了。",
              "A surface's control points form one regular net; you can't add them only at the edge. Too many for the top and too few for the edge, so the curvature ripples where the surface turns sharply and the reflections wriggle.",
            )}
            onReveal={() => ctx.c.setDisplay("zebra")}
          />
          <DisplaySwitch {...ctx} />
        </>
      ),
    },
    {
      title: t("给面分层：点选标注", "Sort the patches: click to label them"),
      body: byLocale(
        <>
          <p>只看 B。先选一个层级，再到视图里点面片；左右对称的两块会一起标上。</p>
          <p>主面：最大、最缓，定体量。过渡面：把主面接起来的带子。圆角面：最小、最后做的一层；四个角上三条过渡汇合的角片也算在这一层。</p>
          <p>背面的几块要转过去才看得见。</p>
        </>,
        <>
          <p>Only B now. Pick a layer, then click patches in the view; the mirror-image patch on the other side is labelled with it.</p>
          <p>
            Primary: the largest and gentlest, they set the volume. Transition: the bands that join the primaries. Fillet: the smallest layer, made last; the corner patches where
            three transitions meet belong here too.
          </p>
          <p>The patches at the back only show once you turn the model round.</p>
        </>,
      ),
      task: { label: t("把 17 块面片都标对", "Label all 17 patches correctly"), done: (s) => PatchScene.score(s).right === PatchScene.score(s).total },
      extra: (ctx) => (
        <>
          <Labelling {...ctx} />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => ctx.c.resetView()}>
            <LocateFixed />
            {t("回到原视角", "Back to the original view")}
          </Button>
        </>
      ),
    },
    {
      title: t("先主面，后过渡，最后圆角", "Primaries first, then transitions, fillets last"),
      body: byLocale(
        <>
          <p>按层级搭一遍。第 1 层只有主面：顶面和侧面都做得比最终大，互相交出尖边。第 2 层用过渡面把主面接起来，同时把主面剪回去。第 3 层补上角片。</p>
          <p>主面先做、做简单，因为后面每一层都从它上面长出来：改主面，过渡和角片跟着重建。拖动顶面高度试试。</p>
          <p>圆角放最后：它依赖所有的面，放最后改起来代价最小，做不出来也只坏它自己。</p>
        </>,
        <>
          <p>
            Build it layer by layer. Layer 1 is the primaries only: the top and sides are made larger than they end up and meet at sharp edges. Layer 2 joins them with transitions
            and trims the primaries back. Layer 3 fills in the corner patches.
          </p>
          <p>Primaries come first and stay simple because every later layer grows out of them: change a primary and the transitions and corners rebuild with it. Drag the top height and see.</p>
          <p>Fillets go last: they depend on every other surface, so last is where changes cost least, and if one fails only the fillet breaks.</p>
        </>,
      ),
      task: { label: t("走完三层，再改一次顶面高度", "Step through the three layers, then change the top height"), done: (s) => s.steppedAll && s.h0Changed },
      extra: (ctx) => (
        <>
          <LayerStepper {...ctx} />
          <ParamSlider className="mt-3 px-0" label={t("顶面高度", "Top height")} value={ctx.s.h0} min={32} max={44} step={0.5} onChange={(v) => ctx.c.setH0(v)} />
        </>
      ),
    },
    {
      title: t("过渡面定气质", "Transitions set the character"),
      body: byLocale(
        <>
          <p>主面定体量，过渡面定气质：过渡带宽，边缘看着软、圆润；窄，就利落、紧绷。</p>
          <p>在斑马纹下拖动过渡宽度，看条纹在边缘怎么转弯。不管宽窄，条纹始终连着，因为过渡面和两边都是 G2。</p>
          <p>分面线放在曲率变化的地方，顺着造型走，别横穿最显眼的高光。</p>
        </>,
        <>
          <p>Primaries set the volume; transitions set the character. A wide transition makes the edge look soft and full; a narrow one makes it crisp and taut.</p>
          <p>Under zebra stripes, drag the transition width and watch how the stripes turn at the edge. Wide or narrow, they stay connected, because the transitions are G2 to both sides.</p>
          <p>Put patch boundaries where the curvature changes, running with the form, and keep them off the most visible highlights.</p>
        </>,
      ),
      task: { label: t("在斑马纹下改变过渡宽度", "Change the transition width with zebra stripes on"), done: (s) => s.tsChanged },
      extra: (ctx) => (
        <>
          <DisplaySwitch {...ctx} />
          <ParamSlider className="mt-3 px-0" label={t("过渡宽度", "Transition width")} value={ctx.s.ts} min={5} max={11} step={0.5} onChange={(v) => ctx.c.setTs(v)} />
        </>
      ),
      note: t(
        "Rhino 用 BlendSrf（选曲率连续）做过渡面；SOLIDWORKS 常用「边界曲面」，或带「曲率连续」选项的圆角。命令各家不同，层级的思路一样。",
        "In Rhino, BlendSrf (set to curvature continuity) makes transitions; in SOLIDWORKS you'd typically use a Boundary Surface, or a fillet with the Curvature continuous option. The commands differ from package to package; the layered approach is the same.",
      ),
      noteTitle: t("各软件做法", "In each package"),
    },
  ],
  quiz: [
    {
      q: t("为什么主面要先做，而且尽量简单？", "Why are primary surfaces built first, and kept as simple as possible?"),
      options: byLocale(
        ["主面面积大、计算慢，先做省时间", "过渡面和圆角都从主面上长出来；主面一改全跟着变，简单才好改、好控制光顺", "软件规定必须按这个顺序"],
        [
          "They're large and slow to compute, so doing them first saves time",
          "Transitions and fillets grow out of them; change a primary and everything follows, so simple primaries are easier to change and keep smooth",
          "The software requires this order",
        ],
      ),
      answer: 1,
      explain: t(
        "主面是后面所有面的输入。它控制点少、形状单纯，改起来快，高光也好控制；复杂的主面会把问题传给每一张过渡面。",
        "The primaries are the input to every surface after them. With few control points and a plain shape they're quick to change and their highlights are easy to control; a complicated primary passes its problems on to every transition.",
      ),
    },
    {
      q: t("布面 A 用一张面包住顶面和边缘，最典型的问题是？", "Layout A wraps the top and the edge in one surface. What's the most typical problem?"),
      options: byLocale(
        ["面片太少，导不出 STEP", "等参线不跟造型走，边缘急弯处控制点不够，高光扭动", "斑马纹完全看不出来"],
        ["Too few patches to export a STEP file", "The isoparms ignore the form, the sharp turn at the edge lacks control points, and the highlights wriggle", "Zebra stripes don't show at all"],
      ),
      answer: 1,
      explain: t(
        "一张面的控制点是一张规则的网：要在边缘加密，整张面都得加，顶面就容易起伏。剪裁边又横着切断等参线，后面倒圆角也难做。",
        "A surface's control points are one regular net: add them at the edge and you add them everywhere, so the top starts to ripple. The trim edge also cuts across the isoparms, which makes fillets along it hard later.",
      ),
    },
    {
      q: t("分面的边界线一般放在哪里？", "Where do patch boundaries usually go?"),
      options: byLocale(
        ["随便切，反正最后要剪裁", "放在曲率变化的地方，顺着造型走，避开最显眼的高光", "尽量切成大小一样的方块"],
        ["Anywhere; it all gets trimmed in the end", "Where the curvature changes, running with the form, away from the most visible highlights", "Into squares of equal size, as far as possible"],
      ),
      answer: 1,
      explain: t(
        "边界就是造型换性格的地方：从平缓的主面转进过渡带。边界顺着造型走，每张面只做一件事；横穿高光的边界，连续性稍差就一眼看出来。",
        "A boundary is where the form changes character, from a gentle primary into a transition. Boundaries that follow the form let each patch do one job; one that cuts across a highlight shows any lapse in continuity at a glance.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先用少量大而简单的主面定体量，再做过渡面，最后做圆角和角片",
      "每张面只干一件事：等参线顺着造型走，斑马纹才好控制",
      "一张面包打天下，边缘急弯和硬剪裁会让高光扭动，也很难再改",
    ],
    [
      "Set the volume with a few large, simple primaries, then add transitions, and fillets and corner patches last",
      "Give each patch one job: when the isoparms follow the form, the zebra stripes are easy to control",
      "One surface for everything, with a sharp turn at the edge and a hard trim, gives wriggling highlights and is hard to change later",
    ],
  ),
  next: {
    to: "/lesson/singularities",
    label: t("四边面、奇点与收敛点", "Four-sided patches, poles and singular points"),
    text: t("角片和圆顶为什么要尽量做成四边面，收敛到一点会出什么问题。", "Why corner patches and domes should be four-sided wherever possible, and what goes wrong when a surface collapses to a point."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        <Eye />
        {DISPLAY_LABEL[s.display]}
      </SceneChip>
      {s.step === 2 && (
        <SceneChip tone="primary">
          {t("标对", "Correct")} {PatchScene.score(s).right} / {PatchScene.score(s).total}
        </SceneChip>
      )}
      {s.step === 3 && <SceneChip tone="primary">{t(`第 ${s.layer} 层`, `Layer ${s.layer}`)}</SceneChip>}
    </div>
  ),
}

export default lesson
