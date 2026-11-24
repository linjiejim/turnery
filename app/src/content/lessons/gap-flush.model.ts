import { t } from "@/lib/i18n"

/**
 * The tolerance stack behind the seam of a two-part housing: a cover (A) screwed onto a base (B).
 *
 * Gap (lateral, at the right seam), screw-located: the base's opening edge is the datum; the base's
 * boss sets where the screw is, the screw sits somewhere in the cover's clearance hole (that float is
 * what an assembly fixture controls), the hole sits somewhere on the cover, and the cover's own size
 * puts its edge somewhere. Datum-located: a rib on the cover bears on the opening wall, so only the
 * rib-to-edge distance (short, on one part) and the rib clearance remain.
 *
 * Flush (vertical): the boss height and the cover's thickness. A designed step offsets it on purpose.
 *
 * Each dimension is normal with its tolerance at ±3σ, cut off at ±3σ (a process that is centred and
 * capable). Every number here is illustrative, not from a supplier.
 */
export type ContribId = "size" | "hole" | "boss" | "fixture"
export type Tol = Record<ContribId, number>
export type Mode = "screw" | "datum"

export const CONTRIBS: { id: ContribId; name: string; what: string }[] = [
  { id: "size", name: t("零件尺寸", "Part size"), what: t("面盖外形和厚度（模具缩水的波动）", "Cover outline and thickness (mould shrinkage varies)") },
  { id: "hole", name: t("孔位", "Hole position"), what: t("面盖上螺丝孔的位置", "Where the screw hole is on the cover") },
  { id: "boss", name: t("柱位", "Boss position"), what: t("底壳螺丝柱的位置和高度", "Where the base's screw boss is, and its height") },
  { id: "fixture", name: t("装配夹具", "Assembly fixture"), what: t("拧螺丝前面盖在孔隙里放得多准", "How precisely the cover sits in the screw clearance before screwing") },
]

export const DEFAULT_TOL: Tol = { size: 0.1, hole: 0.08, boss: 0.08, fixture: 0.3 }
/** Datum-located: rib to edge (short, on one part) and rib clearance, mm. */
export const DATUM = { local: 0.03, rib: 0.05 }
export const GAP0 = 0.5
/** Target for the gap: 0.50 ± 0.20. */
export const TARGET = 0.2
export const N = 1000

/** One assembled unit's deviations from nominal, mm. */
export type Dev = { sizeX: number; sizeZ: number; hole: number; bossX: number; bossZ: number; fix: number; local: number; rib: number }
const KEYS: (keyof Dev)[] = ["sizeX", "sizeZ", "hole", "bossX", "bossZ", "fix", "local", "rib"]

/** Deterministic standard normals cut off at ±3, 8 per unit, from a small seeded generator. */
const cache = new Map<number, Float64Array>()
export function zScores(seed: number) {
  let z = cache.get(seed)
  if (z) return z
  let a = (seed * 2654435761) >>> 0 || 1
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  z = new Float64Array(N * KEYS.length)
  for (let i = 0; i < z.length; i++) {
    let v = 9
    while (Math.abs(v) > 3) v = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd())
    z[i] = v
  }
  cache.set(seed, z)
  return z
}

export function devOf(seed: number, i: number, tol: Tol): Dev {
  const z = zScores(seed)
  const k = i * KEYS.length
  const s = (j: number, tl: number) => (z[k + j] * tl) / 3
  return {
    sizeX: s(0, tol.size),
    sizeZ: s(1, tol.size),
    hole: s(2, tol.hole),
    bossX: s(3, tol.boss),
    bossZ: s(4, tol.boss),
    fix: s(5, tol.fixture),
    local: s(6, DATUM.local),
    rib: s(7, DATUM.rib),
  }
}

/** The worst-case unit: every link at the end of its band that widens (+1) or closes (−1) the gap, the cover proud. */
export function worstDev(tol: Tol, mode: Mode, side: 1 | -1): Dev {
  const w = side
  return mode === "screw"
    ? { sizeX: -w * tol.size, sizeZ: tol.size, hole: w * tol.hole, bossX: -w * tol.boss, bossZ: tol.boss, fix: -w * tol.fixture, local: 0, rib: 0 }
    : { sizeX: 0, sizeZ: tol.size, hole: 0, bossX: 0, bossZ: tol.boss, fix: 0, local: -w * DATUM.local, rib: -w * DATUM.rib }
}

/** Shift of the cover (x, mm), its half-width change, and the right gap. */
export function seamOf(d: Dev, mode: Mode) {
  if (mode === "screw") {
    // Screw on the boss; the cover's hole around the screw; the cover's centre from its hole; its edge from its centre.
    const shift = d.bossX + d.fix - d.hole
    return { shift, grow: d.sizeX, gap: GAP0 - shift - d.sizeX }
  }
  const shift = d.local + d.rib
  return { shift, grow: 0, gap: GAP0 - shift }
}

export const flushOf = (d: Dev, step: number) => d.sizeZ + d.bossZ - step

/** Links in the gap chain for a mode: name, tolerance, and whether it's a fixed design value. */
export function gapLinks(tol: Tol, mode: Mode): { id: string; name: string; tol: number; fixed?: boolean }[] {
  if (mode === "datum")
    return [
      { id: "local", name: t("定位筋到边", "Rib to edge"), tol: DATUM.local, fixed: true },
      { id: "rib", name: t("定位筋间隙", "Rib clearance"), tol: DATUM.rib, fixed: true },
    ]
  return CONTRIBS.map((c) => ({ id: c.id, name: c.name, tol: tol[c.id] }))
}

export function stack(tols: number[]) {
  const wc = tols.reduce((a, b) => a + b, 0)
  const rss = Math.sqrt(tols.reduce((a, b) => a + b * b, 0))
  return { wc, rss }
}

export type Sim = { gap: Float64Array; flush: Float64Array; inTarget: number; proud: number; min: number; max: number; fmin: number; fmax: number; mean: number; sd: number }

const simCache = new Map<string, Sim>()
export function simulate(seed: number, tol: Tol, mode: Mode, step: number): Sim {
  const key = `${seed}|${tol.size}|${tol.hole}|${tol.boss}|${tol.fixture}|${mode}|${step}`
  const hit = simCache.get(key)
  if (hit) return hit
  const gap = new Float64Array(N)
  const flush = new Float64Array(N)
  let inTarget = 0
  let proud = 0
  let sum = 0
  let sum2 = 0
  for (let i = 0; i < N; i++) {
    const d = devOf(seed, i, tol)
    gap[i] = seamOf(d, mode).gap
    flush[i] = flushOf(d, step)
    if (Math.abs(gap[i] - GAP0) <= TARGET + 1e-9) inTarget++
    if (flush[i] > 0.005) proud++
    sum += gap[i]
    sum2 += gap[i] * gap[i]
  }
  const mean = sum / N
  const sim: Sim = {
    gap,
    flush,
    inTarget,
    proud,
    min: Math.min(...gap),
    max: Math.max(...gap),
    fmin: Math.min(...flush),
    fmax: Math.max(...flush),
    mean,
    sd: Math.sqrt(Math.max(0, sum2 / N - mean * mean)),
  }
  if (simCache.size > 60) simCache.clear()
  simCache.set(key, sim)
  return sim
}

/** Signed mm with a leading sign, 2 decimals. */
export const mm2 = (v: number) => `${v > 0.004 ? "+" : v < -0.004 ? "−" : "±"}${Math.abs(v).toFixed(2)}`
