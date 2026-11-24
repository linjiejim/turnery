import type { V2 } from "@/three/geom"

/**
 * The maths of 「偏移与加厚」: a product's outer surface cut by a vertical plane is a chain of lines and
 * tangent arcs (a shoulder, a crown, a finger groove, another shoulder). Offsetting moves every point
 * along its normal; an arc of radius R offset towards its centre becomes R − d, and when d > R the
 * offset turns back on itself (a swallowtail loop).
 *
 * The section lives in the XZ plane, walked left to right over the top, so the outward normal is the
 * left normal of the direction of travel. Curvature is signed: positive where the surface is convex
 * seen from outside (centre of curvature inside the material).
 */

/** Corners of the outer section before rounding: left wall, shoulder, crown, groove, crown, right shoulder, right wall. */
export const POLY: V2[] = [
  [-42, 0],
  [-42, 22],
  [-18, 28],
  [0, 19],
  [18, 28],
  [42, 22],
  [42, 0],
]
/** Fixed radii of the inner corners 2–5 (crown, groove, crown, right shoulder). Corner 1 (left shoulder) varies along Y. */
export const FIXED_R = [20, 5, 20, 10]
/** Half length of the body along Y. */
export const HALF_L = 45
/** The left shoulder's radius grows from r0 at the front (y = −L) to r0 × (1 + GROW) at the back. */
export const GROW = 1.2
/** Radius the inside corners get when they are built on their own. */
export const INNER_R = 0.5

export type Sample = { p: V2; n: V2; k: number; piece: number }
export type Dir = "in" | "out"

/** Samples per piece: line, arc, line, arc… (the left shoulder arc gets the most so its loop stays round). */
const LINE_N = [8, 12, 10, 8, 10, 12]
const ARC_N = [28, 14, 14, 14, 16]

const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]]
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]]
const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k]
const len = (a: V2) => Math.hypot(a[0], a[1])
const norm = (a: V2): V2 => {
  const l = len(a) || 1e-9
  return [a[0] / l, a[1] / l]
}
const crossZ = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0]
const leftN = (t: V2): V2 => [-t[1], t[0]]

/** The left shoulder's radius at y. */
export function shoulderR(r0: number, y: number) {
  const u = Math.min(1, Math.max(0, (y + HALF_L) / (2 * HALF_L)))
  return r0 * (1 + GROW * u)
}

/** Where along Y the shoulder radius equals d (the front part, y below it, folds on an inward offset). */
export function foldEndY(r0: number, d: number) {
  const u = (d / r0 - 1) / GROW
  return -HALF_L + 2 * HALF_L * Math.min(1, Math.max(0, u))
}

type Corner = { t1: V2; t2: V2; c: V2; r: number; convex: boolean }

function corner(p0: V2, p1: V2, p2: V2, r: number): Corner {
  const u = norm(sub(p0, p1))
  const v = norm(sub(p2, p1))
  const theta = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])))
  const d = r / Math.tan(theta / 2)
  const c = add(p1, mul(norm(add(u, v)), r / Math.sin(theta / 2)))
  // Walking left to right over the top is clockwise: a right turn is a convex corner.
  const convex = crossZ(sub(p1, p0), sub(p2, p1)) < 0
  return { t1: add(p1, mul(u, d)), t2: add(p1, mul(v, d)), c, r, convex }
}

/** Sample a chain of corners (lines between tangent points, arcs at the corners). */
function chain(pts: V2[], radii: number[]): Sample[] {
  const corners = radii.map((r, i) => corner(pts[i], pts[i + 1], pts[i + 2], r))
  const out: Sample[] = []
  let from = pts[0]
  let piece = 0
  const pushLine = (a: V2, b: V2, n: number, last = false) => {
    const t = norm(sub(b, a))
    for (let i = 0; i < (last ? n + 1 : n); i++) out.push({ p: add(a, mul(sub(b, a), i / n)), n: leftN(t), k: 0, piece })
    piece++
  }
  corners.forEach((c, i) => {
    pushLine(from, c.t1, LINE_N[i])
    let a0 = Math.atan2(c.t1[1] - c.c[1], c.t1[0] - c.c[0])
    let a1 = Math.atan2(c.t2[1] - c.c[1], c.t2[0] - c.c[0])
    let da = a1 - a0
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    a1 = a0 + da
    const n = ARC_N[i]
    for (let j = 0; j < n; j++) {
      const a = a0 + ((a1 - a0) * j) / n
      const radial: V2 = [Math.cos(a), Math.sin(a)]
      out.push({ p: add(c.c, mul(radial, c.r)), n: c.convex ? radial : mul(radial, -1), k: c.convex ? 1 / c.r : -1 / c.r, piece })
    }
    piece++
    from = c.t2
  })
  pushLine(from, pts[pts.length - 1], LINE_N[LINE_N.length - 1], true)
  return out
}

/** The outer section at y. */
export function outerSection(r0: number, y: number): Sample[] {
  return chain(POLY, [shoulderR(r0, y), ...FIXED_R])
}

/** Every point moved d along its normal: the raw offset, loops and all. */
export function offsetSection(s: Sample[], d: number, dir: Dir) {
  const sg = dir === "in" ? -1 : 1
  return s.map((q) => ({ p: add(q.p, mul(q.n, sg * d)), stretch: 1 + sg * d * q.k }))
}

/**
 * The inside built on its own (inward only): offset the sharp corner polygon, intersect neighbouring
 * lines, then round the inside corners with their own radii (concentric where that is still positive,
 * a small radius where it isn't).
 */
export function separateInner(r0: number, y: number, d: number): Sample[] {
  const lines = POLY.slice(0, -1).map((a, i) => {
    const b = POLY[i + 1]
    const nn = mul(leftN(norm(sub(b, a))), -d)
    return [add(a, nn), add(b, nn)] as [V2, V2]
  })
  const pts: V2[] = [lines[0][0]]
  for (let i = 0; i < lines.length - 1; i++) pts.push(intersectLines(lines[i][0], lines[i][1], lines[i + 1][0], lines[i + 1][1]))
  pts.push(lines[lines.length - 1][1])
  const outerR = [shoulderR(r0, y), ...FIXED_R]
  const radii = outerR.map((r, i) => {
    const convex = crossZ(sub(POLY[i + 1], POLY[i]), sub(POLY[i + 2], POLY[i + 1])) < 0
    return convex ? Math.max(r - d, INNER_R) : r + d
  })
  return chain(pts, radii)
}

function intersectLines(a1: V2, a2: V2, b1: V2, b2: V2): V2 {
  const d1 = sub(a2, a1)
  const d2 = sub(b2, b1)
  const den = crossZ(d1, d2)
  if (Math.abs(den) < 1e-9) return a2
  const t = crossZ(sub(b1, a1), d2) / den
  return add(a1, mul(d1, t))
}

/** Self-intersections of an open polyline: each loop as the index range it spans and the crossing point. */
export function loops(pts: V2[]) {
  const out: { i: number; j: number; x: V2 }[] = []
  for (let i = 0; i < pts.length - 3; i++) {
    for (let j = pts.length - 2; j > i + 1; j--) {
      const x = segX(pts[i], pts[i + 1], pts[j], pts[j + 1])
      if (x) {
        out.push({ i, j, x })
        i = j
        break
      }
    }
  }
  return out
}

function segX(a: V2, b: V2, c: V2, d: V2): V2 | null {
  const r = sub(b, a)
  const s = sub(d, c)
  const den = crossZ(r, s)
  if (Math.abs(den) < 1e-12) return null
  const t = crossZ(sub(c, a), s) / den
  const u = crossZ(sub(c, a), r) / den
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null
  return add(a, mul(r, t))
}

/** Shortest distance from p to a polyline. */
export function distToPolyline(p: V2, pts: V2[]) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const ab = sub(pts[i + 1], a)
    const l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1e-12
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2))
    best = Math.min(best, len(sub(p, add(a, mul(ab, t)))))
  }
  return best
}

/** Smallest radius on the side the offset goes to, over the whole body (the shoulder is tightest at the front). */
export function minRadiusTowards(r0: number, dir: Dir) {
  return dir === "in" ? Math.min(r0, 20, 10) : FIXED_R[1]
}

/** Index of the left shoulder arc's middle sample, and of the line between shoulder and crown (for the handle). */
export const SHOULDER_MID = LINE_N[0] + Math.floor(ARC_N[0] / 2)
export const HANDLE_AT = LINE_N[0] + ARC_N[0] + Math.floor(LINE_N[1] / 2)
/** Pieces that are arcs, in order, with which fixed radius (or the shoulder) they carry. */
export const ARC_PIECES = [1, 3, 5, 7, 9]
