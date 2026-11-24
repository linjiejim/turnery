import * as THREE from "three"
import type { V2 } from "@/three/geom"
import { bezierPoint, g2CornerBlend, hodograph } from "./curvature-continuity.bezier"
import type { Grid, SurfFn } from "./patch-layout.surf"

/**
 * The mouse of 「分面/布面」, built two ways.
 *
 * B (layered): the plan outline is a rectangle with G2 corner blends. Around it, every vertical
 * section is a slightly leaning side wall, a G2 blend, and then the top dome. Sweeping that section
 * around the plan gives a wall band and a blend band; split at the plan corners they become the side
 * walls (primary), the vertical corner blends and top-edge blends (transitions) and the four corner
 * patches where the blends meet. The top dome inside is the main primary, trimmed by the blends.
 *
 * A (one surface): the same kind of dome with its edge roll built in, interpolated by a single
 * bicubic spline over a coarse grid, then trimmed hard by a vertical side wall.
 */

export const HALF_W = 31
export const HALF_L = 57
/** Size of the G2 plan corners (the blend reaches 1.5 × this along each side). */
export const PLAN_R = 14
const LEAN = THREE.MathUtils.degToRad(6)
const KX = 0.0075
const KY = 0.0016
const Y0 = 14

export type MouseParams = { h0: number; ts: number }
export type Role = "primary" | "transition" | "fillet"

export const dome = (p: MouseParams, x: number, y: number) => p.h0 - KX * x * x - KY * (y - Y0) * (y - Y0)
const domeGrad = (x: number, y: number): V2 => [-2 * KX * x, -2 * KY * (y - Y0)]
export const domeNormal = (x: number, y: number) => {
  const [gx, gy] = domeGrad(x, y)
  return new THREE.Vector3(-gx, -gy, 1).normalize()
}

const R15 = 1.5 * PLAN_R
const STRAIGHT: [V2, V2][] = [
  [
    [HALF_W, -(HALF_L - R15)],
    [HALF_W, HALF_L - R15],
  ],
  [
    [HALF_W - R15, HALF_L],
    [-(HALF_W - R15), HALF_L],
  ],
  [
    [-HALF_W, HALF_L - R15],
    [-HALF_W, -(HALF_L - R15)],
  ],
  [
    [-(HALF_W - R15), -HALF_L],
    [HALF_W - R15, -HALF_L],
  ],
]
const CORNERS: V2[][] = [
  g2CornerBlend([HALF_W, HALF_L], [0, 1], [-1, 0], PLAN_R),
  g2CornerBlend([-HALF_W, HALF_L], [-1, 0], [0, -1], PLAN_R),
  g2CornerBlend([-HALF_W, -HALF_L], [0, -1], [1, 0], PLAN_R),
  g2CornerBlend([HALF_W, -HALF_L], [1, 0], [0, 1], PLAN_R),
]

/** Plan point and outward normal on segment k (even: straight sides right, front, left, back; odd: the corners after them). */
export function plan(k: number, u: number): { c: V2; m: V2 } {
  let c: V2
  let t: V2
  if (k % 2 === 0) {
    const [a, b] = STRAIGHT[k / 2]
    c = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    t = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
  } else {
    const P = CORNERS[(k - 1) / 2]
    c = bezierPoint(P, u)
    const d = bezierPoint(hodograph(P), u)
    const l = Math.hypot(d[0], d[1]) || 1e-9
    t = [d[0] / l, d[1] / l]
  }
  // Counter-clockwise loop seen from above: outward is the right-hand normal.
  return { c, m: [t[1], -t[0]] }
}

export type Section = { c: V2; m: V2; ctrl: V2[]; wallTop: V2; end: V2 }

/** The vertical section at plan point (k, u): the wall line, then a G2 blend that lands tangent on the dome. */
export function section(p: MouseParams, k: number, u: number): Section {
  const { c, m } = plan(k, u)
  const f = (q: number) => dome(p, c[0] - q * m[0], c[1] - q * m[1])
  const din: V2 = [Math.sin(LEAN), Math.cos(LEAN)]
  let qe = 1.5 * p.ts
  let K: V2 = [0, 0]
  let dout: V2 = [1, 0]
  for (let it = 0; it < 16; it++) {
    const fq = f(qe)
    const fp = (f(qe + 1e-3) - f(qe - 1e-3)) / 2e-3
    const l = Math.hypot(1, fp)
    dout = [1 / l, fp / l]
    // Wall line a·din meets the tangent line (qe, fq) + b·dout.
    const den = din[0] * dout[1] - din[1] * dout[0]
    const a = (qe * dout[1] - fq * dout[0]) / den
    K = [a * din[0], a * din[1]]
    qe = K[0] + dout[0] * 1.5 * p.ts
  }
  const ctrl = g2CornerBlend(K, din, dout, p.ts)
  return { c, m, ctrl, wallTop: ctrl[0], end: ctrl[ctrl.length - 1] }
}

const lift = (s: Section, q: V2, x0 = 0) => new THREE.Vector3(s.c[0] - q[0] * s.m[0] + x0, s.c[1] - q[0] * s.m[1], q[1])

/** Wall patch on segment k: from the ground to where the blend starts (or, extended, up to the dome). */
export function wallFn(p: MouseParams, k: number, extended = false): SurfFn {
  return (u, v) => {
    const s = section(p, k, u)
    if (!extended) return lift(s, [s.wallTop[0] * v, s.wallTop[1] * v])
    const top = dome(p, s.c[0], s.c[1])
    return lift(s, [top * Math.tan(LEAN) * v, top * v])
  }
}

/** Blend patch on segment k. */
export function blendFn(p: MouseParams, k: number): SurfFn {
  return (u, v) => {
    const s = section(p, k, u)
    return lift(s, bezierPoint(s.ctrl, v))
  }
}

/** Points around the whole plan (for the top's boundary), segment by segment. */
export const SEG_N = [14, 10, 6, 10, 14, 10, 6, 10]

/** The boundary of the top: where the blends land on the dome (or the plan outline itself, for the untrimmed dome). */
export function topBoundary(p: MouseParams, untrimmed = false): V2[] {
  const out: V2[] = []
  for (let k = 0; k < 8; k++)
    for (let i = 0; i < SEG_N[k]; i++) {
      const s = section(p, k, i / SEG_N[k])
      if (untrimmed) out.push(s.c)
      else out.push([s.c[0] - s.end[0] * s.m[0], s.c[1] - s.end[0] * s.m[1]])
    }
  return out
}

/** A trimmed region as rings from the boundary in to a centre point; height and normal from `h`. */
export function radialGrid(boundary: V2[], h: (x: number, y: number) => number, n: (x: number, y: number) => THREE.Vector3, rings = 14, centre: V2 = [0, 0]): Grid {
  const loop = [...boundary, boundary[0]]
  const pos: THREE.Vector3[][] = []
  const nor: THREE.Vector3[][] = []
  for (let r = 0; r <= rings; r++) {
    const k = 1 - Math.pow(1 - r / rings, 1.25)
    const pr: THREE.Vector3[] = []
    const nr: THREE.Vector3[] = []
    for (const b of loop) {
      const x = b[0] + (centre[0] - b[0]) * k
      const y = b[1] + (centre[1] - b[1]) * k
      pr.push(new THREE.Vector3(x, y, h(x, y)))
      nr.push(n(x, y))
    }
    pos.push(pr)
    nor.push(nr)
  }
  return { pos, nor }
}

/** Is a plan point inside a closed polygon? */
export function inside(pt: V2, poly: V2[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c
  }
  return c
}

/** Straight x = const and y = const lines over a surface z = h(x, y), kept where they fall inside the polygon (a trimmed surface's isoparms). */
export function trimmedIsoLines(poly: V2[], xs: number[], ys: number[], h: (x: number, y: number) => number, lift = 0.08): THREE.Vector3[][] {
  const out: THREE.Vector3[][] = []
  const run = (pts: V2[]) => {
    let cur: THREE.Vector3[] = []
    for (const q of pts) {
      if (inside(q, poly)) cur.push(new THREE.Vector3(q[0], q[1], h(q[0], q[1]) + lift))
      else if (cur.length) {
        if (cur.length > 1) out.push(cur)
        cur = []
      }
    }
    if (cur.length > 1) out.push(cur)
  }
  for (const x of xs) run(Array.from({ length: 121 }, (_, i) => [x, -HALF_L - 2 + ((2 * HALF_L + 4) * i) / 120] as V2))
  for (const y of ys) run(Array.from({ length: 81 }, (_, i) => [-HALF_W - 2 + ((2 * HALF_W + 4) * i) / 80, y] as V2))
  return out
}

// ------------------------------------------------------------------ layout A: one big surface

const A_NX = 9
const A_NY = 15
const A_R = 20

/** Plan outline of A: a rounded rectangle with circular corners, counter-clockwise. */
export function outlineA(n = 30): V2[] {
  const out: V2[] = []
  const cx = HALF_W - A_R
  const cy = HALF_L - A_R
  const centres: V2[] = [
    [cx, cy],
    [-cx, cy],
    [-cx, -cy],
    [cx, -cy],
  ]
  centres.forEach((c, i) => {
    for (let j = 0; j <= n; j++) {
      const a = (i * Math.PI) / 2 + ((Math.PI / 2) * j) / n
      out.push([c[0] + A_R * Math.cos(a), c[1] + A_R * Math.sin(a)])
    }
  })
  return out
}

/** Inset distance from A's outline (negative outside). */
function insetA(x: number, y: number) {
  const qx = Math.abs(x) - (HALF_W - A_R)
  const qy = Math.abs(y) - (HALF_L - A_R)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
  return A_R - outside
}

/** Second derivatives of a natural cubic spline through (xs, ys). */
function splineM(xs: number[], ys: number[]) {
  const n = xs.length
  const M = new Array(n).fill(0)
  const a = new Array(n).fill(0)
  const b = new Array(n).fill(0)
  const c = new Array(n).fill(0)
  const d = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const h0 = xs[i] - xs[i - 1]
    const h1 = xs[i + 1] - xs[i]
    a[i] = h0
    b[i] = 2 * (h0 + h1)
    c[i] = h1
    d[i] = 6 * ((ys[i + 1] - ys[i]) / h1 - (ys[i] - ys[i - 1]) / h0)
  }
  // Thomas algorithm on rows 1..n-2.
  for (let i = 2; i < n - 1; i++) {
    const w = a[i] / b[i - 1]
    b[i] -= w * c[i - 1]
    d[i] -= w * d[i - 1]
  }
  for (let i = n - 2; i >= 1; i--) M[i] = (d[i] - c[i] * M[i + 1]) / b[i]
  return M
}

function splineEval(xs: number[], ys: number[], M: number[], x: number) {
  let i = 0
  while (i < xs.length - 2 && x > xs[i + 1]) i++
  const h = xs[i + 1] - xs[i]
  const t0 = xs[i + 1] - x
  const t1 = x - xs[i]
  return (M[i] * t0 ** 3) / (6 * h) + (M[i + 1] * t1 ** 3) / (6 * h) + (ys[i] / h - (M[i] * h) / 6) * t0 + (ys[i + 1] / h - (M[i + 1] * h) / 6) * t1
}

export type FitA = { h: (x: number, y: number) => number; n: (x: number, y: number) => THREE.Vector3; xs: number[]; ys: number[] }

/** Layout A: one bicubic spline through a coarse grid of the dome with its edge roll, so it can be trimmed by the wall. */
export function fitA(p: MouseParams): FitA {
  const w = 1.5 * p.ts
  const target = (x: number, y: number) => {
    const d = insetA(x, y)
    const base = dome(p, x, y)
    if (d >= w) return base
    if (d >= 0) return base - p.ts * (1 - Math.sqrt(1 - (1 - d / w) ** 2))
    return base - p.ts + 2 * d
  }
  const xs = Array.from({ length: A_NX }, (_, i) => -HALF_W - 1 + ((2 * HALF_W + 2) * i) / (A_NX - 1))
  const ys = Array.from({ length: A_NY }, (_, j) => -HALF_L - 1 + ((2 * HALF_L + 2) * j) / (A_NY - 1))
  const rows = ys.map((y) => {
    const vals = xs.map((x) => target(x, y))
    return { vals, M: splineM(xs, vals) }
  })
  const h = (x: number, y: number) => {
    const col = rows.map((r) => splineEval(xs, r.vals, r.M, x))
    return splineEval(ys, col, splineM(ys, col), y)
  }
  const n = (x: number, y: number) => {
    const e = 0.05
    const gx = (h(x + e, y) - h(x - e, y)) / (2 * e)
    const gy = (h(x, y + e) - h(x, y - e)) / (2 * e)
    return new THREE.Vector3(-gx, -gy, 1).normalize()
  }
  return { h, n, xs, ys }
}

// ------------------------------------------------------------------ patches of B

export type PatchId = string
export const PATCHES: PatchId[] = ["top", ...Array.from({ length: 8 }, (_, k) => `w${k}`), ...Array.from({ length: 8 }, (_, k) => `b${k}`)]

export function roleOf(id: PatchId): Role {
  if (id === "top") return "primary"
  const k = Number(id.slice(1))
  if (id[0] === "w") return k % 2 === 0 ? "primary" : "transition"
  return k % 2 === 0 ? "transition" : "fillet"
}

/** The patch mirrored across the mouse's centre plane (x → −x). */
export function twinOf(id: PatchId): PatchId {
  if (id === "top") return id
  const k = Number(id.slice(1))
  const map = [4, 3, 2, 1, 0, 7, 6, 5]
  return `${id[0]}${map[k]}`
}

/** What kind of patch it is, for the feedback after a click. */
export function kindOf(id: PatchId): "top" | "wall" | "cornerWall" | "edgeBlend" | "cornerPatch" {
  if (id === "top") return "top"
  const k = Number(id.slice(1))
  if (id[0] === "w") return k % 2 === 0 ? "wall" : "cornerWall"
  return k % 2 === 0 ? "edgeBlend" : "cornerPatch"
}

/** Build-order layer of a patch: 1 primaries, 2 transitions, 3 corner patches. */
export const layerOf = (id: PatchId) => (roleOf(id) === "primary" ? 1 : roleOf(id) === "transition" ? 2 : 3)
