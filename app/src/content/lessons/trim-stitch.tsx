import { Box, Combine, LocateFixed, RotateCcw, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { allFixed, fakeSeams, openSeams, PROBLEMS, TOLS, TrimStitchScene, type Problem, type Tool, type TrimState } from "./trim-stitch.scene"
import type { LessonDef } from "./types"

/** 5.2.3 「修剪、分割、缝合与封闭」. */

const PROBLEM_TEXT: Record<Problem, string> = {
  front: t("前壁短了 0.8 mm：上边没碰到顶面，中间是一条缝。", "The front wall is 0.8 mm short: its top edge doesn't reach the top, leaving a gap."),
  right: t("右壁太高：穿过顶面伸了出去，上边悬在空中。", "The right wall is too tall: it pokes up through the top, and its top edge hangs in the air."),
  back: t("顶面的后边差了 0.4 mm：两条边几乎重合，但没接上。", "The top's back edge is 0.4 mm short: the two edges nearly coincide, but don't meet."),
  left: t("左壁偏了 0.004 mm：肉眼看不出，可在 0.001 mm 的公差下也算一条缝。", "The left wall is 0.004 mm off: invisible, but at a 0.001 mm tolerance it still counts as a gap."),
  bottom: t("没有底面：底部一整圈都是开口。", "There's no bottom: the whole bottom is open."),
}

const TOOLS: { value: Tool; label: string }[] = [
  { value: "extend", label: t("延伸", "Extend") },
  { value: "trim", label: t("修剪", "Trim") },
  { value: "match", label: t("匹配", "Match") },
  { value: "cap", label: t("加盖", "Cap") },
]

const fmtTol = (x: number) => (x < 0.01 ? x.toFixed(3) : x < 0.1 ? x.toFixed(2) : x < 1 ? x.toFixed(1) : x.toFixed(0))

function TolSlider({ s, c }: { s: TrimState; c: TrimStitchScene }) {
  const i = Math.max(0, TOLS.indexOf(s.tol))
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <label htmlFor="trim-stitch-tol" className="flex-1 text-small font-medium">
          {t("缝合公差", "Join tolerance")}
        </label>
        <span className="font-mono text-body tabular">{fmtTol(s.tol)}</span>
        <span className="text-caption text-faint-foreground">mm</span>
      </div>
      <input
        id="trim-stitch-tol"
        type="range"
        min={0}
        max={TOLS.length - 1}
        step={1}
        value={i}
        onChange={(e) => c.setTol(TOLS[Number(e.target.value)])}
        className="mt-1 block h-5 w-full cursor-pointer accent-primary"
      />
    </div>
  )
}

function Status({ s }: { s: TrimState }) {
  return (
    <div className="mt-3">
      <Readout label={t("外露边缘", "Naked edges")} value={openSeams(s).length} tone={openSeams(s).length ? "warning" : "success"} />
      {fakeSeams(s).length > 0 && <Readout label={t("假接上", "Falsely joined")} value={fakeSeams(s).length} tone="warning" />}
    </div>
  )
}

function Checklist({ s }: { s: TrimState }) {
  const rows: { done: boolean; text: string }[] = [
    { done: s.front === "trimmed", text: s.front === "extended" ? t("前壁：已延伸，还要修剪", "Front wall: extended, still to trim") : t("前壁：延伸，再修剪", "Front wall: extend, then trim") },
    { done: s.right === "trimmed", text: t("右壁：修剪", "Right wall: trim") },
    { done: s.back === "matched", text: t("顶面后边：匹配", "Top's back edge: match") },
    { done: s.bottom, text: t("底部开口：加盖", "Bottom opening: cap") },
  ]
  return (
    <ul className="mt-3 space-y-1 text-small">
      {rows.map((r) => (
        <li key={r.text} className={r.done ? "text-success" : "text-muted-foreground"}>
          {r.done ? "✓ " : "○ "}
          {r.text}
        </li>
      ))}
    </ul>
  )
}

const lesson: LessonDef<TrimState, TrimStitchScene> = {
  id: "trim-stitch",
  codes: ["5.2.3"],
  title: t("修剪、分割、缝合与封闭", "Trim, split, join and close"),
  create: (v, emit) => new TrimStitchScene(v, emit),
  steps: [
    {
      title: t("先找出外露边缘", "First, find the naked edges"),
      body: byLocale(
        <>
          <p>这六块面本该围成一个封闭的外壳：顶面、四面侧壁、底面。粗红线是外露边缘：只属于一个面、没有和别的面接上的边。封闭的实体不能有外露边缘。</p>
          <p>点视图里的编号，逐个看看问题出在哪。</p>
        </>,
        <>
          <p>These six surfaces should close up into a housing: a top, four walls and a bottom. The thick red lines are naked edges: edges that belong to one surface only and aren't joined to another. A closed solid can't have any.</p>
          <p>Click the numbers in the view to look at each problem in turn.</p>
        </>,
      ),
      task: { label: t("五处问题都看一遍", "Look at all five problems"), done: (s) => s.inspected.length === PROBLEMS.length },
      extra: ({ s, c }) => (
        <>
          {s.inspecting ? (
            <Hint>
              {PROBLEMS.indexOf(s.inspecting) + 1} · {PROBLEM_TEXT[s.inspecting]}
            </Hint>
          ) : (
            <Hint>{t("视图里有 5 个红色编号。", "There are 5 red numbers in the view.")}</Hint>
          )}
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={() => c.overview()}>
              <LocateFixed />
              {t("回到全景", "Back to overview")}
            </Button>
            <Readout label={t("已看", "Seen")} value={`${s.inspected.length} / ${PROBLEMS.length}`} />
          </div>
        </>
      ),
      note: t(
        "Rhino：「显示边缘」ShowEdges 可只显示外露边缘。SOLIDWORKS：缝合曲面的「缝隙控制」列出缝隙。Fusion：缝合时列出未缝合的边。",
        "Rhino: ShowEdges can show naked edges only. SOLIDWORKS: Knit Surface lists the gaps under Gap Control. Fusion: Stitch lists the unstitched edges.",
      ),
      noteTitle: t("各软件叫法", "What each package calls it"),
    },
    {
      title: t("缝合公差", "Join tolerance"),
      body: byLocale(
        <>
          <p>组合（缝合）时，软件把距离小于公差的两条边当成同一条边。公差要在建模前定好、全程一致，Rhino 的毫米模板常用 0.001 mm 或 0.01 mm。拖动公差，看哪些缝能接上。</p>
          <p>放大公差不等于修好。缝还在，只是被当成接上了：后面的圆角、布尔、抽壳会在这里失败，导出到公差更严的软件或转成网格时也会漏。</p>
        </>,
        <>
          <p>
            When joining (knitting, stitching), the software treats two edges closer than the tolerance as one edge. Set the tolerance before you model and keep it throughout; Rhino&apos;s
            millimetre templates usually use 0.001 mm or 0.01 mm. Drag the tolerance and watch which gaps close.
          </p>
          <p>A larger tolerance doesn&apos;t fix anything. The gap is still there, it is just counted as joined: fillets, booleans and shells later fail there, and it leaks when exported to software with a tighter tolerance or turned into a mesh.</p>
        </>,
      ),
      task: {
        label: t("先试一个大公差，再调回能接上 0.004 mm 的缝、又不超过 0.01 mm 的值", "Try a large tolerance, then come back to one that closes the 0.004 mm gap but is no more than 0.01 mm"),
        done: (s) => s.triedLarge && s.tol >= 0.005 && s.tol <= 0.01,
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把公差调到 1 mm，0.8 mm 的缝也「接上」了。这块面真的封住了吗？", "At a 1 mm tolerance, the 0.8 mm gap is “joined” too. Is it really sealed?")}
            options={byLocale(
              ["封住了，可以放心用", "没有：缝还在，只是被当成接上了，下游的圆角、布尔、导出都可能出问题", "软件会自动把缝补上"],
              ["Yes, it's safe to use", "No: the gap is still there, only counted as joined; fillets, booleans and exports downstream can fail", "The software fills the gap for you"],
            )}
            answer={1}
            explain={t(
              "组合不改几何，只记下「这两条边是一条」。0.8 mm 的缝在模型里原样留着，橙色虚线就是这些假接上的边。",
              "Joining doesn't change the geometry; it only records that two edges are one. The 0.8 mm gap stays in the model; the dashed orange lines are these false joins.",
            )}
            onReveal={() => c.setTol(1)}
          />
          <TolSlider s={s} c={c} />
          <Status s={s} />
          {s.tol >= 0.1 && <Hint tone="warning">{t("公差太大：缝被盖住了，几何并没有修好。", "Too large: the gaps are hidden, not fixed.")}</Hint>}
        </>
      ),
      note: t(
        "Rhino：组合 Join，用文件的绝对公差。SOLIDWORKS：缝合曲面，「缝隙控制」里设缝合公差。Fusion：缝合 Stitch，有公差设置。",
        "Rhino: Join, using the document's absolute tolerance. SOLIDWORKS: Knit Surface, with the knitting tolerance under Gap Control. Fusion: Stitch, with a tolerance setting.",
      ),
      noteTitle: t("各软件叫法", "What each package calls it"),
    },
    {
      title: t("逐个修好", "Fix them one by one"),
      body: byLocale(
        <>
          <p>每种问题有对应的修法。短了：延伸，再用对面修剪。多了：修剪。两条边几乎重合、只差一点：匹配，把边拉到位置连续（G0）。平面上的洞口：加盖。</p>
          <p>选一个工具，再在视图里点要改的面。左壁那 0.004 mm 交给公差：在 0.01 mm 下它已经接上了。</p>
        </>,
        <>
          <p>Each problem has its fix. Too short: extend, then trim with the other surface. Too long: trim. Two edges almost on top of each other: match, pulling the edge into position. A planar opening: cap.</p>
          <p>Pick a tool, then click the surface to change in the view. Leave the left wall&apos;s 0.004 mm to the tolerance: at 0.01 mm it is already joined.</p>
        </>,
      ),
      task: { label: t("修好四处：前壁、右壁、顶面后边、底部", "Fix four: front wall, right wall, top's back edge, bottom"), done: (s) => allFixed(s) },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("工具", "Tool")}</span>
            <Segmented size="sm" aria-label={t("工具", "Tool")} value={s.tool} onValueChange={(v: Tool) => c.setTool(v)} options={TOOLS} />
          </div>
          {s.feedback && <Hint tone={s.feedback.ok ? undefined : "warning"}>{s.feedback.text}</Hint>}
          <Checklist s={s} />
          <Status s={s} />
        </>
      ),
      note: t(
        "Rhino：延伸曲面 ExtendSrf、修剪 Trim、匹配 MatchSrf、将平面洞加盖 Cap。SOLIDWORKS：延伸曲面、剪裁曲面、平面（旧版叫平面区域）。Fusion：延伸、修剪、面片。",
        "Rhino: ExtendSrf, Trim, MatchSrf, Cap. SOLIDWORKS: Extend Surface, Trim Surface, Planar Surface. Fusion: Extend, Trim, Patch.",
      ),
      noteTitle: t("各软件叫法", "What each package calls it"),
    },
    {
      title: t("组合成实体", "Join into a solid"),
      body: byLocale(
        <>
          <p>所有缝都在公差以内，组合后就是一个封闭的多重曲面，也就是实体：能算体积和质量，能做布尔、抽壳、加厚。</p>
          <p>还剩一条外露边缘，它就只是一组开放的面，没有体积。</p>
        </>,
        <>
          <p>With every gap inside the tolerance, joining gives a closed polysurface, which is a solid: it has a volume and a mass, and you can run booleans, shells and thickening on it.</p>
          <p>With even one naked edge left, it is just a set of open surfaces with no volume.</p>
        </>,
      ),
      task: { label: t("组合，得到封闭实体", "Join and get a closed solid"), done: (s) => s.joined && openSeams(s).length === 0 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => c.join()}>
              <Combine />
              {t("组合", "Join")}
            </Button>
            {!allFixed(s) && (
              <Button size="sm" variant="secondary" onClick={() => c.fixRest()}>
                <Wrench />
                {t("补完修补", "Finish repairs")}
              </Button>
            )}
          </div>
          {s.joined && openSeams(s).length > 0 && (
            <Hint tone="warning">{t(`还有 ${openSeams(s).length} 条外露边缘：这是开放的多重曲面，没有体积。先把问题修好。`, `${openSeams(s).length} naked edges remain: this is an open polysurface with no volume. Fix the problems first.`)}</Hint>
          )}
          <div className="mt-3">
            <Readout label={t("外露边缘", "Naked edges")} value={openSeams(s).length} tone={openSeams(s).length ? "warning" : "success"} />
            <Readout label={t("体积", "Volume")} value={s.joined && openSeams(s).length === 0 ? (c.volume() / 1000).toFixed(1) : "–"} unit="cm³" tone="success" />
          </div>
        </>
      ),
      note: t(
        "Rhino 组合后，封闭的多重曲面自动当作实体，平面开口可以「将平面洞加盖」。SOLIDWORKS 缝合曲面勾选「创建实体」。Fusion 缝合时没有缝隙，就直接得到实体。",
        "In Rhino, a closed polysurface counts as a solid once joined, and Cap closes planar openings. In SOLIDWORKS, tick Create solid in Knit Surface. In Fusion, Stitch gives a solid directly when there are no gaps.",
      ),
    },
    {
      title: t("分割还是修剪", "Split or trim"),
      body: byLocale(
        <>
          <p>分割沿曲线把面分成两块，两块都留着：边仍然接着，实体还是封闭的。常用来分出颜色、材质或按键区域。</p>
          <p>修剪沿曲线切开并丢掉一块，留下一个洞，实体就变回开放的面。这个洞不在一个平面上，加盖补不了，要用嵌面或填充曲面。</p>
        </>,
        <>
          <p>Split cuts a surface along a curve into two pieces and keeps both: the edges stay joined and the solid stays closed. It is used to mark out colours, materials or button areas.</p>
          <p>Trim cuts along the curve and throws one piece away, leaving a hole, and the solid goes back to open surfaces. This hole isn&apos;t planar, so a cap can&apos;t fill it; you need a patch or a filled surface.</p>
        </>,
      ),
      task: { label: t("分割和修剪都试一次", "Try both split and trim"), done: (s) => s.triedSplit && s.triedCutTrim },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("工具", "Tool")}</span>
            <Segmented
              size="sm"
              aria-label={t("工具", "Tool")}
              value={s.cutTool}
              onValueChange={(v) => c.setCutTool(v as "split" | "trim")}
              options={[
                { value: "split", label: t("分割", "Split") },
                { value: "trim", label: t("修剪", "Trim") },
              ]}
            />
          </div>
          <p className="mt-2 text-small text-muted-foreground">{t("点顶面上蓝色椭圆的里面。", "Click inside the blue ellipse on the top.")}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.setCut("none")}>
            <RotateCcw />
            {t("复原顶面", "Restore the top")}
          </Button>
          {s.cut === "split" && <Hint>{t("分成了两块面，边还接着：仍是封闭实体，体积不变。", "Two faces now, edges still joined: still a closed solid, same volume.")}</Hint>}
          {s.cut === "trim" && (
            <Hint tone="warning">
              {t("顶面开了一个洞，椭圆变成外露边缘，没有体积了。洞口不在平面上，加盖补不了。", "The top now has a hole; the ellipse is a naked edge and there is no volume. The opening isn't planar, so a cap can't fill it.")}
            </Hint>
          )}
        </>
      ),
      note: t(
        "Rhino：分割 Split、修剪 Trim、嵌面 Patch。SOLIDWORKS：分割线、剪裁曲面、填充曲面。Fusion：修剪、面片。",
        "Rhino: Split, Trim, Patch. SOLIDWORKS: Split Line, Trim Surface, Filled Surface. Fusion: Trim, Patch.",
      ),
    },
  ],
  quiz: [
    {
      q: t("两块面之间有 0.3 mm 的缝，把缝合公差调到 0.5 mm 让它们接上，行吗？", "There's a 0.3 mm gap between two surfaces. Can you raise the join tolerance to 0.5 mm so they join?"),
      options: byLocale(
        ["行，接上就好", "不好：缝还在，只是被当成接上；应该修几何，公差保持建模时的值", "只要最后导出 STL 就没问题"],
        ["Yes, joined is joined", "Better not: the gap stays, only counted as joined; fix the geometry and keep the modelling tolerance", "It's fine as long as you export an STL in the end"],
      ),
      answer: 1,
      explain: t(
        "组合不改几何。大公差把缝藏起来，圆角、布尔、抽壳会在缝上失败，网格也可能漏。用延伸修剪或匹配把缝真正合上。",
        "Joining doesn't change the geometry. A large tolerance hides the gap; fillets, booleans and shells fail on it, and meshes can leak. Close it for real by extending and trimming, or matching.",
      ),
    },
    {
      q: t("侧壁比顶面矮了一截，正确的修法是？", "A wall stops short of the top. What's the right fix?"),
      options: byLocale(["把公差放大", "延伸侧壁穿过顶面，再用顶面修剪它", "加盖"], ["Raise the tolerance", "Extend the wall through the top, then trim it with the top", "Cap it"]),
      answer: 1,
      explain: t(
        "延伸让两面相交，修剪沿交线切掉多余部分：侧壁的边正好落在顶面上，缝隙为 0。加盖只适合平面上的洞口。",
        "Extending makes the surfaces intersect; trimming cuts the excess along the intersection, so the wall's edge lies exactly on the top with no gap. Capping only suits planar openings.",
      ),
    },
    {
      q: t("为什么分割顶面后实体还是封闭的，修剪后就不是了？", "Why does a solid stay closed after splitting its top, but not after trimming it?"),
      options: byLocale(
        ["分割会自动加盖", "分割两块都留着，边还接着；修剪丢掉一块，留下外露边缘", "修剪会改变公差"],
        ["Split caps automatically", "Split keeps both pieces with their edges joined; trim discards one and leaves naked edges", "Trim changes the tolerance"],
      ),
      answer: 1,
      explain: t(
        "封闭与否只看有没有外露边缘。分割新增的边两侧都有面；修剪后，切口那圈边只剩一侧有面。",
        "Closed or not depends only on naked edges. A split's new edge has a face on both sides; after a trim, the cut edge has a face on one side only.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "封闭实体不能有外露边缘：先把它们显示出来，逐个找出缝、重叠和洞口",
      "公差只吸收微小误差，建模前定好；放大公差只是把缝藏起来，下游会出问题",
      "短了延伸再修剪，多了修剪，差一点匹配，平面洞加盖；分割两块都留，修剪会开洞",
    ],
    [
      "A closed solid has no naked edges: show them, then find each gap, overlap and opening",
      "The tolerance only absorbs tiny errors and is set before modelling; raising it just hides gaps, and they cause trouble downstream",
      "Too short: extend and trim; too long: trim; nearly there: match; planar hole: cap. Split keeps both pieces; trim leaves a hole",
    ],
  ),
  next: {
    to: "/lesson/offset-thicken",
    label: t("偏移与加厚", "Offset and thicken"),
    text: t("封好的面怎么变成有壁厚的零件。", "How closed surfaces become a part with wall thickness."),
  },
  overlay: ({ s }) => {
    const holed = s.step === 4 && s.cut === "trim"
    const open = openSeams(s).length + (holed ? 1 : 0)
    const closed = s.joined && open === 0
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip>
          <Box />
          {closed ? t("封闭实体", "Closed solid") : t(`外露边缘 ${open}`, `Naked edges ${open}`)}
        </SceneChip>
        <SceneChip tone="primary">{t(`公差 ${fmtTol(s.tol)} mm`, `Tolerance ${fmtTol(s.tol)} mm`)}</SceneChip>
      </div>
    )
  },
}

export default lesson
