import { RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { cheapest, enabled, pairBreakEven, procOf, PROCS, Q_MAX, qty, RANGES, unitCost, yuan, type ProcId } from "./process-cost.model"
import { ProcessScene, type CostState } from "./process-cost.scene"
import type { LessonDef } from "./types"

/** 4.0.1 「增材、减材、钣金成形、注塑总览：按数量选工艺」: unit cost by quantity, break-even points, and the factors cost doesn't cover. */

const HOW: Record<ProcId, string> = {
  fdm: t("喷头把熔化的塑料丝一层层挤出来，堆成零件", "A nozzle lays down molten filament, layer on layer"),
  sla: t("光把液态树脂逐层固化，零件倒挂在平台上长出来", "Light cures liquid resin layer by layer; the part hangs from the platform"),
  sls: t("激光把尼龙粉逐层烧结，零件埋在粉里，不用支撑", "A laser sinters nylon powder layer by layer; the part sits in powder, no supports"),
  cnc: t("刀具从整块料里铣掉不要的部分", "A cutter mills away everything that isn't the part"),
  urethane: t("先做一个母模，翻出硅胶模，再把聚氨酯浇进去", "Make a master, cast a silicone mould around it, then pour polyurethane in"),
  injection: t("熔融塑料高压注进钢模，冷却后开模顶出", "Molten plastic is injected into a steel mould, cooled, then ejected"),
  sheet: t("激光切出平板展开料，再折弯成形", "A flat blank is laser cut, then bent to shape"),
}

const CW = 340
const CH = 214
const PL = 40
const PR = 6
const PT = 6
const PB = 20
const xq = (q: number) => PL + (Math.log10(q) / 5) * (CW - PL - PR)
const yc = (c: number) => PT + (1 - Math.min(5, Math.max(0, Math.log10(c))) / 5) * (CH - PT - PB)

/** Quantities to sample a curve at: a log grid, plus every mould change for the casting sawtooth. */
const GRID = (() => {
  const set = new Set<number>()
  for (let i = 0; i <= 260; i++) set.add(Math.round(Math.pow(Q_MAX, i / 260)))
  for (let q = 1; q <= 3000; q++) set.add(q)
  return [...set].sort((a, b) => a - b)
})()

function CostChart({ s, c }: { s: CostState; c: ProcessScene }) {
  const ids = enabled(s.allowSheet)
  const best = cheapest(s.assume, s.q, ids)
  const breaks = c.breaks()
  return (
    <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} className="mt-3 block text-foreground" aria-label={t("单件成本随数量变化", "Unit cost against quantity")}>
      {[1, 10, 100, 1000, 10000, 100000].map((v) => (
        <g key={v} className="text-faint-foreground">
          <line x1={PL} x2={CW - PR} y1={yc(v)} y2={yc(v)} stroke="currentColor" strokeOpacity={0.25} />
          <text x={PL - 4} y={yc(v) + 4} textAnchor="end" fill="currentColor" className="text-caption tabular">
            {v >= 1000 ? `¥${v / 1000}k` : `¥${v}`}
          </text>
          <line x1={xq(v)} x2={xq(v)} y1={PT} y2={CH - PB} stroke="currentColor" strokeOpacity={0.12} />
          <text x={xq(v)} y={CH - 6} textAnchor={v === 1 ? "start" : v === 100000 ? "end" : "middle"} fill="currentColor" className="text-caption tabular">
            {v >= 1000 ? `${v / 1000}k` : v}
          </text>
        </g>
      ))}
      {PROCS.filter((p) => ids.includes(p.id)).map((p) => {
        const a = s.assume[p.id]
        const d = GRID.map((q, i) => `${i ? "L" : "M"} ${xq(q).toFixed(1)} ${yc(unitCost(a, q)).toFixed(1)}`).join(" ")
        return (
          <path
            key={p.id}
            d={d}
            fill="none"
            className={cn(p.tone, "cursor-pointer")}
            stroke="currentColor"
            strokeWidth={p.id === best || p.id === s.proc ? 2.4 : 1.3}
            strokeDasharray={p.dash}
            strokeLinejoin="round"
            onClick={() => c.pick(p.id)}
          />
        )
      })}
      <line x1={xq(s.q)} x2={xq(s.q)} y1={PT} y2={CH - PB} stroke="currentColor" strokeDasharray="3 3" />
      {s.step >= 2 &&
        breaks.map((b) => (
          <g key={`${b.from}-${b.to}`}>
            <circle cx={xq(b.q)} cy={yc(unitCost(s.assume[b.to], b.q))} r={4} className="text-foreground" fill="none" stroke="currentColor" strokeWidth={1.5} />
            <text x={xq(b.q) + 6} y={yc(unitCost(s.assume[b.to], b.q)) - 6} fill="currentColor" className="text-caption tabular font-medium">
              {qty(b.q)}
            </text>
          </g>
        ))}
    </svg>
  )
}

/** Each process's unit cost at the current quantity; click to see it made. */
function Legend({ s, c }: { s: CostState; c: ProcessScene }) {
  const ids = enabled(s.allowSheet)
  const best = cheapest(s.assume, s.q, ids)
  return (
    <div className="mt-2 space-y-0.5">
      {PROCS.filter((p) => ids.includes(p.id)).map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => c.pick(p.id)}
          className={cn("flex w-full items-center gap-2 rounded-sm px-1.5 py-0.5 text-left text-small hover:bg-accent", p.id === s.proc && "bg-selected")}
        >
          <svg width={22} height={8} className={cn("shrink-0", p.tone)} aria-hidden>
            <line x1={1} x2={21} y1={4} y2={4} stroke="currentColor" strokeWidth={2} strokeDasharray={p.dash} />
          </svg>
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          <span className={cn("font-mono text-caption tabular", p.id === best ? "font-medium text-success" : "text-muted-foreground")}>{yuan(unitCost(s.assume[p.id], s.q))}</span>
        </button>
      ))}
      <div className="px-1.5 text-caption text-muted-foreground">{t("单件成本 · 示意价（人民币）· 绿色为当前最便宜", "Unit cost · illustrative prices (CNY) · green is cheapest now")}</div>
    </div>
  )
}

/** Quantity on a log scale, 1 … 100,000. */
function QtySlider({ s, c }: { s: CostState; c: ProcessScene }) {
  const v = Math.round(Math.log10(s.q) * 100)
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-small">
        <label htmlFor="pc-qty" className="font-medium">
          {t("数量", "Quantity")}
        </label>
        <span className="font-mono tabular">{t(`${qty(s.q)} 件`, `${qty(s.q)} ${s.q === 1 ? "part" : "parts"}`)}</span>
      </div>
      <input id="pc-qty" type="range" min={0} max={500} step={1} value={v} onChange={(e) => c.setQ(Math.max(1, Math.round(Math.pow(10, Number(e.target.value) / 100))))} className="mt-1 block h-5 w-full cursor-pointer accent-primary" />
      <div className="text-caption text-muted-foreground">{t("对数刻度：每一大格是 10 倍", "Log scale: each major step is ten times more")}</div>
    </div>
  )
}

function Picker({ s, c }: { s: CostState; c: ProcessScene }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-1.5">
      {PROCS.map((p) => (
        <Button key={p.id} size="sm" variant={p.id === s.proc ? "primary" : "secondary"} className="justify-start" onClick={() => c.pick(p.id)}>
          {p.name.split(/[（(]/)[0].trim()}
        </Button>
      ))}
    </div>
  )
}

function Assumptions({ s, c }: { s: CostState; c: ProcessScene }) {
  const a = s.assume[s.proc]
  const big = s.proc === "injection"
  const tooling = s.proc === "injection" || s.proc === "urethane"
  return (
    <div className="mt-3 rounded-md bg-sunken px-3 py-2">
      <div className="text-small font-medium">{t(`${procOf(s.proc).name}的假设`, `Assumptions for ${procOf(s.proc).name}`)}</div>
      <ParamSlider className="px-0" label={t("一次性费用（编程、夹具、母模）", "One-off cost (programming, fixtures, master)")} unit="¥" value={a.setup} min={RANGES.setup.min} max={RANGES.setup.max} step={RANGES.setup.step} onChange={(v) => c.setAssume(s.proc, { setup: v })} />
      {tooling && (
        <ParamSlider
          className="px-0"
          label={big ? t("模具费", "Mould cost") : t("每副硅胶模", "Each silicone mould")}
          unit="¥"
          value={a.tool}
          min={big ? RANGES.toolBig.min : RANGES.tool.min}
          max={big ? RANGES.toolBig.max : RANGES.tool.max}
          step={big ? RANGES.toolBig.step : RANGES.tool.step}
          onChange={(v) => c.setAssume(s.proc, { tool: v })}
        />
      )}
      {s.proc === "urethane" && <ParamSlider className="px-0" label={t("每副硅胶模能浇的件数", "Castings per silicone mould")} unit={t("件", "pcs")} value={a.life} min={RANGES.life.min} max={RANGES.life.max} step={RANGES.life.step} onChange={(v) => c.setAssume(s.proc, { life: v })} />}
      <ParamSlider className="px-0" label={t("每件费用（材料、机时、人工）", "Per-part cost (material, machine time, labour)")} unit="¥" value={a.part} min={RANGES.part.min} max={RANGES.part.max} step={RANGES.part.step} onChange={(v) => c.setAssume(s.proc, { part: v })} />
      <Button size="sm" variant="ghost" onClick={() => c.resetAssume()}>
        <RotateCcw />
        {t("恢复默认假设", "Reset assumptions")}
      </Button>
    </div>
  )
}

function Overlay({ s }: { s: CostState }) {
  const p = procOf(s.proc)
  return (
    <div className="pointer-events-none absolute left-3 top-3 max-w-[60%] space-y-2">
      <div className="w-fit rounded-lg border bg-popover px-3 py-2 shadow-popover">
        <div className={cn("text-small font-medium")}>{p.name}</div>
        <div className="text-small text-muted-foreground">{HOW[s.proc]}</div>
      </div>
      {s.step >= 1 && (
        <SceneChip>
          {t(`${qty(s.q)} 件时单价 ${yuan(unitCost(s.assume[s.proc], s.q))}`, `At ${qty(s.q)}: ${yuan(unitCost(s.assume[s.proc], s.q))} each`)}
          {s.follow && <span className="text-muted-foreground">{t(" · 视图跟着最便宜的工艺", " · the view follows the cheapest")}</span>}
        </SceneChip>
      )}
    </div>
  )
}

const lesson: LessonDef<CostState, ProcessScene> = {
  id: "process-cost",
  codes: ["4.0.1"],
  title: t("增材、减材、钣金成形、注塑总览：按数量选工艺", "Additive, subtractive, sheet metal and moulding: choosing a process by quantity"),
  create: (v, emit) => new ProcessScene(v, emit),
  steps: [
    {
      title: t("同一个零件，几种做法", "One part, several ways to make it"),
      body: byLocale(
        <>
          <p>这是一个小托盘：100 × 60 × 30 mm，壁厚 2.5 mm，里面两个螺丝柱。做它的办法大致分四类：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>增材：一层层堆出来，比如 FDM、SLA、SLS 三种 3D 打印。</li>
            <li>减材：从整块料里铣掉多余的部分，比如 CNC。</li>
            <li>成形：把板材切好再折弯，比如钣金。它只能做等壁厚的折弯件，所以是一个没有螺丝柱的托盘。</li>
            <li>灌模：把材料灌进模具的空腔，比如硅胶模的真空复模、钢模的注塑。</li>
          </ul>
        </>,
        <>
          <p>This is a small tray: 100 × 60 × 30 mm, a 2.5 mm wall, two screw bosses inside. The ways to make it fall into four groups:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Additive: built up layer by layer, as in FDM, SLA and SLS 3D printing.</li>
            <li>Subtractive: everything else milled away from a solid block, as in CNC machining.</li>
            <li>Forming: sheet cut flat and bent, as in sheet metal. It only makes parts of one thickness, so here it is a tray without bosses.</li>
            <li>Moulding and casting: material filled into a cavity, as in urethane casting in a silicone mould, or injection moulding in a steel one.</li>
          </ul>
        </>,
      ),
      task: { label: t("看至少 4 种工艺怎么做出这个零件", "Watch at least 4 processes make the part"), done: (s) => s.seen.length >= 4 },
      extra: ({ s, c }) => <Picker s={s} c={c} />,
    },
    {
      title: t("单件成本 = 一次性费用 ÷ 数量 + 每件费用", "Unit cost = one-off cost ÷ quantity + per-part cost"),
      body: byLocale(
        <>
          <p>每种工艺的钱分两部分：一次性的（编程、夹具、母模、模具），和每做一件都要花的（材料、机时、人工）。一次性费用摊到每一件上，数量越多摊得越薄。</p>
          <p>打印几乎没有一次性费用，单价是一条平线；注塑的模具很贵，可每件只要几块钱。图是对数坐标，3D 跟着当前最便宜的工艺走。</p>
        </>,
        <>
          <p>Each process costs money in two parts: one-off costs (programming, fixtures, a master pattern, a mould) and costs for every part made (material, machine time, labour). The one-off cost is spread over the parts, thinner the more you make.</p>
          <p>Printing has almost no one-off cost, so its unit cost is a flat line; an injection mould is expensive, but each part costs a few yuan. The chart is on log scales, and the 3D follows whichever process is cheapest.</p>
        </>,
      ),
      task: { label: t("把数量从 1 拖到 10 万，看到至少 3 种工艺轮流最便宜", "Drag the quantity from 1 to 100,000 and see at least 3 processes take turns as cheapest"), done: (s) => s.winners.length >= 3 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("只做 1 件，注塑这一件要多少钱？", "Make just one. What does that single moulded part cost?")}
            options={byLocale(["和打印差不多，一两百元", "一两千元", "五万多元：整副模具都摊在这一件上"], ["About the same as printing, a couple of hundred yuan", "One or two thousand yuan", "Over fifty thousand yuan: the whole mould is on that one part"])}
            answer={2}
            explain={t(
              `按这里的假设，模具 ${yuan(s.assume.injection.tool)} 加每件 ${yuan(s.assume.injection.part)}：做 1 件就是 ${yuan(unitCost(s.assume.injection, 1))}。做 10 万件，每件只摊 ${yuan(s.assume.injection.tool / Q_MAX)}。`,
              `With these assumptions, a ${yuan(s.assume.injection.tool)} mould plus ${yuan(s.assume.injection.part)} a part: one part costs ${yuan(unitCost(s.assume.injection, 1))}. Over 100,000 parts the mould adds only ${yuan(s.assume.injection.tool / Q_MAX)} each.`,
            )}
          />
          <CostChart s={s} c={c} />
          <QtySlider s={s} c={c} />
          <Legend s={s} c={c} />
        </>
      ),
    },
    {
      title: t("找平衡点", "Find the break-even points"),
      body: byLocale(
        <>
          <p>两条曲线的交点叫平衡点：数量比它少，选一次性费用低的；比它多，选单件费用低的。两种工艺都是「一次性 + 每件」时：</p>
          <p className="text-center font-mono">Q* = (F₂ − F₁) ÷ (v₁ − v₂)</p>
          <p>F 是一次性费用，v 是每件费用。硅胶模每做 20 件左右就要换一副，它的曲线是锯齿形的，这时就逐个数量比较。图上的圆圈是最便宜的工艺换手的地方。</p>
        </>,
        <>
          <p>Where two curves cross is the break-even point: below it, pick the process with the lower one-off cost; above it, the one with the lower per-part cost. When both are “one-off + per part”:</p>
          <p className="text-center font-mono">Q* = (F₂ − F₁) ÷ (v₁ − v₂)</p>
          <p>F is the one-off cost and v the per-part cost. A silicone mould has to be replaced every 20 or so castings, so its curve is a sawtooth, and you compare quantity by quantity. The circles mark where the cheapest process changes hands.</p>
        </>,
      ),
      task: { label: t("把数量拖到注塑和真空复模的平衡点附近", "Drag the quantity to near the break-even between moulding and casting"), done: (s) => s.atBreak },
      extra: ({ s, c }) => {
        const be = pairBreakEven(s.assume.urethane, s.assume.injection)
        return (
          <>
            <CostChart s={s} c={c} />
            <QtySlider s={s} c={c} />
            <div className="mt-2 space-y-0.5 text-small">
              {c.breaks().map((b) => (
                <div key={`${b.from}-${b.to}`} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {procOf(b.from).short} → {procOf(b.to).short}
                  </span>
                  <span className="font-mono tabular">{t(`${qty(b.q)} 件`, `${qty(b.q)} parts`)}</span>
                </div>
              ))}
            </div>
            {s.atBreak && be !== null && (
              <Hint>
                {t(
                  `复模和注塑在约 ${qty(be)} 件交叉。用公式估：(${qty(s.assume.injection.tool)} − ${qty(s.assume.urethane.setup)}) ÷ (${s.assume.urethane.part} + ${Math.round(s.assume.urethane.tool / s.assume.urethane.life)} − ${s.assume.injection.part}) ≈ ${qty(Math.round((s.assume.injection.tool - s.assume.urethane.setup) / (s.assume.urethane.part + s.assume.urethane.tool / s.assume.urethane.life - s.assume.injection.part)))}，硅胶模的钱按每件摊。`,
                  `Casting and moulding cross at about ${qty(be)} parts. By the formula: (${qty(s.assume.injection.tool)} − ${qty(s.assume.urethane.setup)}) ÷ (${s.assume.urethane.part} + ${Math.round(s.assume.urethane.tool / s.assume.urethane.life)} − ${s.assume.injection.part}) ≈ ${qty(Math.round((s.assume.injection.tool - s.assume.urethane.setup) / (s.assume.urethane.part + s.assume.urethane.tool / s.assume.urethane.life - s.assume.injection.part)))}, counting the silicone moulds per part.`,
                )}
              </Hint>
            )}
          </>
        )
      },
    },
    {
      title: t("假设一变，平衡点就动", "Change an assumption, and the break-even moves"),
      body: byLocale(
        <>
          <p>图上的价格都是示意值。真实报价随零件大小、材料、批次、供应商和地区差得很多，同一副模具不同的厂报价可能差几倍。</p>
          <p>所以不要背数字，要会算：拿到报价，套进公式，自己找平衡点。改改右边这道题的假设，看平衡点怎么跑。</p>
        </>,
        <>
          <p>The prices here are illustrative. Real quotes vary widely with part size, material, batch, supplier and region; the same mould can be quoted several times higher by one shop than another.</p>
          <p>So don't memorise numbers, learn to work them out: take the quotes, put them in the formula, find your own break-even. Change the assumptions here and watch the break-even move.</p>
        </>,
      ),
      task: {
        label: t("改假设，把注塑和复模的平衡点推到 1,000 件以上", "Change the assumptions to push the moulding–casting break-even past 1,000 parts"),
        done: (s) => (pairBreakEven(s.assume.urethane, s.assume.injection) ?? Infinity) > 1000,
      },
      extra: ({ s, c }) => {
        const be = pairBreakEven(s.assume.urethane, s.assume.injection)
        return (
          <>
            <Predict
              question={t("注塑模具从 ¥50,000 降到 ¥25,000（比如改用铝模），和复模的平衡点会怎样？", "The mould drops from ¥50,000 to ¥25,000 (say, an aluminium tool). What happens to the break-even with casting?")}
              options={byLocale(["不变", "提前到大约一半的数量", "推后到大约两倍"], ["It doesn't move", "It comes forward to about half the quantity", "It moves back to about double"])}
              answer={1}
              explain={t(
                "平衡点 ≈ 一次性费用之差 ÷ 每件费用之差。模具费几乎就是全部的差，减半，平衡点也差不多减半。铝模便宜、做得快，但寿命比钢模短。",
                "Break-even ≈ difference in one-off cost ÷ difference in per-part cost. The mould is nearly all of that difference, so halve it and the break-even roughly halves. Aluminium tools are cheaper and quicker, but don't last as long as steel.",
              )}
              onReveal={() => c.setAssume("injection", { tool: 25000 })}
            />
            <div className="mt-3">
              <Segmented
                size="sm"
                aria-label={t("改哪种工艺的假设", "Which process to edit")}
                value={s.proc === "urethane" ? "urethane" : "injection"}
                onValueChange={(v) => c.pick(v as ProcId)}
                options={[
                  { value: "injection", label: t("注塑", "Moulding") },
                  { value: "urethane", label: t("真空复模", "Casting") },
                ]}
              />
            </div>
            {(s.proc === "injection" || s.proc === "urethane") && <Assumptions s={s} c={c} />}
            <div className="mt-2 text-small">
              {t("注塑和复模的平衡点：", "Moulding–casting break-even: ")}
              <span className="font-mono font-medium tabular">{be === null ? t("10 万件内不交叉", "no crossing below 100,000") : t(`${qty(be)} 件`, `${qty(be)} parts`)}</span>
            </div>
            <CostChart s={s} c={c} />
            <QtySlider s={s} c={c} />
          </>
        )
      },
    },
    {
      title: t("不只看钱：材料、几何、公差、交期", "Beyond cost: material, geometry, tolerance, lead time"),
      body: byLocale(
        <>
          <ul className="list-disc space-y-1 pl-5">
            <li>材料：打印只能用各自的线材、树脂、粉末；复模是聚氨酯，可以仿 ABS、PC 或橡胶；注塑和 CNC 用的是真正的量产材料，CNC 还能做金属；钣金就是金属板。</li>
            <li>几何：注塑要拔模、壁厚均匀、尽量没有倒扣；CNC 刀具够不着的地方做不出来，内角带刀具半径；钣金只能是等壁厚的折弯件；打印几乎什么形状都行，连内部流道都可以。</li>
            <li>公差：按 Hubs（Protolabs）的默认标准，注塑 ±0.25 mm；CNC 金属件 30–120 mm 段 ±0.15 mm；FDM ±0.5%，且不小于 ±0.5 mm；SLS ±0.3%，不小于 ±0.3 mm。要更紧都要另外加钱。</li>
            <li>交期：打印一两天；复模首批大约一到两周；注塑要先开模，几周起。</li>
          </ul>
          <p>如果这个零件能改成等壁厚的折弯件，钣金就进了比赛。打开下面的选项看看。</p>
        </>,
        <>
          <ul className="list-disc space-y-1 pl-5">
            <li>Material: each printer uses its own filament, resin or powder; casting uses polyurethanes that imitate ABS, PC or rubber; moulding and CNC use real production materials, and CNC does metals too; sheet metal is metal sheet.</li>
            <li>Geometry: moulding wants draft, even walls and as few undercuts as possible; CNC can't reach everywhere, and inside corners keep the cutter's radius; sheet metal is bent parts of one thickness; printing makes almost any shape, internal channels included.</li>
            <li>Tolerance: by Hubs' (Protolabs') default standards, moulding ±0.25 mm; CNC metal parts ±0.15 mm in the 30–120 mm range; FDM ±0.5 % but no tighter than ±0.5 mm; SLS ±0.3 % but no tighter than ±0.3 mm. Tighter costs extra.</li>
            <li>Lead time: printing a day or two; first castings in about one to two weeks; moulding needs the mould made first, several weeks.</li>
          </ul>
          <p>If this part could be redesigned as a bent part of one thickness, sheet metal joins the race. Turn on the option below.</p>
        </>,
      ),
      task: { label: t("让零件可以做成钣金，看平板怎么折成托盘", "Let the part be sheet metal and watch the flat blank fold into a tray"), done: (s) => s.allowSheet && s.seen.includes("sheet") },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4">
            <Segmented
              size="sm"
              aria-label={t("零件形状", "Part shape")}
              value={s.allowSheet ? "sheet" : "solid"}
              onValueChange={(v) => c.setAllowSheet(v === "sheet")}
              options={[
                { value: "solid", label: t("带螺丝柱的塑料件", "Plastic part with bosses") },
                { value: "sheet", label: t("改成钣金折弯件", "Redesigned as sheet metal") },
              ]}
            />
          </div>
          <CostChart s={s} c={c} />
          <QtySlider s={s} c={c} />
          <Legend s={s} c={c} />
        </>
      ),
      note: t(
        "公差取自 Hubs 的 Manufacturing Standards（打印、CNC 按 ISO 2768、注塑、钣金）。硅胶模寿命多数复模厂给的是 15–25 件左右，随几何和材料变化。上万件时钣金也会改用冲压模具，单价再降一截。",
        "Tolerances are from Hubs' Manufacturing Standards (printing, CNC to ISO 2768, moulding, sheet metal). Most casting shops quote a silicone mould life of roughly 15–25 parts, depending on geometry and material. At tens of thousands, sheet metal also moves to stamping dies and the unit cost drops again.",
      ),
      noteTitle: t("出处", "Sources"),
    },
  ],
  quiz: [
    {
      q: t("要做 20 个外观样机给用户试用，材料手感要接近量产的 ABS，两周内要。最合适的是？", "You need 20 appearance models for user testing, feeling like production ABS, within two weeks. What fits best?"),
      options: byLocale(
        ["注塑：量产就用它，单价最低", "真空复模：母模加硅胶模一两周就能出件，聚氨酯能仿 ABS", "FDM：最便宜"],
        ["Injection moulding: it's what production uses, and the cheapest per part", "Urethane casting: a master and a silicone mould deliver in a week or two, and polyurethane can imitate ABS", "FDM: it's the cheapest"],
      ),
      answer: 1,
      explain: t(
        "20 件时注塑每件要摊几千元模具费，开模也要几周；FDM 便宜，但层线和材料都不像量产件。复模正好落在几件到几百件之间。",
        "At 20 parts, each moulded part carries thousands in tooling and the mould takes weeks; FDM is cheap, but its layer lines and material don't feel like production. Casting fits the few-to-hundreds range.",
      ),
    },
    {
      q: t("为什么量大时注塑的单价最低？", "Why is injection moulding cheapest per part at high volume?"),
      options: byLocale(
        ["它用的材料比别的工艺便宜", "模具这笔一次性费用被大量零件摊薄，而每件只要几十秒机时和一点料", "注塑机最快，所以没有一次性费用"],
        ["Its materials are cheaper than other processes'", "The one-off mould cost is spread over many parts, and each part takes seconds of machine time and a little material", "Moulding machines are fastest, so there's no one-off cost"],
      ),
      answer: 1,
      explain: t(
        "注塑的一次性费用恰恰最高，靠数量摊薄；每件的周期短、废料少，所以单件费用低。材料本身并不比别的工艺便宜多少。",
        "Moulding has the highest one-off cost of all and relies on volume to spread it; short cycles and little waste keep the per-part cost low. The material itself isn't much cheaper.",
      ),
    },
    {
      q: t("工艺 A 一次性 ¥2,000、每件 ¥30；工艺 B 一次性 ¥20,000、每件 ¥6。平衡点大约在？", "Process A: ¥2,000 one-off, ¥30 a part. Process B: ¥20,000 one-off, ¥6 a part. Where is the break-even?"),
      options: byLocale(["75 件", "750 件", "7,500 件"], ["75 parts", "750 parts", "7,500 parts"]),
      answer: 1,
      explain: t("(20,000 − 2,000) ÷ (30 − 6) = 18,000 ÷ 24 = 750。少于 750 件选 A，多于 750 件选 B。", "(20,000 − 2,000) ÷ (30 − 6) = 18,000 ÷ 24 = 750. Below 750 parts choose A, above it B."),
    },
  ],
  takeaways: byLocale(
    [
      "单件成本 = 一次性费用 ÷ 数量 + 每件费用；数量越大，一次性费用越不要紧",
      "平衡点 = 一次性费用之差 ÷ 每件费用之差；打印、复模、注塑大致按数量从少到多接力",
      "成本只是一面：材料、几何、公差和交期常常先把一些工艺排除掉",
    ],
    [
      "Unit cost = one-off cost ÷ quantity + per-part cost; the bigger the quantity, the less the one-off cost matters",
      "Break-even = difference in one-off cost ÷ difference in per-part cost; printing, casting and moulding roughly take over from one another as quantity grows",
      "Cost is only one side: material, geometry, tolerance and lead time often rule processes out first",
    ],
  ),
  next: {
    to: "/lesson/print-overhang",
    label: t("3D 打印：悬垂与摆放方向", "3D printing: overhangs and orientation"),
    text: t("选了打印，下一步是让零件不用支撑也能打出来。", "Once you've chosen printing, the next step is a part that prints without supports."),
  },
  overlay: ({ s }) => <Overlay s={s} />,
}

export default lesson
