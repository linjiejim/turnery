import { Link } from "react-router"
import { Boxes, Dices, Expand, Minimize, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { CONTRIBS, DATUM, flushOf, GAP0, gapLinks, mm2, N, seamOf, simulate, stack, TARGET, type Mode } from "./gap-flush.model"
import { CHAMFER, GapFlushScene, MAG, type GapState } from "./gap-flush.scene"
import type { LessonDef } from "./types"

/** 6.5.1 「缝隙与段差」: the tolerance chain behind a seam, worst case vs RSS, 1000 simulated units, a shorter chain, a designed step and a shadow line. */

const gapStack = (s: GapState) => stack(gapLinks(s.tol, s.mode).map((l) => l.tol))
const flushStack = (s: GapState) => stack([s.tol.size, s.tol.boss])

/** The unit on show: its gap and flush. */
function unitOf(s: GapState, c: GapFlushScene) {
  const d = c.dev()
  return { gap: seamOf(d, s.mode).gap, flush: flushOf(d, s.designStep) }
}

function UnitChip({ s, c }: { s: GapState; c: GapFlushScene }) {
  const u = unitOf(s, c)
  const who = s.pick === -1 ? t("最坏情况：缝隙最大", "Worst case: widest gap") : s.pick === -2 ? t("最坏情况：缝隙最小", "Worst case: narrowest gap") : t(`第 ${s.pick + 1} 台`, `Unit ${s.pick + 1}`)
  return (
    <SceneChip tone="primary">
      {who} · {t(`缝隙 ${u.gap.toFixed(2)}`, `gap ${u.gap.toFixed(2)}`)} · {t(`段差 ${mm2(u.flush)}`, `flush ${mm2(u.flush)}`)}
    </SceneChip>
  )
}

const HW = 276
const HH = 112

/** Histogram of the 1000 units; click a bar to see one of its units in 3D. */
function Histogram({ s, c, kind }: { s: GapState; c: GapFlushScene; kind: "gap" | "flush" }) {
  const sim = simulate(s.seed, s.tol, s.mode, s.designStep)
  const data = kind === "gap" ? sim.gap : sim.flush
  const [lo, hi] = kind === "gap" ? [-0.2, 1.2] : [-0.6, 0.3]
  const bins = 56
  const bw = (hi - lo) / bins
  const counts = new Array<number>(bins).fill(0)
  const first = new Array<number>(bins).fill(-1)
  data.forEach((v, i) => {
    const b = Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / bw)))
    counts[b]++
    if (first[b] < 0) first[b] = i
  })
  const max = Math.max(...counts, 1)
  const x = (v: number) => 6 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (HW - 12)
  const base = HH - 16
  const st = kind === "gap" ? gapStack(s) : flushStack(s)
  const mid = kind === "gap" ? GAP0 : -s.designStep
  const u = unitOf(s, c)
  const shown = kind === "gap" ? u.gap : u.flush
  const ticks = kind === "gap" ? [0, 0.25, 0.5, 0.75, 1] : [-0.5, -0.25, 0, 0.25]
  return (
    <svg width={HW} height={HH} viewBox={`0 0 ${HW} ${HH}`} className="pointer-events-auto block text-foreground" aria-label={kind === "gap" ? t("缝隙分布", "Gap distribution") : t("段差分布", "Flush distribution")}>
      {kind === "gap" ? (
        <rect x={x(GAP0 - TARGET)} y={4} width={x(GAP0 + TARGET) - x(GAP0 - TARGET)} height={base - 4} className="text-success" fill="currentColor" fillOpacity={0.12} />
      ) : (
        <rect x={x(0)} y={4} width={x(hi) - x(0)} height={base - 4} className="text-warning" fill="currentColor" fillOpacity={0.12} />
      )}
      {counts.map((n, b) =>
        n ? (
          <rect
            key={b}
            x={x(lo + b * bw) + 0.5}
            y={base - (n / max) * (base - 10)}
            width={Math.max(1, x(lo + (b + 1) * bw) - x(lo + b * bw) - 1)}
            height={(n / max) * (base - 10)}
            className="cursor-pointer text-primary hover:text-foreground"
            fill="currentColor"
            fillOpacity={0.75}
            onClick={() => c.pickUnit(first[b])}
          >
            <title>{t(`${n} 台`, `${n} units`)}</title>
          </rect>
        ) : null,
      )}
      <line x1={6} x2={HW - 6} y1={base} y2={base} stroke="currentColor" strokeOpacity={0.4} />
      {[-1, 1].map((k) => (
        <g key={k}>
          <line x1={x(mid + k * st.wc)} x2={x(mid + k * st.wc)} y1={6} y2={base} stroke="currentColor" strokeDasharray="3 3" strokeWidth={1.2} />
          <line x1={x(mid + k * st.rss)} x2={x(mid + k * st.rss)} y1={6} y2={base} stroke="currentColor" strokeWidth={1.2} />
        </g>
      ))}
      {kind === "flush" && <line x1={x(0)} x2={x(0)} y1={4} y2={base} className="text-warning" stroke="currentColor" strokeWidth={1.5} />}
      <path d={`M ${x(shown)} ${base + 1} l -4 7 h 8 z`} className="text-scene-modified" fill="currentColor" />
      {ticks.map((v) => (
        <text key={v} x={x(v)} y={HH - 2} textAnchor="middle" fill="currentColor" className="text-caption tabular text-muted-foreground">
          {v === 0 ? "0" : v.toFixed(2).replace("0.", ".")}
        </text>
      ))}
    </svg>
  )
}

function Panel({ s, c }: { s: GapState; c: GapFlushScene }) {
  const kind = s.step === 5 ? "flush" : "gap"
  const sim = simulate(s.seed, s.tol, s.mode, s.designStep)
  const show = s.step >= 2 && s.ran
  return (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <UnitChip s={s} c={c} />
        <SceneChip>{t(`剖开螺丝处 · 接缝的偏差放大 ${MAG} 倍`, `Cut through the screws · seam deviations drawn ${MAG}× larger`)}</SceneChip>
      </div>
      {show && (
        <div className="w-fit rounded-lg border bg-popover p-3 shadow-popover">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-small">
            <span className="font-medium">{kind === "gap" ? t(`缝隙 · 装了 ${N} 台`, `Gap · ${N} units assembled`) : t(`段差 · 装了 ${N} 台`, `Flush · ${N} units assembled`)}</span>
            <span className="text-caption text-muted-foreground">mm</span>
          </div>
          <Histogram s={s} c={c} kind={kind} />
          <div className="mt-1 flex flex-wrap gap-x-3 text-caption text-muted-foreground">
            <span>{t("虚线 最坏情况", "Dashed: worst case")}</span>
            <span>{t("实线 统计 RSS", "Solid: statistical (RSS)")}</span>
            <span>{kind === "gap" ? t("绿色 目标 0.30–0.70", "Green: target 0.30–0.70") : t("橙色 面盖凸出", "Orange: cover proud")}</span>
          </div>
          <div className="mt-1 text-small tabular">
            {kind === "gap"
              ? t(`实际 ${sim.min.toFixed(2)}–${sim.max.toFixed(2)} · 在目标内 ${sim.inTarget} 台`, `Actual ${sim.min.toFixed(2)}–${sim.max.toFixed(2)} · ${sim.inTarget} within target`)
              : t(`实际 ${mm2(sim.fmin)} 到 ${mm2(sim.fmax)} · 凸出 ${sim.proud} 台`, `Actual ${mm2(sim.fmin)} to ${mm2(sim.fmax)} · ${sim.proud} proud`)}
          </div>
          <div className="text-caption text-muted-foreground">{t("点柱子，看那一台的接缝", "Click a bar to see one of its units")}</div>
        </div>
      )}
    </div>
  )
}

/** The chain: each link's ± band, its share of the variance, and the two totals. */
function Chain({ s, mode }: { s: GapState; mode: Mode }) {
  const links = gapLinks(s.tol, mode)
  const st = stack(links.map((l) => l.tol))
  const var2 = links.reduce((a, l) => a + l.tol * l.tol, 0) || 1
  const scale = 76 / 0.6
  const bar = (v: number, cls: string, dashed = false) => (
    <svg width={156} height={12} className="block shrink-0 text-foreground" aria-hidden>
      <line x1={78} x2={78} y1={0} y2={12} stroke="currentColor" strokeOpacity={0.25} />
      <rect x={78 - Math.min(76, v * scale)} y={2} width={Math.min(152, 2 * v * scale)} height={8} rx={2} className={cls} fill="currentColor" fillOpacity={dashed ? 0.25 : 0.7} stroke={dashed ? "currentColor" : "none"} strokeDasharray="3 2" />
    </svg>
  )
  return (
    <div className="mt-4 rounded-md bg-sunken px-3 py-2 text-small">
      <div className="mb-1 text-muted-foreground">{mode === "screw" ? t("尺寸链：底壳开口 → 螺丝柱 → 孔隙 → 面盖的孔 → 面盖的边", "The chain: opening → boss → clearance → cover hole → cover edge") : t("尺寸链：底壳开口 → 定位筋 → 面盖的边", "The chain: opening → locating rib → cover edge")}</div>
      {links.map((l) => (
        <div key={l.id} className="flex items-center gap-2 py-0.5">
          <span className="w-20 shrink-0 truncate">{l.name}</span>
          {bar(l.tol, "text-primary")}
          <span className="w-11 shrink-0 text-right font-mono text-caption tabular">±{l.tol.toFixed(2)}</span>
          <span className="w-9 shrink-0 text-right text-caption tabular text-muted-foreground">{Math.round(((l.tol * l.tol) / var2) * 100)}%</span>
        </div>
      ))}
      <div className="mt-1 border-t pt-1">
        <div className="flex items-center gap-2 py-0.5">
          <span className="w-20 shrink-0">{t("最坏情况", "Worst case")}</span>
          {bar(st.wc, "text-destructive", true)}
          <span className="w-11 shrink-0 text-right font-mono text-caption tabular">±{st.wc.toFixed(2)}</span>
          <span className="w-9" />
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <span className="w-20 shrink-0">{t("统计 RSS", "RSS")}</span>
          {bar(st.rss, st.rss <= TARGET + 1e-9 ? "text-success" : "text-scene-modified")}
          <span className="w-11 shrink-0 text-right font-mono text-caption tabular">±{st.rss.toFixed(2)}</span>
          <span className="w-9" />
        </div>
      </div>
      <div className="mt-1 text-caption text-muted-foreground">{t("百分比：这一环占总方差的份额（公差的平方）", "Percent: this link's share of the variance (tolerance squared)")}</div>
    </div>
  )
}

function TolSliders({ s, c }: { s: GapState; c: GapFlushScene }) {
  return (
    <div className="mt-3 space-y-0.5">
      {CONTRIBS.map((k) => (
        <ParamSlider key={k.id} className="px-0" label={`${k.name} ±`} value={s.tol[k.id]} min={0.02} max={0.4} step={0.01} onChange={(v) => c.setTol(k.id, v)} hint={k.what} />
      ))}
    </div>
  )
}

const lesson: LessonDef<GapState, GapFlushScene> = {
  id: "gap-flush",
  codes: ["6.5.1"],
  title: t("缝隙与段差", "Gap and flush"),
  create: (v, emit) => new GapFlushScene(v, emit),
  steps: [
    {
      title: t("每一台都不一样", "No two units are the same"),
      body: byLocale(
        <>
          <p>面盖装进底壳的开口，接缝处有两个外观指标：缝隙（gap）是两条边之间的宽度，段差（flush，也叫面差）是两个面的高低差。</p>
          <p>图纸上它们是名义值：缝隙 0.5 mm，段差 0。可每个零件的每个尺寸都在各自的公差里浮动，所以装出来的每一台都不一样。视图剖开了螺丝处的接缝；为了看得见，接缝处的偏差画大了 4 倍，标签里是真实数值。</p>
        </>,
        <>
          <p>A cover sits in the opening of a base. The seam has two appearance measures: the gap, the width between the two edges, and the flush, the height difference between the two surfaces.</p>
          <p>
            On the drawing they are nominal values: a 0.5 mm gap and zero flush. But every dimension of every part varies within its own tolerance, so every unit that comes off the line is different. The view cuts
            through the seam at a screw; so you can see them, the deviations at the seam are drawn 4× larger, and the labels give the real values.
          </p>
        </>,
      ),
      task: { label: t("装 3 台，看缝隙和段差怎么变", "Assemble 3 units and watch the gap and flush change"), done: (s) => s.draws >= 3 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => c.draw()}>
              <Dices />
              {t("装一台", "Assemble one")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => c.toggleOverview()}>
              {s.overview ? <Minimize /> : <Expand />}
              {s.overview ? t("看接缝", "Seam close-up") : t("看整机", "Whole product")}
            </Button>
          </div>
          <div className="mt-2 text-small text-muted-foreground">
            {t("已装", "Assembled")} <span className="tabular">{s.draws}</span> {t("台", s.draws === 1 ? "unit" : "units")}
          </div>
        </>
      ),
      note: t(
        "看整机时会看到：右边的缝变大，左边的缝往往变小。面盖整体偏了一点，这比两边一样宽或一样窄更显眼。",
        "In the whole-product view you'll see that when the right gap opens, the left one often closes: the cover has shifted as a whole, which shows more than both gaps being equally wide or narrow.",
      ),
      noteTitle: t("看整机", "Whole product"),
    },
    {
      title: t("尺寸链：缝隙是一串尺寸加减出来的", "The tolerance chain: a gap is a sum of dimensions"),
      body: byLocale(
        <>
          <p>缝隙不是一个尺寸。从底壳的开口边出发，到螺丝柱，经过螺丝在孔里的间隙，到面盖的孔，再到面盖的边：这一串叫尺寸链，每一环的误差都会传到缝隙上。</p>
          <p>最坏情况的算法：假设每一环同时走到对缝隙最不利的极限，误差直接相加。</p>
        </>,
        <>
          <p>A gap is not a single dimension. Start at the base's opening edge, go to the screw boss, through the screw's clearance in its hole, to the cover's hole, then to the cover's edge: that string is the tolerance chain, and every link's error reaches the gap.</p>
          <p>Worst-case analysis assumes every link is at its least favourable limit at the same time, and simply adds the errors.</p>
        </>,
      ),
      task: { label: t("看最大缝隙和最小缝隙两种最坏情况", "Look at both worst cases: the widest and the narrowest gap"), done: (s) => s.sawWorst.length >= 2 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("四环的公差是 ±0.10、±0.08、±0.08、±0.30，名义缝隙 0.50。最坏情况下缝隙最小是多少？", "The four links are ±0.10, ±0.08, ±0.08 and ±0.30, the nominal gap 0.50. In the worst case, how small does the gap get?")}
            options={byLocale(
              ["0.20：只有最大的那一环 ±0.30 起作用", "0.16：四环平方和开方，±0.34", "−0.06：四环加起来 0.56，比缝隙本身还大"],
              ["0.20: only the biggest link, ±0.30, matters", "0.16: root sum of squares of the four, ±0.34", "−0.06: the four add up to 0.56, more than the gap itself"],
            )}
            answer={2}
            explain={t(
              "最坏情况把四环直接相加：0.10 + 0.08 + 0.08 + 0.30 = 0.56。0.50 − 0.56 = −0.06，面盖会顶到底壳，装不进去。平方和开方是统计算法，下一步再讲。",
              "Worst case adds all four: 0.10 + 0.08 + 0.08 + 0.30 = 0.56. 0.50 − 0.56 = −0.06, so the cover hits the base and won't go in. The root sum of squares is the statistical method, next step.",
            )}
            onReveal={() => c.showWorst(-1)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={s.pick === -1 ? "primary" : "secondary"} onClick={() => c.showWorst(1)}>
              {t("最大缝隙", "Widest gap")}
            </Button>
            <Button size="sm" variant={s.pick === -2 ? "primary" : "secondary"} onClick={() => c.showWorst(-1)}>
              {t("最小缝隙", "Narrowest gap")}
            </Button>
          </div>
          <Chain s={s} mode="screw" />
        </>
      ),
      note: (
        <>
          {t("单个尺寸的公差带怎么读、孔和轴怎么配，见", "For how a single dimension's tolerance zone reads and how holes and shafts fit, see ")}
          <Link to="/lesson/tolerance-fits" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
            {t("「尺寸公差与配合」", "Dimensional tolerances and fits")}
          </Link>
          {t("。", ".")}
        </>
      ),
      noteTitle: t("先修", "Background"),
    },
    {
      title: t("装 1000 台：最坏情况与统计", "Assemble 1000: worst case versus statistics"),
      body: byLocale(
        <>
          <p>最坏情况要求每一环恰好同时走到极限，这在 1000 台里几乎碰不到。各环的误差互相独立、有正有负，会抵消一部分。</p>
          <p>统计算法把各环公差平方相加再开方，叫 RSS（平方和开方），得到绝大多数产品（约 99.7%）落在的范围。这里让电脑真的「装」1000 台：每台的每个尺寸随机取，看缝隙的分布。</p>
        </>,
        <>
          <p>The worst case needs every link to hit its limit at the same time, which almost never happens in 1000 units. The links' errors are independent, some positive, some negative, and partly cancel.</p>
          <p>
            Statistical analysis squares each tolerance, adds them and takes the square root (RSS, root sum of squares), giving the range nearly all units (about 99.7 %) fall in. Here the computer really
            “assembles” 1000 units, drawing every dimension of every unit at random, and shows the spread of the gap.
          </p>
        </>,
      ),
      task: { label: t("装 1000 台，再点一根靠边的柱子看那一台", "Assemble 1000 units, then click a bar near the edge to see that unit"), done: (s) => s.ran && s.picked },
      extra: ({ s, c }) => {
        const st = gapStack(s)
        return (
          <>
            <Predict
              question={t("最坏情况说缝隙可能小于 0。装 1000 台，有几台会小于 0？", "The worst case says the gap can go below 0. Of 1000 units, how many will?")}
              options={byLocale(["大约一半", "几十台", "几乎没有"], ["About half", "A few dozen", "Almost none"])}
              answer={2}
              explain={t(
                `四环同时走到极限的概率极小。统计范围是 ${GAP0.toFixed(2)} ± ${st.rss.toFixed(2)}，比最坏情况的 ± ${st.wc.toFixed(2)} 窄得多。`,
                `The chance of all four links hitting their limits at once is tiny. The statistical range is ${GAP0.toFixed(2)} ± ${st.rss.toFixed(2)}, far narrower than the worst case's ± ${st.wc.toFixed(2)}.`,
              )}
              onReveal={() => c.run()}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => c.run()}>
                <Boxes />
                {s.ran ? t("再装 1000 台", "Assemble another 1000") : t("装 1000 台", "Assemble 1000")}
              </Button>
            </div>
            <div className="mt-3">
              <Readout label={t("最坏情况", "Worst case")} value={`±${st.wc.toFixed(2)}`} unit="mm" />
              <Readout label="RSS" value={`±${st.rss.toFixed(2)}`} unit="mm" tone="primary" />
            </div>
          </>
        )
      },
      note: t(
        "RSS 的前提：各环互相独立、接近正态分布、而且居中。环数少、加工总偏向一边时，统计结果偏乐观；有的公司会把 RSS 结果再放大约 1.5 倍留余量。",
        "RSS assumes the links are independent, roughly normal and centred. With few links, or a process that runs off-centre, it is optimistic; some companies multiply the RSS result by about 1.5 for margin.",
      ),
      noteTitle: t("什么时候不准", "When it misleads"),
    },
    {
      title: t("收紧对的那一环", "Tighten the right link"),
      body: byLocale(
        <>
          <p>目标是缝隙 0.50 ± 0.20。收紧公差要花钱：更好的模具、更多的检测，或者做一个装配夹具。</p>
          <p>该收哪一环？RSS 按平方相加，最大的那一环占了总方差的大头。先看百分比，再动滑杆。</p>
        </>,
        <>
          <p>The target is a gap of 0.50 ± 0.20. Tightening tolerances costs money: better tooling, more inspection, or an assembly fixture.</p>
          <p>Which link should you tighten? RSS adds squares, so the biggest link owns most of the total variance. Read the percentages first, then move the sliders.</p>
        </>,
      ),
      task: { label: t("让统计范围（RSS）不超过 ±0.20", "Bring the statistical range (RSS) within ±0.20"), done: (s) => s.mode === "screw" && gapStack(s).rss <= TARGET + 1e-9 },
      extra: ({ s, c }) => (
        <>
          <Chain s={s} mode="screw" />
          <TolSliders s={s} c={c} />
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => c.resetTol()}>
            <RotateCcw />
            {t("恢复默认公差", "Reset tolerances")}
          </Button>
          {gapStack(s).rss <= TARGET + 1e-9 && (
            <Hint>
              {t(
                "做到了。把夹具从 ±0.30 收到 ±0.10，RSS 就从 ±0.34 降到 ±0.18；而把另外三环都收到 ±0.02，也只能降到 ±0.30。",
                "Done. Taking the fixture from ±0.30 to ±0.10 brings RSS from ±0.34 down to ±0.18, while tightening the other three links all the way to ±0.02 only gets you to ±0.30.",
              )}
            </Hint>
          )}
        </>
      ),
    },
    {
      title: t("换个基准：缩短尺寸链", "Change the datum: shorten the chain"),
      body: byLocale(
        <>
          <p>另一个办法是让链变短。面盖不靠螺丝孔定位，而是在边下做一根定位筋，直接靠着底壳开口的内壁：两个零件以同一个面为基准。螺丝孔放大，只负责压紧。</p>
          <p>链上只剩两环：定位筋到边（同一个零件上相距很近的两处，公差小）和定位筋的间隙。公差一个都没收紧，缝隙却稳多了。</p>
        </>,
        <>
          <p>
            The other way is a shorter chain. Instead of locating the cover by its screw holes, give it a locating rib under the edge that bears directly on the inside of the base's opening: both parts now
            work from the same surface. The screw holes are opened up and only clamp.
          </p>
          <p>Two links remain: rib to edge (two features close together on one part, so a small tolerance) and the rib's clearance. Not one tolerance was tightened, yet the gap is far steadier.</p>
        </>,
      ),
      task: { label: t("改成「开口定位」，让缝隙落进目标", "Switch to “Located on the opening” and bring the gap within target"), done: (s) => s.mode === "datum" },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4">
            <Segmented
              size="sm"
              aria-label={t("定位方式", "Locating scheme")}
              value={s.mode}
              onValueChange={(m: Mode) => c.setMode(m)}
              options={[
                { value: "screw", label: t("螺丝孔定位", "Located by the screws") },
                { value: "datum", label: t("开口定位", "Located on the opening") },
              ]}
            />
          </div>
          <Chain s={s} mode={s.mode} />
          {s.mode === "datum" && (
            <div className="mt-2 text-small text-muted-foreground">
              {t(`定位筋到边 ±${DATUM.local.toFixed(2)}，间隙 ±${DATUM.rib.toFixed(2)}：都是设计时定的数，示意值。`, `Rib to edge ±${DATUM.local.toFixed(2)}, clearance ±${DATUM.rib.toFixed(2)}: both set in the design; illustrative values.`)}
            </div>
          )}
        </>
      ),
      note: t(
        "这里的定位筋只在一侧，另一侧的缝要留出余量，吸收面盖整体尺寸的误差。常见的做法是：显眼的一侧用来定位，误差推到不显眼的一侧。",
        "The rib here is on one side only, so the opposite gap needs room to absorb the cover's overall size variation. A common choice: locate on the side people look at, and push the variation to the side they don't.",
      ),
      noteTitle: t("另一侧", "The other side"),
    },
    {
      title: t("段差：设计一个台阶，再加阴影线", "Flush: design in a step, add a shadow line"),
      body: byLocale(
        <>
          <p>段差在 0 上下波动时，有的面盖凸出、有的凹下，同一批产品看着不一样；凸出的边还会挂手、反光。</p>
          <p>常见的做法是不追求齐平：故意让面盖低一点，这个台阶要比段差的波动大，就不会反向。缝隙也一样，在两条边上做一个小倒角（阴影线），接缝本来就是一条暗线，零点几毫米的变化就不显眼了。</p>
        </>,
        <>
          <p>When the flush wanders either side of zero, some covers stand proud and some sit low, so units from one batch look different; a proud edge also catches fingers and light.</p>
          <p>
            The common answer is not to chase a perfect flush: sit the cover a little low on purpose, with a step bigger than the flush variation, so it never reverses. The gap gets the same treatment: a small
            chamfer on both edges (a shadow line) makes the seam a deliberate dark line, and a few tenths of a millimetre of variation stop showing.
          </p>
        </>,
      ),
      task: { label: t("设计台阶，让 1000 台里没有一台凸出；再打开阴影线", "Design a step so not one of 1000 units is proud, then turn on the shadow line"), done: (s) => simulate(s.seed, s.tol, s.mode, s.designStep).proud === 0 && s.shadow },
      extra: ({ s, c }) => {
        const fs = flushStack(s)
        const sim = simulate(s.seed, s.tol, s.mode, s.designStep)
        return (
          <>
            <ParamSlider className="mt-4 px-0" label={t("设计台阶：面盖低于底壳", "Designed step: cover below the base")} value={s.designStep} min={0} max={0.4} step={0.01} onChange={(v) => c.setDesignStep(v)} hint={t(`段差的波动：最坏 ±${fs.wc.toFixed(2)}，统计 ±${fs.rss.toFixed(2)}`, `Flush variation: worst case ±${fs.wc.toFixed(2)}, statistical ±${fs.rss.toFixed(2)}`)} />
            <div className="mt-2">
              <Segmented
                size="sm"
                aria-label={t("接缝的边", "Seam edges")}
                value={s.shadow ? "shadow" : "sharp"}
                onValueChange={(v) => c.setShadow(v === "shadow")}
                options={[
                  { value: "sharp", label: t("锐边", "Sharp edges") },
                  { value: "shadow", label: t(`${CHAMFER} 倒角阴影线`, `${CHAMFER} mm chamfer shadow line`) },
                ]}
              />
            </div>
            <div className={cn("mt-2 text-small", sim.proud ? "text-warning" : "text-success")}>
              {sim.proud ? t(`还有 ${sim.proud} 台面盖凸出`, `${sim.proud} units still have the cover proud`) : t("1000 台全部不凸出：台阶方向一致", "None of the 1000 is proud: the step always goes the same way")}
            </div>
          </>
        )
      },
      note: t(
        "台阶和倒角的大小要和段差、缝隙的波动一起定，这里的数都是示意。汽车的车门和翼子板、电子产品的上下壳都常用这种设计。",
        "Size the step and the chamfer together with the flush and gap variation; the numbers here are illustrative. Car doors against fenders and the halves of electronics housings use the same idea.",
      ),
      noteTitle: t("怎么定", "Sizing it"),
    },
  ],
  quiz: [
    {
      q: t("一条尺寸链上有四环，每环 ±0.10。最坏情况和统计（RSS）的范围分别是多少？", "A chain has four links of ±0.10 each. What are the worst-case and statistical (RSS) ranges?"),
      options: byLocale(["都是 ±0.40", "最坏 ±0.40，统计 ±0.20", "最坏 ±0.20，统计 ±0.40"], ["Both ±0.40", "Worst case ±0.40, RSS ±0.20", "Worst case ±0.20, RSS ±0.40"]),
      answer: 1,
      explain: t(
        "最坏情况直接相加：4 × 0.10 = 0.40。RSS 平方和开方：√(4 × 0.01) = 0.20。前提是各环独立、居中，环数越多两者差得越多。",
        "Worst case adds them: 4 × 0.10 = 0.40. RSS takes the root of the sum of squares: √(4 × 0.01) = 0.20. That assumes independent, centred links; the more links, the bigger the difference.",
      ),
    },
    {
      q: t("缝隙超差。链上有一环 ±0.30，另外三环 ±0.08 到 ±0.10。先收哪一环？", "The gap is out of spec. One link is ±0.30, the other three ±0.08 to ±0.10. Which do you tighten first?"),
      options: byLocale(
        ["±0.30 那一环：方差按平方算，它占了大部分", "三个小的一起收：三个加起来更多", "随便哪一环，收紧同样多效果一样"],
        ["The ±0.30 link: variance goes by the square, and it owns most of it", "The three small ones together: there are three of them", "Any of them: the same amount of tightening has the same effect"],
      ),
      answer: 0,
      explain: t(
        "0.30² = 0.09，另外三环的平方加起来不到 0.03。三个小的全部收到 0，RSS 也只从 ±0.34 降到 ±0.30。",
        "0.30² = 0.09, while the other three squared add up to under 0.03. Tighten all three small ones to zero and RSS only drops from ±0.34 to ±0.30.",
      ),
    },
    {
      q: t("两个面要求齐平，但段差有约 ±0.15 的波动。外观上通常怎么处理更好？", "Two surfaces should be flush, but the flush varies by about ±0.15. What usually looks better?"),
      options: byLocale(
        ["把公差收到 ±0.02，做到真正齐平", "设计一个比波动大的台阶，让一个面始终低一点，再在接缝做阴影线", "不用管：平均值是 0 就行"],
        ["Tighten to ±0.02 for a true flush", "Design in a step larger than the variation so one surface is always lower, and add a shadow line at the seam", "Nothing: the average is zero"],
      ),
      answer: 1,
      explain: t(
        "台阶方向一致时，眼睛看到的是一条有意的线；凸凹反复才显得做工差。把注塑件收到 ±0.02 往往做不到，或者非常贵。平均值为 0 恰恰意味着约一半凸出、一半凹下。",
        "A step that always goes the same way reads as a deliberate line; a seam that flips between proud and low looks badly made. Holding a moulded part to ±0.02 is often impossible or very expensive. An average of zero means about half proud and half low.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "缝隙和段差由一条尺寸链决定，每一环的误差都会传到接缝上",
      "最坏情况直接相加，统计（RSS）平方和开方；最大的那一环说了算，先收它",
      "缩短尺寸链（同一基准定位）往往比收紧公差便宜；设计台阶和阴影线把剩下的波动藏起来",
    ],
    [
      "Gap and flush come from a tolerance chain; every link's error reaches the seam",
      "Worst case adds tolerances, RSS adds their squares; the biggest link dominates, so tighten it first",
      "A shorter chain (locating from the same datum) is often cheaper than tighter tolerances; a designed step and a shadow line hide what variation is left",
    ],
  ),
  next: {
    to: "/lesson/electronics-layout",
    label: t("电子件布局与开孔公差", "Electronics layout and opening tolerances"),
    text: t("同样的尺寸链，用来算外壳开孔要留多少余量。", "The same tolerance chain, used to size the clearance around housing openings."),
  },
  overlay: ({ s, c }) => <Panel s={s} c={c} />,
}

export default lesson
