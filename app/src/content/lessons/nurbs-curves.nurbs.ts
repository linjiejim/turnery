import type { V2 } from "@/three/geom"

/**
 * NURBS curves in 2D, written out for the curve lessons (「NURBS 曲线」, 「曲线质量与重建」,
 * 「Bezier 与 Class-A」): Cox–de Boor basis functions and their derivatives (The NURBS Book,
 * A2.1–A2.3), rational evaluation with curvature, Greville points (Rhino's edit points),
 * interpolation at given parameters, least-squares fitting and Bézier degree elevation.
 *
 * Knot vectors are full (count + degree + 1 values) and clamped: the first and last knot are
 * repeated degree + 1 times, so the curve starts at the first control point and ends at the last.
 * Signed curvature is positive when the curve turns left (counter-clockwise) as u grows.
 */

export type Nurbs = {
  /** Control points. */
  pts: V2[]
  /** Weights, one per control point; omitted = all 1 (a polynomial, non-rational curve). */
  w?: number[]
  /** Degree. */
  p: number
  /** Full knot vector, pts.length + p + 1 values. */
  U: number[]
}

export type CurveSample = { u: number; p: V2; tangent: V2; normal: V2; k: number }

/** A clamped knot vector with uniformly spaced interior knots on [0, 1]. */
export function clampedKnots(count: number, p: number): number[] {
  const spans = count - p
  const U: number[] = []
  for (let i = 0; i <= p; i++) U.push(0)
  for (let i = 1; i < spans; i++) U.push(i / spans)
  for (let i = 0; i <= p; i++) U.push(1)
  return U
}

/** Index k of the knot span holding u: U[k] ≤ u < U[k + 1] (the last span includes u = 1). */
export function findSpan(count: number, p: number, u: number, U: number[]): number {
  const n = count - 1
  if (u >= U[n + 1]) {
    let k = n
    while (k > p && U[k] >= U[n + 1]) k--
    return k
  }
  if (u <= U[p]) {
    let k = p
    while (k < n && U[k + 1] <= U[p]) k++
    return k
  }
  let lo = p
  let hi = n + 1
  let mid = (lo + hi) >> 1
  while (u < U[mid] || u >= U[mid + 1]) {
    if (u < U[mid]) hi = mid
    else lo = mid
    mid = (lo + hi) >> 1
  }
  return mid
}

/**
 * The p + 1 non-zero basis functions N[k−p..k](u) and their derivatives up to order `nd`
 * (Cox–de Boor recursion, A2.3). ders[d][j] belongs to control point k − p + j.
 */
export function basisDers(k: number, u: number, p: number, U: number[], nd: number): number[][] {
  const ndu = Array.from({ length: p + 1 }, () => new Array<number>(p + 1).fill(0))
  const left = new Array<number>(p + 1).fill(0)
  const right = new Array<number>(p + 1).fill(0)
  ndu[0][0] = 1
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[k + 1 - j]
    right[j] = U[k + j] - u
    let saved = 0
    for (let r = 0; r < j; r++) {
      ndu[j][r] = right[r + 1] + left[j - r]
      const temp = ndu[r][j - 1] / ndu[j][r]
      ndu[r][j] = saved + right[r + 1] * temp
      saved = left[j - r] * temp
    }
    ndu[j][j] = saved
  }
  const ders = Array.from({ length: nd + 1 }, () => new Array<number>(p + 1).fill(0))
  for (let j = 0; j <= p; j++) ders[0][j] = ndu[j][p]
  const du = Math.min(nd, p)
  const a = [new Array<number>(p + 1).fill(0), new Array<number>(p + 1).fill(0)]
  for (let r = 0; r <= p; r++) {
    let s1 = 0
    let s2 = 1
    a[0][0] = 1
    for (let kk = 1; kk <= du; kk++) {
      let d = 0
      const rk = r - kk
      const pk = p - kk
      if (r >= kk) {
        a[s2][0] = a[s1][0] / ndu[pk + 1][rk]
        d = a[s2][0] * ndu[rk][pk]
      }
      const j1 = rk >= -1 ? 1 : -rk
      const j2 = r - 1 <= pk ? kk - 1 : p - r
      for (let j = j1; j <= j2; j++) {
        a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j]
        d += a[s2][j] * ndu[rk + j][pk]
      }
      if (r <= pk) {
        a[s2][kk] = -a[s1][kk - 1] / ndu[pk + 1][r]
        d += a[s2][kk] * ndu[r][pk]
      }
      ders[kk][r] = d
      ;[s1, s2] = [s2, s1]
    }
  }
  let f = p
  for (let kk = 1; kk <= du; kk++) {
    for (let j = 0; j <= p; j++) ders[kk][j] *= f
    f *= p - kk
  }
  return ders
}

/** All basis function values N[0..count−1](u) (zero outside the p + 1 non-zero ones). */
export function basisRow(count: number, p: number, U: number[], u: number): number[] {
  const row = new Array<number>(count).fill(0)
  const k = findSpan(count, p, u, U)
  const N = basisDers(k, u, p, U, 0)[0]
  for (let j = 0; j <= p; j++) row[k - p + j] = N[j]
  return row
}

/**
 * Point, unit tangent, left normal and signed curvature at u. `span` forces the knot span used,
 * which gives the one-sided limit at a knot (curvature can jump there).
 */
export function evalCurve(c: Nurbs, u: number, span?: number): CurveSample {
  const n = c.pts.length
  const k = span ?? findSpan(n, c.p, u, c.U)
  const D = basisDers(k, u, c.p, c.U, 2)
  // Homogeneous sums: A = Σ N·w·P, W = Σ N·w and their first two derivatives.
  const A = [
    [0, 0],
    [0, 0],
    [0, 0],
  ]
  const W = [0, 0, 0]
  for (let j = 0; j <= c.p; j++) {
    const i = k - c.p + j
    const wi = c.w?.[i] ?? 1
    for (let d = 0; d < 3; d++) {
      A[d][0] += D[d][j] * wi * c.pts[i][0]
      A[d][1] += D[d][j] * wi * c.pts[i][1]
      W[d] += D[d][j] * wi
    }
  }
  const C: V2 = [A[0][0] / W[0], A[0][1] / W[0]]
  const d1: V2 = [(A[1][0] - W[1] * C[0]) / W[0], (A[1][1] - W[1] * C[1]) / W[0]]
  const d2: V2 = [(A[2][0] - 2 * W[1] * d1[0] - W[2] * C[0]) / W[0], (A[2][1] - 2 * W[1] * d1[1] - W[2] * C[1]) / W[0]]
  const sp = Math.hypot(d1[0], d1[1]) || 1e-9
  const tangent: V2 = [d1[0] / sp, d1[1] / sp]
  return { u, p: C, tangent, normal: [-tangent[1], tangent[0]], k: (d1[0] * d2[1] - d1[1] * d2[0]) / (sp * sp * sp) }
}

export function pointAt(c: Nurbs, u: number): V2 {
  return evalCurve(c, u).p
}

/** The non-empty knot spans: their parameter range and span index. */
export function knotSpans(c: Nurbs): { a: number; b: number; k: number }[] {
  const out: { a: number; b: number; k: number }[] = []
  for (let k = c.p; k < c.pts.length; k++) if (c.U[k + 1] > c.U[k]) out.push({ a: c.U[k], b: c.U[k + 1], k })
  return out
}

/** Distinct knot values from start to end: the span boundaries (Alias draws its edit points here). */
export function breakpoints(c: Nurbs): number[] {
  const out: number[] = []
  for (const s of knotSpans(c)) {
    if (!out.length) out.push(s.a)
    out.push(s.b)
  }
  return out
}

/**
 * Samples span by span within [from, to]: each span's end is evaluated in that span and the next
 * span starts again at the same point, so a jump in curvature at a knot stays visible.
 */
export function sampleCurve(c: Nurbs, perSpan = 24, from = 0, to = 1): CurveSample[] {
  const out: CurveSample[] = []
  for (const s of knotSpans(c)) {
    const a = Math.max(s.a, from)
    const b = Math.min(s.b, to)
    if (b <= a) continue
    const m = Math.max(2, Math.ceil((perSpan * (b - a)) / (s.b - s.a)))
    for (let i = 0; i <= m; i++) out.push(evalCurve(c, a + ((b - a) * i) / m, s.k))
  }
  return out
}

/** Parameter range a control point pulls on: [U[i], U[i + p + 1]]. */
export function influence(c: Nurbs, i: number): [number, number] {
  return [c.U[i], c.U[i + c.p + 1]]
}

/** How many non-empty spans control point i pulls on. */
export function spansInfluenced(c: Nurbs, i: number): number {
  const [a, b] = influence(c, i)
  return knotSpans(c).filter((s) => s.a >= a && s.b <= b).length
}

/** Greville abscissae: the knot averages, one per control point (Rhino puts its edit points here). */
export function greville(c: Nurbs): number[] {
  const out: number[] = []
  for (let i = 0; i < c.pts.length; i++) {
    let s = 0
    for (let j = 1; j <= c.p; j++) s += c.U[i + j]
    out.push(c.p ? s / c.p : c.U[i])
  }
  return out
}

/** Solve A·X = B (A square, B with `cols` columns) by Gaussian elimination with partial pivoting. */
export function solve(A: number[][], B: number[][]): number[][] {
  const n = A.length
  const M = A.map((r, i) => [...r, ...B[i]])
  const cols = B[0]?.length ?? 0
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    ;[M[c], M[piv]] = [M[piv], M[c]]
    const d = M[c][c] || 1e-12
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / d
      if (!f) continue
      for (let k = c; k < n + cols; k++) M[r][k] -= f * M[c][k]
    }
  }
  const X = Array.from({ length: n }, () => new Array<number>(cols).fill(0))
  for (let r = n - 1; r >= 0; r--)
    for (let k = 0; k < cols; k++) {
      let s = M[r][n + k]
      for (let j = r + 1; j < n; j++) s -= M[r][j] * X[j][k]
      X[r][k] = s / (M[r][r] || 1e-12)
    }
  return X
}

/**
 * Control points of a (non-rational) curve with degree p and knots U that passes through
 * `targets` at parameters `params` (as many as control points). Moving one of Rhino's edit
 * points works like this: every other edit point stays where it is.
 */
export function interpolate(p: number, U: number[], params: number[], targets: V2[]): V2[] {
  const n = targets.length
  const A = params.map((u) => basisRow(n, p, U, u))
  return solve(A, targets.map((q) => [q[0], q[1]])).map((r) => [r[0], r[1]] as V2)
}

/** Clamped knots placed by averaging the parameters (The NURBS Book 9.8): good for interpolation. */
export function averagedKnots(params: number[], p: number): number[] {
  const n = params.length
  const U: number[] = []
  for (let i = 0; i <= p; i++) U.push(0)
  for (let j = 1; j < n - p; j++) {
    let s = 0
    for (let i = j; i < j + p; i++) s += params[i]
    U.push(s / p)
  }
  for (let i = 0; i <= p; i++) U.push(1)
  return U
}

/** Cumulative chord-length parameters on [0, 1]. */
export function chordParams(pts: V2[]): number[] {
  const d = [0]
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const L = d[d.length - 1] || 1
  return d.map((x) => x / L)
}

/**
 * Least-squares fit of a clamped uniform B-spline with `count` control points and degree p to
 * `data` at `params`: the end points are kept, the inner control points minimise the squared
 * distances. This is the idea behind Rebuild (fixed point count and degree, uniform knots).
 */
export function fitCurve(data: V2[], params: number[], count: number, p: number): Nurbs {
  const U = clampedKnots(count, p)
  const first = data[0]
  const last = data[data.length - 1]
  const inner = count - 2
  const pts: V2[] = [first]
  if (inner > 0) {
    const NtN = Array.from({ length: inner }, () => new Array<number>(inner).fill(0))
    const NtR = Array.from({ length: inner }, () => [0, 0])
    data.forEach((q, m) => {
      const row = basisRow(count, p, U, params[m])
      const rx = q[0] - row[0] * first[0] - row[count - 1] * last[0]
      const ry = q[1] - row[0] * first[1] - row[count - 1] * last[1]
      for (let a = 0; a < inner; a++) {
        const na = row[a + 1]
        if (!na) continue
        NtR[a][0] += na * rx
        NtR[a][1] += na * ry
        for (let b = 0; b < inner; b++) NtN[a][b] += na * row[b + 1]
      }
    })
    for (const r of solve(NtN, NtR)) pts.push([r[0], r[1]])
  }
  pts.push(last)
  return { pts, p, U }
}

/**
 * Count inflections along samples: sign changes of the curvature, ignoring values within
 * `eps` of zero (hysteresis, so noise around a straight bit isn't counted twice).
 */
export function countInflections(smp: CurveSample[], eps = 2e-4): number {
  let sign = 0
  let n = 0
  for (const q of smp) {
    const s = q.k > eps ? 1 : q.k < -eps ? -1 : 0
    if (!s) continue
    if (sign && s !== sign) n++
    sign = s
  }
  return n
}

/** Distance from a point to a polyline (closest segment). */
export function distToPolyline(q: V2, poly: V2[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]
    const b = poly[i + 1]
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const l2 = ex * ex + ey * ey || 1e-12
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / l2))
    const d = Math.hypot(q[0] - a[0] - ex * t, q[1] - a[1] - ey * t)
    if (d < best) best = d
  }
  return best
}

/**
 * Bézier degree elevation (one degree up) on points of any dimension: the new points lie on the
 * old control polygon, Q[i] = i/(n+1)·P[i−1] + (1 − i/(n+1))·P[i]; the curve doesn't change.
 * `k` in [0, 1] eases from the old points (k = 0) to the elevated ones, for animation.
 */
export function elevate(P: number[][], k = 1): number[][] {
  const n = P.length - 1
  const out: number[][] = []
  for (let i = 0; i <= n + 1; i++) {
    if (i === 0) out.push([...P[0]])
    else if (i === n + 1) out.push([...P[n]])
    else {
      const a = (k * i) / (n + 1)
      out.push(P[i].map((x, d) => a * P[i - 1][d] + (1 - a) * x))
    }
  }
  return out
}

/** Second differences of a polygon's heights (y): all of one sign = it turns one way only. */
export function secondDiffs(ys: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < ys.length - 1; i++) out.push(ys[i - 1] - 2 * ys[i] + ys[i + 1])
  return out
}

/** A small deterministic random generator (mulberry32), so "hand-digitized" data is the same every time. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
