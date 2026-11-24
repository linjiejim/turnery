import type { V2 } from "@/three/geom"
import { averagedKnots, chordParams, countInflections, evalCurve, fitCurve, interpolate, sampleCurve, seeded, type CurveSample, type Nurbs } from "./nurbs-curves.nurbs"

/**
 * The data for 「曲线质量与重建」: a convex profile (a sheared elliptical arc, like the top of a
 * mouse or a roof line, with no inflection) "digitized" by hand as 46 points, each off by a few
 * tenths of a millimetre, and the curve drawn through all of them. Rebuilds are least-squares fits
 * of clamped uniform B-splines to dense samples of that curve; the deviation is measured from
 * each sample to the rebuilt curve.
 */
export const DIGITIZED = 46
export const TOL = 0.5

function digitize(): V2[] {
  const A = 115
  const B = 46
  const shear = 0.18
  const th0 = (160 * Math.PI) / 180
  const th1 = (14 * Math.PI) / 180
  const rnd = seeded(7)
  const out: V2[] = []
  for (let i = 0; i < DIGITIZED; i++) {
    let s = i / (DIGITIZED - 1)
    if (i > 0 && i < DIGITIZED - 1) s += ((rnd() - 0.5) * 0.5) / (DIGITIZED - 1)
    const th = th0 + (th1 - th0) * s
    const x = A * Math.cos(th)
    const y = B * Math.sin(th)
    const nl = Math.hypot(B * Math.cos(th), A * Math.sin(th))
    const nx = (B * Math.cos(th)) / nl
    const ny = (A * Math.sin(th)) / nl
    // Hand error: a random part plus slow wobbles, a few tenths of a millimetre at most.
    const e = 0.16 * (rnd() * 2 - 1) + 0.12 * Math.sin(2 * Math.PI * 5.3 * s + 1.1) + 0.072 * Math.sin(2 * Math.PI * 11.7 * s)
    out.push([x + shear * y + nx * e, y + ny * e])
  }
  return out
}

export const POINTS = digitize()

/** The curve through every digitized point: cubic, one control point per data point. */
export const ORIGINAL: Nurbs = (() => {
  const t = chordParams(POINTS)
  const U = averagedKnots(t, 3)
  return { pts: interpolate(3, U, t, POINTS), p: 3, U }
})()

export const ORIGINAL_SAMPLES = sampleCurve(ORIGINAL, 10)
export const ORIGINAL_INFLECTIONS = countInflections(ORIGINAL_SAMPLES)

/** Dense samples of the original: what a rebuild is fitted to and measured against. */
const DATA: CurveSample[] = Array.from({ length: 400 }, (_, i) => evalCurve(ORIGINAL, i / 399))
const DATA_PTS = DATA.map((q) => q.p)
const DATA_T = chordParams(DATA_PTS)

export type Rebuild = {
  curve: Nurbs
  samples: CurveSample[]
  /** Signed deviation at each data sample (positive = the rebuild lies on the outside). */
  devs: { p: V2; d: number }[]
  dev: number
  /** Where the largest deviation is. */
  worst: V2
  inflections: number
}

const cache = new Map<string, Rebuild>()

export function rebuild(count: number, p: number): Rebuild {
  const key = `${p}:${count}`
  const hit = cache.get(key)
  if (hit) return hit
  const curve = fitCurve(DATA_PTS, DATA_T, count, p)
  const samples = sampleCurve(curve, 30)
  const poly = sampleCurve(curve, 40).map((q) => q.p)
  const devs: { p: V2; d: number }[] = []
  let dev = 0
  let worst: V2 = DATA_PTS[0]
  let j = 0
  for (const q of DATA) {
    // The curves run the same way, so the closest segment is near the last one found.
    let best = Infinity
    let foot: V2 = q.p
    for (let k = Math.max(0, j - 60); k < Math.min(poly.length - 1, j + 60); k++) {
      const a = poly[k]
      const b = poly[k + 1]
      const ex = b[0] - a[0]
      const ey = b[1] - a[1]
      const l2 = ex * ex + ey * ey || 1e-12
      const tt = Math.max(0, Math.min(1, ((q.p[0] - a[0]) * ex + (q.p[1] - a[1]) * ey) / l2))
      const fx = a[0] + ex * tt
      const fy = a[1] + ey * tt
      const d = Math.hypot(q.p[0] - fx, q.p[1] - fy)
      if (d < best) {
        best = d
        foot = [fx, fy]
        j = k
      }
    }
    // Outside = against the curvature: the original turns right (k < 0), its left normal points out.
    const side = (foot[0] - q.p[0]) * q.normal[0] + (foot[1] - q.p[1]) * q.normal[1]
    const d = side >= 0 ? best : -best
    devs.push({ p: q.p, d })
    if (best > dev) {
      dev = best
      worst = q.p
    }
  }
  const r: Rebuild = { curve, samples, devs, dev, worst, inflections: countInflections(samples) }
  cache.set(key, r)
  return r
}

export const ok = (r: Rebuild, tol = TOL) => r.dev < tol && r.inflections === 0

/** Fewest points (from degree + 1 up) whose rebuild is within `tol` with no inflections. */
export function fewest(p: number, tol = TOL): number {
  for (let n = p + 1; n <= DIGITIZED; n++) if (ok(rebuild(n, p), tol)) return n
  return DIGITIZED
}

/** What fitting to a tolerance does here: the fewest points within it, wiggles or not. */
export function fitToTolerance(p: number, tol: number): number {
  for (let n = p + 1; n <= DIGITIZED; n++) if (rebuild(n, p).dev < tol) return n
  return DIGITIZED
}
