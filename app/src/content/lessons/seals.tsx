import { ArrowDownToLine, ArrowUpFromLine, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import {
  CHART,
  CORDS,
  fillOf,
  fillTone,
  lidBow,
  minSqueeze,
  pct,
  SealsScene,
  squeezeOf,
  squeezeTone,
  type Cord,
  type IpId,
  type SealState,
  type Tone,
} from "./seals.scene"
import type { LessonDef } from "./types"

/** 6.5.3 「密封与 O 形圈」: squeeze, gland fill, room for swell, a plastic lid between screws, IP codes. */

const toneText = (tone: Tone) => (tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : "text-destructive")
const toneRead = (tone: Tone) => (tone === "good" ? "success" : "warning") as "success" | "warning"

/** A horizontal gauge: the recommended band in green, the current value as a tick. */
function Gauge({ title, value, lo, hi, band, warnTo, tone }: { title: string; value: number; lo: number; hi: number; band: [number, number]; warnTo?: number; tone: Tone }) {
  const W = 248
  const x = (v: number) => 4 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 8)
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-small">
        <span className="text-muted-foreground">{title}</span>
        <span className={cn("font-mono font-medium tabular", toneText(tone))}>{value.toFixed(1)}%</span>
      </div>
      <svg width={W} height={30} viewBox={`0 0 ${W} 30`} className="block text-foreground" aria-hidden>
        <rect x={4} y={6} width={W - 8} height={8} rx={2} fill="currentColor" fillOpacity={0.08} />
        {warnTo !== undefined && <rect x={x(warnTo)} y={6} width={x(hi) - x(warnTo)} height={8} className="text-destructive" fill="currentColor" fillOpacity={0.25} />}
        <rect x={x(band[0])} y={6} width={x(band[1]) - x(band[0])} height={8} className="text-success" fill="currentColor" fillOpacity={0.35} />
        <line x1={x(value)} x2={x(value)} y1={2} y2={18} stroke="currentColor" strokeWidth={2} className={toneText(tone)} />
        {[band[0], band[1]].map((b) => (
          <text key={b} x={x(b)} y={28} textAnchor="middle" fill="currentColor" className="text-caption text-muted-foreground tabular">
            {b}
          </text>
        ))}
      </svg>
    </div>
  )
}

const IP_TEXT: Record<IpId, { zh: string; en: string }> = {
  IPX4: { zh: "第二位 4：任何方向溅水，不能有有害影响", en: "Second digit 4: splashing water from any direction does no harm" },
  IPX7: { zh: "第二位 7：短时浸水。试验时最低点在水下 1 m，泡 30 min", en: "Second digit 7: temporary immersion. Tested with the lowest point 1 m under water for 30 min" },
  IPX8: { zh: "第二位 8：持续浸水。条件由厂家和用户约定，要比 7 更严", en: "Second digit 8: continuous immersion, under conditions agreed between maker and user, harsher than for 7" },
  IP6X: { zh: "第一位 6：完全防尘。粉尘箱试验后里面不能有灰", en: "First digit 6: dust-tight. No dust inside after the dust-chamber test" },
}

function SealPanel({ s }: { s: SealState }) {
  if (s.step === 5) {
    const [a, b] = s.ip === "IP6X" ? ["6", "X"] : ["X", s.ip.slice(3)]
    return (
      <div className="pointer-events-none absolute left-3 top-3 w-72 rounded-lg border bg-popover p-3 shadow-popover">
        <div className="text-small font-medium">{t("IP 代码（IEC 60529）", "IP code (IEC 60529)")}</div>
        <div className="mt-2 flex items-baseline gap-1 font-mono text-title">
          <span>IP</span>
          <span className={cn(a !== "X" && "text-primary")}>{a}</span>
          <span className={cn(b !== "X" && "text-primary")}>{b}</span>
        </div>
        <div className="mt-1 space-y-0.5 text-caption text-muted-foreground">
          <div>{t("第一位：固体和灰尘，0–6", "1st digit: solids and dust, 0–6")}</div>
          <div>{t("第二位：水，0–9", "2nd digit: water, 0–9")}</div>
        </div>
        <p className="mt-2 text-small">{byLocale(IP_TEXT[s.ip].zh, IP_TEXT[s.ip].en)}</p>
        <p className="mt-1 text-caption text-muted-foreground">{t("X：这一项没有给出，不等于 0。", "X: not stated, which isn't the same as 0.")}</p>
      </div>
    )
  }
  const d = s.cord
  const flex = s.step === 4
  const sq = flex ? minSqueeze(d, s.depth, s.screws, s.lidT) : squeezeOf(d, s.depth)
  const sqTone: Tone = flex ? (s.cord - s.depth - lidBow(s.screws, s.lidT) < 0.2 ? "bad" : pct(sq) >= 20 ? "good" : "warn") : squeezeTone(d, s.depth)
  const fill = fillOf(d, s.depth, s.width, s.swell)
  const chart = CHART[d]
  return (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>{t(`O 形圈线径 ${d.toFixed(2)} mm`, `O-ring cord ${d.toFixed(2)} mm`)}</SceneChip>
        {s.step <= 3 && <SceneChip>{t("剖视", "Section")}</SceneChip>}
      </div>
      <div className="w-72 rounded-lg border bg-popover p-3 shadow-popover">
        <div className="flex items-baseline justify-between text-small">
          <span className="font-medium">{t("静态端面密封", "Static face seal")}</span>
          <span className="text-caption text-muted-foreground">{t("Parker 手册", "Parker handbook")}</span>
        </div>
        <Gauge title={flex ? t("压缩率 · 螺钉之间最小", "Squeeze · lowest, between screws") : t("压缩率", "Squeeze")} value={pct(sq)} lo={0} hi={50} band={[20, 30]} tone={sqTone} />
        <Gauge title={s.swell > 0 ? t(`填充率 · 涨大 ${s.swell}% 后`, `Gland fill · after ${s.swell}% swell`) : t("填充率", "Gland fill")} value={pct(fill)} lo={40} hi={110} band={[60, 85]} warnTo={90} tone={fillTone(fill)} />
        <div className="mt-1 text-caption text-muted-foreground">
          {t(
            `设计表：槽深 ${chart.depth[0].toFixed(2)}–${chart.depth[1].toFixed(2)}，槽宽 ${chart.width[0].toFixed(2)}–${chart.width[1].toFixed(2)}`,
            `Chart: depth ${chart.depth[0].toFixed(2)}–${chart.depth[1].toFixed(2)}, width ${chart.width[0].toFixed(2)}–${chart.width[1].toFixed(2)}`,
          )}
        </div>
      </div>
    </div>
  )
}

const CORD_OPTS = CORDS.map((c) => ({ value: String(c), label: c.toFixed(2) }))

function GrooveSliders({ s, c, depth = true, width = true }: { s: SealState; c: SealsScene; depth?: boolean; width?: boolean }) {
  return (
    <div className="mt-3 space-y-1">
      {depth && <ParamSlider className="px-0" label={t("槽深", "Groove depth")} value={s.depth} min={1} max={5} step={0.05} onChange={(v) => c.setDepth(v)} />}
      {width && <ParamSlider className="px-0" label={t("槽宽", "Groove width")} value={s.width} min={2} max={8} step={0.05} onChange={(v) => c.setWidth(v)} />}
    </div>
  )
}

const lesson: LessonDef<SealState, SealsScene> = {
  id: "seals",
  codes: ["6.5.3"],
  title: t("密封与 O 形圈", "Seals and O-ring grooves"),
  create: (v, emit) => new SealsScene(v, emit),
  steps: [
    {
      title: t("圈被压扁才密封", "A seal works by being squashed"),
      body: byLocale(
        <>
          <p>剖开一个带盖的圆盒：底座法兰上开一圈槽，O 形圈放在槽里，盖子压下来，把它压扁。</p>
          <p>橡胶被压扁后总想弹回原形，就一直顶着盖子和槽底，这两条贴紧的线挡住了液体。里面有压力时，圈被推向槽的外壁，贴得更紧。</p>
        </>,
        <>
          <p>Here is a round box with a lid, cut in half. A groove runs round the flange of the base, the O-ring sits in it, and the lid comes down and squashes it.</p>
          <p>Squashed rubber keeps trying to spring back, so it keeps pushing on the lid and on the groove bottom. Those two lines of contact keep the fluid in. With pressure inside, the ring is pushed against the groove's outer wall and seals even harder.</p>
        </>,
      ),
      task: { label: t("合上盖子，看圈怎么被压扁", "Close the lid and watch the ring squash"), done: (s) => s.closedOnce },
      extra: ({ s, c }) => (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.toggleLid()}>
          {s.close > 0.5 ? <ArrowUpFromLine /> : <ArrowDownToLine />}
          {s.close > 0.5 ? t("打开盖子", "Open the lid") : t("合上盖子", "Close the lid")}
        </Button>
      ),
      terms: ["revolve"],
    },
    {
      title: t("压缩率：压多少", "Squeeze: how much"),
      body: byLocale(
        <>
          <p>压缩率 =（线径 − 槽深）÷ 线径。盖子直接压在法兰上时，槽深就决定了压缩率。</p>
          <p>Parker《O 形圈手册》的端面密封设计表：3.53 mm 线径配 2.57–2.72 mm 槽深，压缩率约 20–30%。压得太重，橡胶应力大、老化快，合盖也费力。</p>
        </>,
        <>
          <p>Squeeze = (cord diameter − groove depth) ÷ cord diameter. When the lid comes down on the flange itself, the groove depth sets the squeeze.</p>
          <p>The face seal design chart in Parker's O-Ring Handbook pairs a 3.53 mm cord with a 2.57–2.72 mm deep groove: about 20–30% squeeze. Squeeze much harder and the rubber is highly stressed and ages faster, and the lid takes more force to close.</p>
        </>,
      ),
      task: { label: t("把槽深调到压缩率 20–30%", "Set the groove depth for 20–30% squeeze"), done: (s) => s.tunedSqueeze },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("槽深做到 3.40 mm，圈还碰得到盖子。会怎样？", "Make the groove 3.40 mm deep. The ring still touches the lid. What happens?")}
            options={byLocale(
              ["能密封，碰到就行", "新的时候勉强贴着，很快就漏", "压得太紧，盖子合不上"],
              ["It seals: touching is enough", "It barely touches when new and soon leaks", "It's too tight and the lid won't close"],
            )}
            answer={1}
            explain={t(
              "只压了 0.13 mm。手册说压缩量不到约 0.2 mm 时，几乎所有橡胶很快就完全永久变形，不再回弹，液体就从这里过去了。",
              "It's squeezed by only 0.13 mm. The handbook says that below about 0.2 mm almost every elastomer soon takes a complete compression set and stops pushing back, and the fluid gets past.",
            )}
            onReveal={() => c.replayClose({ depth: 3.4 })}
          />
          <div className="mt-3 flex items-center gap-2 text-small text-muted-foreground">
            <span>{t("线径", "Cord")}</span>
            <Segmented size="sm" value={String(s.cord)} onValueChange={(v) => c.setCord(Number(v) as Cord)} options={CORD_OPTS} aria-label={t("线径", "Cord diameter")} />
          </div>
          <GrooveSliders s={s} c={c} width={false} />
          <Readout label={t("压缩量", "Squeeze")} value={(s.cord - s.depth).toFixed(2)} unit="mm" tone={toneRead(squeezeTone(s.cord, s.depth))} />
          <Readout label={t("压缩率", "Squeeze")} value={pct(squeezeOf(s.cord, s.depth)).toFixed(1)} unit="%" tone={toneRead(squeezeTone(s.cord, s.depth))} />
        </>
      ),
      note: t(
        "槽在 CAD 里通常是一次旋转切除或沿路径的扫描切除。把线径、槽深、槽宽做成参数，换圈时一起改。",
        "In CAD the groove is usually one revolved cut, or a swept cut along a path. Make cord, depth and width parameters so they change together when you change the ring.",
      ),
      noteTitle: t("建模", "Modelling"),
      terms: ["cut", "sweep"],
    },
    {
      title: t("填充率：给橡胶留地方", "Gland fill: room for the rubber"),
      body: byLocale(
        <>
          <p>橡胶几乎不可压缩：压扁时体积不变，只是变宽。所以槽要比圈宽。</p>
          <p>填充率 = 圈的截面积 ÷ 槽的截面积。手册建议 60–85%，最好约 75%，任何密封槽都至少留 10% 的空隙。</p>
        </>,
        <>
          <p>Rubber hardly compresses at all: squashed, it keeps its volume and just gets wider. So the groove has to be wider than the ring.</p>
          <p>Gland fill = the ring's cross-section area ÷ the groove's. The handbook recommends 60–85%, ideally about 75%, and says every seal groove needs at least 10% empty space.</p>
        </>,
      ),
      task: { label: t("把槽宽调到填充率 60–85%", "Set the groove width for 60–85% fill"), done: (s) => s.tunedFill },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把槽宽改成 3.60 mm，比压扁的圈还窄。盖子能合上吗？", "Make the groove 3.60 mm wide, narrower than the squashed ring. Will the lid close?")}
            options={byLocale(
              ["能，橡胶会被压缩", "合不上：圈没地方去，把盖子顶住", "能合上，而且密封更好"],
              ["Yes, the rubber compresses", "No: the ring has nowhere to go and holds the lid up", "Yes, and it seals better"],
            )}
            answer={1}
            explain={t(
              "圈的截面积比槽的截面积还大，填充率超过 100%。橡胶压不小，盖子就停在半空；用螺钉硬拧，要么塑料壳裂，要么圈被挤进缝里啃坏。",
              "The ring's section is bigger than the groove's, so the fill is over 100%. Rubber won't get smaller, so the lid stops short. Force it down with the screws and either the plastic cracks or the ring is squeezed into the gap and bitten.",
            )}
            onReveal={() => c.replayClose({ width: 3.6 })}
          />
          <GrooveSliders s={s} c={c} />
          <Readout label={t("填充率", "Fill")} value={pct(fillOf(s.cord, s.depth, s.width)).toFixed(1)} unit="%" tone={toneRead(fillTone(fillOf(s.cord, s.depth, s.width)))} />
          <Readout label={t("压缩率", "Squeeze")} value={pct(squeezeOf(s.cord, s.depth)).toFixed(1)} unit="%" tone={toneRead(squeezeTone(s.cord, s.depth))} />
          {pct(fillOf(s.cord, s.depth, s.width)) < 60 && (
            <Hint>{t("槽太宽也不好：占法兰的地方，圈在槽里没有依靠，装配时容易跑偏。", "Too wide isn't good either: it takes up flange space, and the ring has nothing to rest against, so it wanders during assembly.")}</Hint>
          )}
        </>
      ),
    },
    {
      title: t("受热和溶胀：留余量", "Heat and swell: leave a margin"),
      body: byLocale(
        <>
          <p>橡胶受热膨胀得比大多数塑料和金属都多，碰到不合适的油或溶剂还会溶胀。这就是填充率上限要留在 85% 的原因。</p>
          <p>空隙留得少，圈涨大后没地方去：要么把盖子顶开、把塑料壳撑裂，要么挤进缝里被啃掉。手册里甚至有圈受热把钢制槽撑破的例子。</p>
        </>,
        <>
          <p>Heated, rubber expands more than most plastics and metals, and the wrong oil or solvent makes it swell as well. That is why the fill stops at 85%.</p>
          <p>Leave too little space and a swollen ring has nowhere to go: it pushes the lid open and cracks a plastic housing, or squeezes into the gap and gets bitten off. The handbook even mentions rings that burst a steel gland when heated.</p>
        </>,
      ),
      task: {
        label: t("让圈涨大 10% 时盖子仍压得住：把槽调宽", "Make the lid still hold with the ring swollen 10%: widen the groove"),
        done: (s) => s.swellOk,
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("这个槽的填充率是 95%。圈受热、溶胀后涨大 10%，会怎样？", "This groove is 95% full. Heat and swell make the ring 10% bigger. What happens?")}
            options={byLocale(["没影响，盖子压着它", "超过 100%：顶开盖子，挤进缝里", "圈会自己变细"], ["Nothing: the lid holds it down", "It goes over 100%: the lid is pushed open and rubber squeezes into the gap", "The ring gets thinner by itself"])}
            answer={1}
            explain={t("95% × 1.1 ≈ 104%，槽装不下了。设计时按 60–85% 做，涨大以后还有地方。", "95% × 1.1 ≈ 104%, more than the groove holds. Design for 60–85% and there's still room after it swells.")}
            onReveal={() => c.playSwell(10)}
          />
          <ParamSlider className="mt-3 px-0" label={t("胶圈涨大", "Ring swell")} unit="%" value={s.swell} min={0} max={15} step={0.5} onChange={(v) => c.setSwell(v)} />
          <GrooveSliders s={s} c={c} depth={false} />
          <Readout label={t("设计填充率", "Design fill")} value={pct(fillOf(s.cord, s.depth, s.width)).toFixed(1)} unit="%" tone={toneRead(fillTone(fillOf(s.cord, s.depth, s.width)))} />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.playSwell(s.swell >= 10 ? 0 : 10)}>
            <Flame />
            {s.swell >= 10 ? t("恢复常温", "Back to normal") : t("加热膨胀", "Heat it up")}
          </Button>
        </>
      ),
    },
    {
      title: t("塑料盖会在螺钉之间拱起", "A plastic lid bows between screws"),
      body: byLocale(
        <>
          <p>前面算的都是刚性的盖子。真的塑料盖被一整圈胶圈顶着，在两颗螺钉之间会微微拱起，那里的压缩率就变小了。</p>
          <p>所以漏水常常出在两颗螺钉正中间。加螺钉、加厚盖子或加筋，让最弱的地方也压得够。</p>
        </>,
        <>
          <p>Everything so far assumed a rigid lid. A real plastic lid, pushed up by the ring all the way round, bows slightly between two screws, and the squeeze there drops.</p>
          <p>That's why leaks so often show up midway between two screws. Add screws, thicken the lid or add ribs, so even the weakest spot is squeezed enough.</p>
        </>,
      ),
      task: { label: t("让一圈里最小的压缩率也不低于 20%", "Get the lowest squeeze round the ring to 20% or more"), done: (s) => s.flexOk },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("螺钉数", "Screws")} unit="" value={s.screws} min={3} max={8} onChange={(v) => c.setFlex({ screws: v })} />
          <ParamSlider className="px-0" label={t("盖子厚度", "Lid thickness")} value={s.lidT} min={2} max={5} step={0.1} onChange={(v) => c.setFlex({ lidT: v })} />
          <Readout label={t("螺钉间拱起", "Bow between screws")} value={lidBow(s.screws, s.lidT).toFixed(2)} unit="mm" />
        </>
      ),
      note: t(
        "拱起量用简化模型估算：和螺钉间距的四次方成正比，和盖厚的三次方成反比（像一块板）。数值只是示意，真实产品要做有限元分析或实测。",
        "The bow comes from a simplified model: proportional to the screw spacing to the fourth power and inversely to the lid thickness cubed, like a plate. The numbers are illustrative; for a real product use FEA or measure it.",
      ),
      noteTitle: t("简化", "Simplified"),
    },
    {
      title: t("IP 等级：靠测试证明", "IP ratings: proven by test"),
      body: byLocale(
        <>
          <p>产品页上的 IP67、IP68 来自 IEC 60529。它描述外壳挡住固体和水的能力：第一位数字管灰尘和异物，第二位管水。</p>
          <p>等级不是算出来的，是按标准做试验得到的。上面这些计算让设计一开始就站得住，最后仍要拿样机去测，最好是老化、跌落之后的样机。</p>
        </>,
        <>
          <p>The IP67 or IP68 on a product page comes from IEC 60529. It describes how well an enclosure keeps out solids and water: the first digit is about dust and objects, the second about water.</p>
          <p>A rating isn't calculated: it is earned in the tests the standard describes. The calculations above make a design that should pass; you still test prototypes, ideally ones that have been aged and dropped.</p>
        </>,
      ),
      task: { label: t("看看三个等级各测什么", "See what three of the ratings test"), done: (s) => s.ipSeen.length >= 3 },
      extra: ({ s, c }) => (
        <Segmented
          className="mt-3"
          size="sm"
          value={s.ip}
          onValueChange={(v) => c.setIp(v)}
          options={(["IPX4", "IPX7", "IPX8", "IP6X"] as const).map((value) => ({ value, label: value }))}
          aria-label={t("IP 等级", "IP rating")}
        />
      ),
    },
  ],
  quiz: [
    {
      q: t("线径 3.53 mm 的 O 形圈，槽深做成 3.45 mm。合上以后会怎样？", "A 3.53 mm O-ring goes in a 3.45 mm deep groove. What happens once the lid is closed?"),
      options: byLocale(
        ["能密封：圈碰到盖子就行", "只压了 0.08 mm，橡胶很快永久变形，会漏", "压得太紧，盖子合不上"],
        ["It seals: touching the lid is enough", "It's squeezed by only 0.08 mm, takes a set soon and leaks", "It's too tight and the lid won't close"],
      ),
      answer: 1,
      explain: t(
        "压缩率约 2%，远低于静态端面密封常用的 20–30%，也低于手册说的约 0.2 mm 最低压缩量。压得太轻的橡胶很快失去回弹。",
        "That's about 2% squeeze, far below the 20–30% usual for static face seals and below the handbook's minimum of about 0.2 mm. Rubber squeezed that lightly soon stops pushing back.",
      ),
    },
    {
      q: t("为了让圈卡得更牢，把槽做窄到填充率 100%，好吗？", "To hold the ring tighter, you make the groove narrow enough for 100% fill. Good idea?"),
      options: byLocale(
        ["好，填满了才不漏", "不好：橡胶不可压缩，没有空隙会顶开盖子或被挤出来，受热、溶胀时更糟", "无所谓，只有压缩率要紧"],
        ["Yes: only a full groove can't leak", "No: rubber doesn't compress, so with no space it holds the lid open or extrudes, worse still when hot or swollen", "Doesn't matter: only the squeeze counts"],
      ),
      answer: 1,
      explain: t(
        "压缩率和填充率要一起满足。手册建议填充率 60–85%，至少留 10% 空隙，给公差、受热膨胀和溶胀留地方。",
        "Squeeze and fill both have to be right. The handbook recommends 60–85% fill and at least 10% empty space, to absorb tolerances, thermal expansion and swell.",
      ),
    },
    {
      q: t("一个四颗螺钉固定的塑料盖，漏水点总在两颗螺钉中间。最对症的改法是？", "A plastic lid held by four screws always leaks midway between two of them. What's the best fix?"),
      options: byLocale(
        ["把槽挖深一点，让圈压得轻些", "加螺钉、加厚盖子或加筋，让螺钉之间也压得够", "换一根更粗的圈，槽不改"],
        ["Make the groove deeper so the ring is squeezed less", "Add screws, thicken the lid or add ribs so it's squeezed enough between screws too", "Fit a thicker ring in the same groove"],
      ),
      answer: 1,
      explain: t(
        "漏在螺钉中间，是盖子在那里拱起、压缩率不够。挖深槽只会压得更少；换粗圈不改槽，填充率可能超过 100%，盖子合不上。",
        "It leaks between screws because the lid bows there and the squeeze runs out. A deeper groove squeezes even less; a thicker ring in the same groove can push the fill past 100% so the lid won't close.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "压缩率 =（线径 − 槽深）÷ 线径：静态端面密封约 20–30%，压缩量不少于约 0.2 mm",
      "填充率 = 圈截面 ÷ 槽截面：60–85%，至少留 10% 空隙给公差、受热和溶胀",
      "塑料盖在螺钉之间会拱起，按最弱处检查压缩率；IP 等级（IEC 60529）要靠测试证明",
    ],
    [
      "Squeeze = (cord − groove depth) ÷ cord: about 20–30% for a static face seal, and never less than about 0.2 mm",
      "Gland fill = ring section ÷ groove section: 60–85%, leaving at least 10% for tolerances, heat and swell",
      "A plastic lid bows between screws, so check the squeeze at the weakest spot; an IP rating (IEC 60529) is proven by test",
    ],
  ),
  next: {
    to: "/lesson/living-hinge",
    label: t("活动铰链", "Living hinges"),
    text: t("盒子和盖子能不能是同一个零件？", "Can a box and its lid be one part?"),
  },
  overlay: ({ s }) => <SealPanel s={s} />,
}

export default lesson
