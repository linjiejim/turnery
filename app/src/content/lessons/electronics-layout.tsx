import { Clock, Dices, MoveDown, Plug, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import {
  BAY,
  battOk,
  ElectronicsLayoutScene,
  fits,
  OVERMOLD,
  PLUG,
  rss,
  SWELL,
  swollen,
  worstCase,
  type ElecState,
  type TolKey,
} from "./electronics-layout.scene"
import type { LessonDef } from "./types"

/** 6.5.5 「电子件布局与开孔公差」: place the board, keep metal off the antenna, room for a swelling cell, size the USB-C opening by a tolerance stack. */

const TOL_LABEL: Record<TolKey, string> = {
  pcbHole: t("板子定位（孔比螺钉大）", "Board location (hole bigger than screw)"),
  placement: t("插座贴片偏差", "Receptacle placement on the board"),
  housing: t("外壳开孔位置", "Opening position in the housing"),
  boss: t("螺柱高度和板厚", "Boss height and board thickness"),
}
const TOL_AXIS: Record<TolKey, string> = {
  pcbHole: t("左右", "sideways"),
  placement: t("左右、上下", "both ways"),
  housing: t("左右、上下", "both ways"),
  boss: t("上下", "up–down"),
}

/** The opening seen straight on: the overmold at nominal, and the zone it can land in at worst case. */
function OpeningDiagram({ s }: { s: ElecState }) {
  const W = 248
  const H = 150
  const k = 13
  const cx = W / 2
  const cy = H / 2
  const wc = worstCase(s.tol)
  const ok = fits(s.open.w, s.open.h, s.step === 4 ? wc.y : 0, s.step === 4 ? wc.z : 0)
  const rect = (w: number, h: number, dy = 0, dz = 0) => ({ x: cx + (dy - w / 2) * k, y: cy - (dz + h / 2) * k, width: w * k, height: h * k })
  const env = rect(OVERMOLD.w + 2 * wc.y, OVERMOLD.h + 2 * wc.z)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block text-foreground" aria-label={t("开孔和插头包胶", "Opening and plug overmold")}>
      <rect x={0} y={0} width={W} height={H} fill="currentColor" fillOpacity={0.06} />
      <rect {...rect(s.open.w, s.open.h)} rx={Math.min(1.6, s.open.h / 2) * k} className="text-background" fill="currentColor" />
      <rect {...rect(s.open.w, s.open.h)} rx={Math.min(1.6, s.open.h / 2) * k} className="text-muted-foreground" fill="none" stroke="currentColor" />
      <rect {...rect(OVERMOLD.w, OVERMOLD.h)} rx={1.6 * k} fill="none" stroke="currentColor" strokeWidth={1.2} />
      <rect {...rect(PLUG.w, PLUG.h)} rx={(PLUG.h / 2) * k} fill="currentColor" fillOpacity={0.25} />
      {s.step === 4 && (
        <rect {...env} rx={1.6 * k} fill="none" strokeDasharray="4 3" strokeWidth={1.5} stroke="currentColor" className={ok ? "text-success" : "text-destructive"} />
      )}
      <text x={6} y={14} fill="currentColor" className="text-caption text-muted-foreground">
        {t(`开孔 ${s.open.w.toFixed(2)} × ${s.open.h.toFixed(2)}`, `Opening ${s.open.w.toFixed(2)} × ${s.open.h.toFixed(2)}`)}
      </text>
      <text x={6} y={H - 6} fill="currentColor" className="text-caption text-muted-foreground">
        {s.step === 4 ? t("虚线：最坏情况下包胶可能到的范围", "Dashed: where the overmold can land, worst case") : t("实线：包胶最大 12.35 × 6.5", "Outline: overmold max 12.35 × 6.5")}
      </text>
    </svg>
  )
}

function ElecPanel({ s }: { s: ElecState }) {
  if (s.step === 0) return <SceneChip className="pointer-events-none absolute left-3 top-3">{s.placed ? t("板子已装上", "Board on its bosses") : t("把板子拖到螺柱上方", "Drag the board over the bosses")}</SceneChip>
  if (s.step === 1)
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip>{t("俯视 · 电路板半透明", "Top view · board see-through")}</SceneChip>
        <SceneChip className={battOk(s.batt) ? "text-success" : "text-destructive"}>{battOk(s.batt) ? t("电池在净空区外", "Battery clear") : t("电池在天线净空区里", "Battery in the keep-out")}</SceneChip>
      </div>
    )
  if (s.step === 2) {
    const sw = swollen({ cellT: s.cellT, aged: 1 })
    const ok = sw <= BAY + 1e-9
    return (
      <div className="pointer-events-none absolute left-3 top-3 w-72 rounded-lg border bg-popover p-3 shadow-popover">
        <div className="text-small font-medium">{t("电池仓（侧视，去掉前壁）", "Battery bay (side view, front wall removed)")}</div>
        <div className="mt-2 space-y-1 text-small">
          <Row k={t("电池仓高度", "Bay height")} v={`${BAY.toFixed(1)} mm`} />
          <Row k={t("新电池厚度", "New cell")} v={`${s.cellT.toFixed(1)} mm`} />
          <Row k={t(`鼓包 ${SWELL * 100}% 后`, `After ${SWELL * 100}% swell`)} v={`${sw.toFixed(2)} mm`} tone={ok ? "text-success" : "text-destructive"} />
        </div>
      </div>
    )
  }
  const wc = worstCase(s.tol)
  const st = rss(s.tol)
  return (
    <div className="pointer-events-none absolute left-3 top-3 w-72 rounded-lg border bg-popover p-3 shadow-popover">
      <div className="mb-2 flex items-baseline justify-between text-small">
        <span className="font-medium">{t("USB-C 开孔（正视）", "USB-C opening (head on)")}</span>
        <span className="text-caption text-muted-foreground">mm</span>
      </div>
      <OpeningDiagram s={s} />
      {s.step === 4 && (
        <div className="mt-2 space-y-1 text-small">
          <Row k={t("最坏情况需要", "Worst case needs")} v={`${(OVERMOLD.w + 2 * wc.y).toFixed(2)} × ${(OVERMOLD.h + 2 * wc.z).toFixed(2)}`} />
          <Row k={t("平方和估算", "Root-sum-square")} v={`${(OVERMOLD.w + 2 * st.y).toFixed(2)} × ${(OVERMOLD.h + 2 * st.z).toFixed(2)}`} />
          {s.samples > 0 && <Row k={t(`抽了 ${s.samples} 台`, `${s.samples} units tried`)} v={t(`${s.fails} 台插不到底`, `${s.fails} won't seat`)} tone={s.fails ? "text-destructive" : "text-success"} />}
        </div>
      )}
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("font-mono tabular", tone)}>{v}</span>
    </div>
  )
}

function OpeningSliders({ s, c }: { s: ElecState; c: ElectronicsLayoutScene }) {
  return (
    <div className="mt-3 space-y-1">
      <ParamSlider className="px-0" label={t("开孔宽", "Opening width")} value={s.open.w} min={8} max={16} step={0.05} onChange={(v) => c.setOpen({ w: v })} />
      <ParamSlider className="px-0" label={t("开孔高", "Opening height")} value={s.open.h} min={2.6} max={10} step={0.05} onChange={(v) => c.setOpen({ h: v })} />
    </div>
  )
}

const lesson: LessonDef<ElecState, ElectronicsLayoutScene> = {
  id: "electronics-layout",
  codes: ["6.5.5"],
  title: t("电子件布局与开孔公差", "PCB layout and opening tolerances"),
  create: (v, emit) => new ElectronicsLayoutScene(v, emit),
  steps: [
    {
      title: t("板子先落到螺柱上", "The board sits on its bosses"),
      body: byLocale(
        <>
          <p>外壳里的东西要和电子工程师一起排。板子靠螺柱定位；接口、按键、LED、天线在板上的位置一旦定下，外壳上的开孔、按键帽、导光柱也就跟着定了。</p>
          <p>螺柱做成不对称，或者加一根定位销，板子就只能朝一个方向装进去，产线上不会装反。</p>
        </>,
        <>
          <p>What goes inside the housing is laid out together with the electronics engineer. The board is located by bosses; once the connector, button, LED and antenna have their places on the board, the opening, the button cap and the light pipe in the housing follow.</p>
          <p>Make the bosses asymmetric, or add a locating pin, and the board only goes in one way round, so the line can't fit it backwards.</p>
        </>,
      ),
      task: { label: t("把电路板拖到螺柱上方，让它落下去", "Drag the board over the bosses and let it drop on"), done: (s) => s.placed },
      extra: ({ s, c }) => (
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.placed} onClick={() => c.dropPcb()}>
          <MoveDown />
          {t("直接装上", "Just fit it")}
        </Button>
      ),
    },
    {
      title: t("天线要留净空", "Keep metal away from the antenna"),
      body: byLocale(
        <>
          <p>天线最怕金属。Espressif 的模组硬件设计指南建议：板载天线四周至少留 15 mm 不放金属，装进外壳以后也一样。电池的铝塑膜、USB 的金属壳、金属螺钉都算。</p>
          <p>所以天线放在板子一端、贴着外壳边，那一端用塑料筋托住，不用螺钉；电池放到另一头。</p>
        </>,
        <>
          <p>Antennas hate metal. Espressif's hardware design guidelines for its modules ask for at least 15 mm of clearance from metal all round an on-board antenna, and that still applies once it's inside the housing. A pouch cell's foil, the USB shell and metal screws all count.</p>
          <p>So the antenna goes at one end of the board, near the housing edge, held up by a plastic rib rather than a screw, and the battery goes at the other end.</p>
        </>,
      ),
      task: { label: t("把电池拖出天线净空区", "Drag the battery out of the antenna keep-out"), done: (s) => s.battMoved && battOk(s.batt) },
      note: t(
        "不同模组、不同天线的净空要求不一样，以模组厂的设计指南为准。外壳上的金属漆、金属装饰件也要算进去。",
        "Different modules and antennas need different clearances: follow the module maker's guide. Metallic paint and metal trim on the housing count too.",
      ),
      noteTitle: t("以模组厂为准", "Check the module maker"),
    },
    {
      title: t("电池会鼓，要留地方", "Batteries swell: leave room"),
      body: byLocale(
        <>
          <p>软包锂电池用久了会鼓。常见的说法是约 500 次循环后厚度增加 8–10%，具体要问电池厂。电池仓要按鼓包以后的厚度留，而不是按新电池。</p>
          <p>鼓起来没地方去，就会顶起电路板、撑开外壳，严重时压坏屏幕或电路。电池也别贴着硬的尖角和螺柱放。</p>
        </>,
        <>
          <p>Pouch lithium cells swell with age. The figure usually quoted is 8–10% more thickness after about 500 cycles; ask the cell maker for yours. Size the bay for the swollen cell, not the new one.</p>
          <p>A swelling cell with nowhere to go lifts the board and forces the housing apart, and at worst cracks a display or the board. Keep it away from hard corners and bosses too.</p>
        </>,
      ),
      task: {
        label: t("选一块尽量厚、鼓了也放得下的电池（5.4 mm 以上）", "Pick the thickest cell that still fits once swollen (5.4 mm or more)"),
        done: (s) => s.cellT >= 5.4 - 1e-9 && s.cellT * (1 + SWELL) <= BAY + 1e-9,
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("电池仓高 6.4 mm，新电池 5.9 mm，还剩 0.5 mm。两年后呢？", "The bay is 6.4 mm and the new cell 5.9 mm, leaving 0.5 mm. Two years on?")}
            options={byLocale(["没问题，还有余量", "鼓 10% 到约 6.5 mm，顶起电路板", "电池会越用越薄"], ["Fine, there's room to spare", "It swells 10% to about 6.5 mm and lifts the board", "Cells get thinner with use"])}
            answer={1}
            explain={t("5.9 × 1.1 ≈ 6.5 mm，比 6.4 mm 的电池仓还高。新的时候看着有余量，鼓包以后就没有了。", "5.9 × 1.1 ≈ 6.5 mm, more than the 6.4 mm bay. It looks roomy when new; once it swells, it isn't.")}
            onReveal={() => c.age(1)}
          />
          <ParamSlider className="mt-3 px-0" label={t("电池厚度（新）", "Cell thickness (new)")} value={s.cellT} min={4} max={6.4} step={0.1} onChange={(v) => c.setCellT(v)} hint={t("越厚容量越大", "Thicker means more capacity")} />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.age()}>
            <Clock />
            {s.aged > 0.5 ? t("回到新电池", "Back to new") : t("过两年", "Two years on")}
          </Button>
        </>
      ),
    },
    {
      title: t("插头的外壳也要进去", "The plug's overmold has to fit too"),
      body: byLocale(
        <>
          <p>USB-C 插头前面是 6.65 mm 长的金属头，后面是塑料包胶。USB-IF 的规范只限定包胶的最大尺寸：宽 12.35 mm、高 6.5 mm，各家线材都在这个范围里。</p>
          <p>插到底时，包胶差不多要贴到插座口。插座通常缩在墙里，墙也有厚度：开孔只比金属头大一点，包胶就先顶在墙上，插头插不到底。要么把插座顶到外表面，要么让开孔放得进包胶。</p>
        </>,
        <>
          <p>A USB-C plug is a 6.65 mm long metal shell with a moulded plastic body behind it, the overmold. The USB-IF specification only limits the overmold's maximum size: 12.35 mm wide and 6.5 mm high, and cables vary within that.</p>
          <p>Fully plugged in, the overmold comes almost up to the receptacle's mouth. The receptacle usually sits back inside the wall, and the wall has thickness: make the opening only a little bigger than the shell and the overmold hits the wall first, so the plug can't seat. Either bring the receptacle out to the surface, or make the opening big enough for the overmold.</p>
        </>,
      ),
      task: { label: t("调大开孔，让最大的包胶也插得到底", "Enlarge the opening until the biggest overmold seats"), done: (s) => s.fitNominal },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("开孔 9 × 3.2 mm，金属头 8.25 × 2.4 穿得过去。插得到底吗？", "The opening is 9 × 3.2 mm, so the 8.25 × 2.4 shell passes. Will the plug seat?")}
            options={byLocale(["能，金属头进去就行", "不能：包胶顶在墙上，插不到底", "能，只是会晃"], ["Yes, the shell gets in", "No: the overmold hits the wall before it seats", "Yes, but it wobbles"])}
            answer={1}
            explain={t("插座口缩在墙后，金属头还没插到底，包胶就碰到墙了。触点接触不全，线一碰就掉。", "The receptacle sits behind the wall, so the overmold meets the wall before the shell is all the way in. The contacts barely mate and the cable falls out at a touch.")}
            onReveal={() => c.insert()}
          />
          <OpeningSliders s={s} c={c} />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.insert()}>
            <Plug />
            {t("插上试试", "Try the plug")}
          </Button>
        </>
      ),
      note: t(
        "包胶尺寸见 USB-IF《USB Type-C Connectors and Cable Assemblies Compliance Document》附录 B（Rev 1.2）。规范会更新，设计前查最新版。这里插座缩进墙内的距离是示意。",
        "Overmold limits: USB-IF, USB Type-C Connectors and Cable Assemblies Compliance Document, Appendix B (Rev 1.2). Specs get revised, so check the current one. How far the receptacle sits back here is illustrative.",
      ),
      noteTitle: t("出处", "Source"),
    },
    {
      title: t("公差叠加：开孔留多少", "Tolerance stack: how big the opening"),
      body: byLocale(
        <>
          <p>插座不会刚好在开孔正中。板子在螺柱上能挪（孔比螺钉大）、插座贴片有偏差、外壳开孔的位置有公差、螺柱高度和板厚也有公差，这些偏差会叠加。</p>
          <p>最坏情况：各项同时偏向一边，相加。开孔每边至少要比包胶大这么多。按平方和估算（各项独立）会小一些，但偶尔会有插不进的一台。</p>
        </>,
        <>
          <p>The receptacle never sits exactly in the middle of the opening. The board can shift on its bosses (the holes are bigger than the screws), the receptacle is placed with some error, the opening's position has a tolerance, and so do the boss height and board thickness. The errors stack up.</p>
          <p>Worst case: all of them push the same way at once, so add them. The opening must be at least that much bigger than the overmold on each side. A root-sum-square estimate (independent errors) comes out smaller, but now and then a unit won't take the plug.</p>
        </>,
      ),
      task: { label: t("让最坏的一台也插得到底", "Make even the worst unit take the plug"), done: (s) => s.worstOk },
      extra: ({ s, c }) => {
        const wc = worstCase(s.tol)
        const big = s.open.w > OVERMOLD.w + 2 * wc.y + 1 || s.open.h > OVERMOLD.h + 2 * wc.z + 1
        return (
          <>
            <Predict
              question={t("开孔 12.6 × 6.8 mm，比包胶每边大 0.13–0.15 mm。最坏的一台插得进吗？", "The opening is 12.6 × 6.8 mm, 0.13–0.15 mm per side bigger than the overmold. Will the worst unit take the plug?")}
              options={byLocale(["插得进，名义上有余量", "插不进：最坏情况偏 0.35 mm，比余量大", "全看运气"], ["Yes, there's nominal clearance", "No: worst case it's 0.35 mm off, more than the clearance", "Pure luck"])}
              answer={1}
              explain={t("板子定位 0.15 + 贴片 0.10 + 外壳 0.10 = 0.35 mm，偏向一边时包胶就顶到了开孔边。", "Board 0.15 + placement 0.10 + housing 0.10 = 0.35 mm. Pushed to one side, the overmold catches the edge of the opening.")}
              onReveal={() => c.insertWorst()}
            />
            <div className="mt-3 space-y-1">
              {(Object.keys(s.tol) as TolKey[]).map((k) => (
                <ParamSlider key={k} className="px-0" label={`${TOL_LABEL[k]} · ${TOL_AXIS[k]}`} unit="±" value={s.tol[k]} min={0} max={0.4} step={0.01} onChange={(v) => c.setTol(k, v)} />
              ))}
            </div>
            <OpeningSliders s={s} c={c} />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => c.insertWorst()}>
                <TriangleAlert />
                {t("插最坏一台", "Try the worst unit")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => c.insertSample()}>
                <Dices />
                {t("随机插一台", "Try a random unit")}
              </Button>
            </div>
            <Readout label={t("最坏偏差", "Worst offset")} value={`${wc.y.toFixed(2)} / ${wc.z.toFixed(2)}`} unit={t("左右 / 上下 mm", "side / up mm")} />
            {big && <Hint>{t("开孔太大也不好：缝隙难看，进灰进水也更容易。按最坏情况再留一点就够。", "Too big isn't good either: the gap looks sloppy and lets in dust and water. Worst case plus a little is enough.")}</Hint>}
          </>
        )
      },
      note: t(
        "这里的各项公差是示意值，真实数值看板厂、贴片厂和模厂的能力。插头本身（金属头 ±0.03 mm）由插座导正，这里不计。四项里有的只影响左右，有的只影响上下。",
        "The tolerances here are illustrative; real values come from your board house, assembler and moulder. The plug itself (shell ±0.03 mm) is centred by the receptacle and isn't counted. Of the four contributions, some act only sideways and some only up–down.",
      ),
      noteTitle: t("示意数值", "Illustrative numbers"),
    },
  ],
  quiz: [
    {
      q: t("电池放在离板载天线 5 mm 的地方，会怎样？", "The battery sits 5 mm from the on-board antenna. What's the problem?"),
      options: byLocale(
        ["没问题，电池外面是塑料膜", "软包的铝塑膜是金属，会挡住天线、改变它的调谐；要留足净空", "只会让电池发热"],
        ["None: the pouch is wrapped in plastic", "The pouch's aluminium laminate is metal: it blocks and detunes the antenna, so leave the clearance", "It only makes the battery warm"],
      ),
      answer: 1,
      explain: t(
        "铝塑膜里有一层铝箔。模组厂一般要求天线周围一定距离内不放金属（Espressif 建议至少 15 mm），否则距离和信号都会变差。",
        "The laminate has an aluminium foil layer. Module makers ask for no metal within some distance of the antenna (Espressif suggests at least 15 mm); otherwise range and signal suffer.",
      ),
    },
    {
      q: t("电池仓高 6.0 mm，按鼓包 10% 估算，最厚能选多厚的电池？", "The bay is 6.0 mm. Allowing 10% swell, how thick a cell can you choose?"),
      options: byLocale(["6.0 mm，刚好塞满", "约 5.4 mm", "6.6 mm，电池是软的，压得进去"], ["6.0 mm, a snug fit", "About 5.4 mm", "6.6 mm: it's soft, it'll squeeze in"]),
      answer: 1,
      explain: t("5.4 × 1.1 ≈ 5.94 mm，刚好放得下。挤压电池既危险又会顶坏别的零件。", "5.4 × 1.1 ≈ 5.94 mm, just fits. Squeezing a cell is dangerous and damages whatever it presses on."),
    },
    {
      q: t("四项偏差各 ±0.1 mm，都作用在同一个方向。按最坏情况，开孔每边至少要比插头包胶大多少？", "Four errors of ±0.1 mm each act in the same direction. Worst case, how much bigger than the overmold must the opening be on each side?"),
      options: byLocale(["0.1 mm：取最大的一项", "0.4 mm：各项相加", "0.2 mm：平方和"], ["0.1 mm: take the largest", "0.4 mm: add them up", "0.2 mm: root-sum-square"]),
      answer: 1,
      explain: t(
        "最坏情况是各项同时偏向一边，所以相加。平方和（√4 × 0.1 = 0.2）是统计估算，接受少量不良时才用。",
        "Worst case means all of them push the same way at once, so they add. Root-sum-square (√4 × 0.1 = 0.2) is a statistical estimate, for when you accept a few rejects.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先定接口、按键、LED、天线在板上的位置，外壳的开孔跟着定；天线周围不放金属（Espressif 建议至少 15 mm，以模组厂为准）",
      "电池仓按鼓包后的厚度留（常说 8–10%，问电池厂），别让电池顶着尖角和螺柱",
      "USB-C 开孔 ≥ 包胶最大尺寸（12.35 × 6.5）+ 两边各一份公差叠加：最坏情况相加，平方和更省但有风险",
    ],
    [
      "Fix where the connector, button, LED and antenna sit on the board first; the housing openings follow. No metal near the antenna (Espressif suggests at least 15 mm; follow your module maker)",
      "Size the battery bay for the swollen cell (8–10% is the usual figure; ask the cell maker), and keep the cell off sharp corners and bosses",
      "USB-C opening ≥ overmold maximum (12.35 × 6.5) plus the tolerance stack on each side: worst case adds them; root-sum-square is leaner but riskier",
    ],
  ),
  next: {
    to: "/lesson/disassembly",
    label: t("可拆解与回收", "Design for disassembly"),
    text: t("装得进去以后，还要拆得开、分得清。", "Once it goes together, it also has to come apart and sort cleanly."),
  },
  overlay: ({ s }) => <ElecPanel s={s} />,
}

export default lesson
