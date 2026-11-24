import { t } from "@/lib/i18n"

/**
 * Unit cost of one part by quantity, for each process:
 *
 *   unit(Q) = (setup + tool × ⌈Q / life⌉) / Q + per-part
 *
 * setup: programming, fixtures, a master pattern; tool: a mould, bought again every `life` parts.
 * All defaults are illustrative, for one small housing (a tray about 100 × 60 × 30 mm, 2.5 mm wall),
 * in CNY. Real quotes depend on the part, the material, the supplier and the region.
 */
export type ProcId = "fdm" | "sla" | "sls" | "cnc" | "urethane" | "injection" | "sheet"
export type Assume = { setup: number; tool: number; life: number; part: number }

export const PROCS: { id: ProcId; name: string; short: string; family: "add" | "sub" | "form" | "mould"; tone: string; dash?: string }[] = [
  { id: "fdm", name: t("FDM 熔融沉积打印", "FDM printing"), short: "FDM", family: "add", tone: "text-muted-foreground" },
  { id: "sla", name: t("SLA 光固化打印", "SLA printing"), short: "SLA", family: "add", tone: "text-muted-foreground", dash: "6 3" },
  { id: "sls", name: t("SLS 粉末烧结打印", "SLS printing"), short: "SLS", family: "add", tone: "text-muted-foreground", dash: "2 3" },
  { id: "cnc", name: t("CNC 加工", "CNC machining"), short: "CNC", family: "sub", tone: "text-foreground" },
  { id: "urethane", name: t("真空复模（硅胶模浇注）", "Urethane casting (silicone mould)"), short: t("复模", "Casting"), family: "mould", tone: "text-scene-good" },
  { id: "injection", name: t("注塑", "Injection moulding"), short: t("注塑", "Moulding"), family: "mould", tone: "text-primary" },
  { id: "sheet", name: t("钣金（激光切割 + 折弯）", "Sheet metal (laser cut + bend)"), short: t("钣金", "Sheet"), family: "form", tone: "text-scene-modified" },
]

export const procOf = (id: ProcId) => PROCS.find((p) => p.id === id)!

export const DEFAULTS: Record<ProcId, Assume> = {
  fdm: { setup: 0, tool: 0, life: 0, part: 180 },
  sla: { setup: 0, tool: 0, life: 0, part: 260 },
  sls: { setup: 0, tool: 0, life: 0, part: 220 },
  cnc: { setup: 800, tool: 0, life: 0, part: 320 },
  urethane: { setup: 800, tool: 800, life: 20, part: 50 },
  injection: { setup: 0, tool: 50000, life: 100000, part: 4 },
  sheet: { setup: 300, tool: 0, life: 0, part: 60 },
}

export const Q_MAX = 100000

export function unitCost(a: Assume, q: number) {
  const tools = a.tool > 0 ? a.tool * (a.life > 0 ? Math.ceil(q / a.life) : 1) : 0
  return (a.setup + tools) / q + a.part
}

export const totalCost = (a: Assume, q: number) => unitCost(a, q) * q

export function enabled(allowSheet: boolean) {
  return PROCS.filter((p) => allowSheet || p.id !== "sheet").map((p) => p.id)
}

export function cheapest(assume: Record<ProcId, Assume>, q: number, ids: ProcId[]) {
  let best = ids[0]
  for (const id of ids) if (unitCost(assume[id], q) < unitCost(assume[best], q) - 1e-9) best = id
  return best
}

/** Quantities where the cheapest process changes, scanning 1 … Q_MAX on a log grid, refined to the exact integer. */
export function breakEvens(assume: Record<ProcId, Assume>, ids: ProcId[]) {
  const out: { q: number; from: ProcId; to: ProcId }[] = []
  let prevQ = 1
  let prev = cheapest(assume, 1, ids)
  for (let i = 1; i <= 500; i++) {
    const q = Math.round(Math.pow(Q_MAX, i / 500))
    if (q === prevQ) continue
    const w = cheapest(assume, q, ids)
    if (w !== prev) {
      // Smallest integer in (prevQ, q] where `prev` stops being cheapest.
      let lo = prevQ
      let hi = q
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2)
        if (cheapest(assume, mid, ids) === prev) lo = mid
        else hi = mid
      }
      out.push({ q: hi, from: prev, to: cheapest(assume, hi, ids) })
      prev = w
    }
    prevQ = q
  }
  return out
}

/** The first quantity from which process b is no dearer than a (null if never within range). */
export function pairBreakEven(a: Assume, b: Assume) {
  let lo = 1
  if (unitCost(b, 1) <= unitCost(a, 1)) return 1
  let hi = -1
  for (let i = 1; i <= 400; i++) {
    const q = Math.round(Math.pow(Q_MAX, i / 400))
    if (unitCost(b, q) <= unitCost(a, q)) {
      hi = q
      break
    }
    lo = q
  }
  if (hi < 0) return null
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (unitCost(b, mid) <= unitCost(a, mid)) hi = mid
    else lo = mid
  }
  return hi
}

/** Slider ranges for editing each process's assumptions. */
export const RANGES: Record<keyof Assume, { min: number; max: number; step: number }> & { toolBig: { min: number; max: number; step: number } } = {
  setup: { min: 0, max: 3000, step: 50 },
  tool: { min: 0, max: 3000, step: 50 },
  toolBig: { min: 5000, max: 150000, step: 5000 },
  life: { min: 5, max: 60, step: 1 },
  part: { min: 1, max: 600, step: 1 },
}

/** "¥1,234" style; under ¥10 with one decimal. */
export const yuan = (v: number) => `¥${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString("en-US")}`
export const qty = (q: number) => q.toLocaleString("en-US")
