import * as THREE from "three"
import type { V2 } from "@/three/geom"
import { bezierPoint } from "./curvature-continuity.bezier"
import type { Grid, SurfFn } from "./patch-layout.surf"

/**
 * Geometry for 「四边面、奇点与收敛点」.
 *
 * The dome: a plan ring (round, or a rounded square), a side wall up to the dome's edge, and the
 * top built two ways. As a pole: every meridian is a cubic from the edge (matching the dome's
 * slope there) to the apex, so the whole top edge of the patch collapses into one point. As a
 * four-sided patch: the height field over a square, trimmed by the ring.
 *
 * The corner: three rounded edges of different sizes meeting at a box corner (an ellipsoid octant).
 * As a three-sided patch with its top edge collapsed into a point, as three four-sided patches,
 * or as one larger four-sided patch trimmed to the corner.
 *
 * Simplified on purpose: real CAD builds these from control points; here the same idea (the row of
 * control points next to a collapsed point) is modelled by the meridians' third control points.
 */

export type Shape = "round" | "square"
export const R0 = 30
const HK: Record<Shape, number> = { round: 0.5523, square: 0.95 }

/** The dome's height field: a paraboloid when round, a squarer pillow otherwise. */
export function domeH(shape: Shape, x: number, y: number) {
  if (shape === "round") return 26 - 0.01333 * (x * x + y * y)
  return 28 - 0.0105 * (x * x + y * y) - 4e-6 * (x ** 4 + y ** 4)
}

export function domeN(shape: Shape, x: number, y: number) {
  const gx = shape === "round" ? -2 * 0.01333 * x : -2 * 0.0105 * x - 16e-6 * x ** 3
  const gy = shape === "round" ? -2 * 0.01333 * y : -2 * 0.0105 * y - 16e-6 * y ** 3
  return new THREE.Vector3(-gx, -gy, 1).normalize()
}

export const apexOf = (shape: Shape) => new THREE.Vector3(0, 0, domeH(shape, 0, 0))

/** The plan ring at u ∈ [0, 1] (counter-clockwise from +X): four cubic quarters. */
export function ring(shape: Shape, u: number): V2 {
  const w = ((u % 1) + 1) % 1
  const q = Math.min(3, Math.floor(w * 4))
  const t = w * 4 - q
  const a0 = (q * Math.PI) / 2
  const a1 = a0 + Math.PI / 2
  const p0: V2 = [R0 * Math.cos(a0), R0 * Math.sin(a0)]
  const p3: V2 = [R0 * Math.cos(a1), R0 * Math.sin(a1)]
  const k = HK[shape] * R0
  const p1: V2 = [p0[0] - Math.sin(a0) * k, p0[1] + Math.cos(a0) * k]
  const p2: V2 = [p3[0] + Math.sin(a1) * k, p3[1] - Math.cos(a1) * k]
  return bezierPoint([p0, p1, p2, p3], t)
}

/** How far the n-th point of the ring next to the pole sits below the apex: zero when round, `eps` scaled by how far that meridian reaches. */
function sag(shape: Shape, u: number, eps: number) {
  if (shape === "round") return 0
  const r = Math.hypot(...ring(shape, u))
  return (eps * (r / R0 - 1)) / 0.21
}

/** Control points of the meridian at u: edge, edge + slope, ring next to the pole, the pole. */
export function meridian(shape: Shape, u: number, eps: number): THREE.Vector3[] {
  const [x, y] = ring(shape, u)
  const r = Math.hypot(x, y)
  const ze = domeH(shape, x, y)
  const n = domeN(shape, x, y)
  // Slope of the dome going inward at the edge: −∇h · r̂.
  const s = (n.x * x + n.y * y) / (r * n.z)
  const apex = apexOf(shape)
  return [
    new THREE.Vector3(x, y, ze),
    new THREE.Vector3(x * (2 / 3), y * (2 / 3), ze + (r / 3) * s),
    new THREE.Vector3(x / 3, y / 3, apex.z - sag(shape, u, eps)),
    apex,
  ]
}

const cubic = (P: THREE.Vector3[], t: number) => {
  const s = 1 - t
  return P[0]
    .clone()
    .multiplyScalar(s * s * s)
    .addScaledVector(P[1], 3 * s * s * t)
    .addScaledVector(P[2], 3 * s * t * t)
    .addScaledVector(P[3], t * t * t)
}

/** The dome as a surface collapsed to a pole: u around, v from the edge (0) to the apex (1). */
export function poleDome(shape: Shape, eps: number): SurfFn {
  return (u, v) => cubic(meridian(shape, u, eps), v)
}

/** The side wall: from the ground up to the dome's edge. */
export function wallGrid(shape: Shape, n = 96): Grid {
  const pos: THREE.Vector3[][] = [[], []]
  const nor: THREE.Vector3[][] = [[], []]
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const [x, y] = ring(shape, u)
    const a = ring(shape, u - 1e-4)
    const b = ring(shape, u + 1e-4)
    const nn = new THREE.Vector3(b[1] - a[1], -(b[0] - a[0]), 0).normalize()
    pos[0].push(new THREE.Vector3(x, y, 0))
    pos[1].push(new THREE.Vector3(x, y, domeH(shape, x, y)))
    nor[0].push(nn)
    nor[1].push(nn.clone())
  }
  return { pos, nor }
}

/** The trimmed four-sided top: rings from the edge in to the centre (for the mesh); the surface itself is the height field. */
export function trimmedTop(shape: Shape, nu = 96, rings = 20): Grid {
  const pos: THREE.Vector3[][] = []
  const nor: THREE.Vector3[][] = []
  for (let r = 0; r <= rings; r++) {
    const k = 1 - Math.pow(1 - r / rings, 1.2)
    const pr: THREE.Vector3[] = []
    const nr: THREE.Vector3[] = []
    for (let i = 0; i <= nu; i++) {
      const [x0, y0] = ring(shape, i / nu)
      const x = x0 * (1 - k)
      const y = y0 * (1 - k)
      pr.push(new THREE.Vector3(x, y, domeH(shape, x, y)))
      nr.push(domeN(shape, x, y))
    }
    pos.push(pr)
    nor.push(nr)
  }
  return { pos, nor }
}

/** The untrimmed four-sided patch the top is cut from. */
export function untrimmedTop(shape: Shape): SurfFn {
  const e = R0 * 1.08
  return (u, v) => {
    const x = -e + 2 * e * u
    const y = -e + 2 * e * v
    return new THREE.Vector3(x, y, domeH(shape, x, y))
  }
}

export function ringPoly(shape: Shape, n = 96): V2[] {
  return Array.from({ length: n }, (_, i) => ring(shape, i / n))
}

// ------------------------------------------------------------------ the corner

export const AX = 26
export const AY = 18
export const AZ = 13
const K = 0.5523
/** Corner of the box the three rounded edges meet at. */
export const CORNER_TOP = new THREE.Vector3(0, 0, AZ)

const toEllipsoid = (w: THREE.Vector3) => new THREE.Vector3(AX * w.x, AY * w.y, AZ * w.z)
export const ellipsoidN = (p: THREE.Vector3) => new THREE.Vector3(p.x / (AX * AX), p.y / (AY * AY), p.z / (AZ * AZ)).normalize()

/**
 * The three-sided patch: meridians from the bottom arc up to the collapsed point. Their third control
 * points (the row next to the point) don't stay in one plane: `sag` lifts the middle of that row, as
 * happens when the patch is lofted through sections to a point.
 */
export function triCorner(sag = 1.4): SurfFn {
  return (u, v) => {
    const th = (u * Math.PI) / 2
    const m0 = new THREE.Vector3(AX * Math.cos(th), AY * Math.sin(th), 0)
    const m1 = m0.clone().add(new THREE.Vector3(0, 0, K * AZ))
    const m2 = new THREE.Vector3(K * m0.x, K * m0.y, AZ - sag * Math.sin(Math.PI * u))
    return cubic([m0, m1, m2, CORNER_TOP.clone()], v)
  }
}

const n3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize()
const W_X = n3(1, 0, 0)
const W_Y = n3(0, 1, 0)
const W_Z = n3(0, 0, 1)
const W_C = n3(1, 1, 1)
const W_XY = n3(1, 1, 0)
const W_YZ = n3(0, 1, 1)
const W_ZX = n3(1, 0, 1)

/** The corner as three four-sided patches meeting at the middle (a point where three patches meet). */
export const SPLIT_QUADS: THREE.Vector3[][] = [
  [W_X, W_XY, W_C, W_ZX],
  [W_Y, W_YZ, W_C, W_XY],
  [W_Z, W_ZX, W_C, W_YZ],
]

export function quadOnCorner(q: THREE.Vector3[]): SurfFn {
  return (u, v) => {
    const a = q[0].clone().multiplyScalar((1 - u) * (1 - v))
    a.addScaledVector(q[1], u * (1 - v))
    a.addScaledVector(q[2], u * v)
    a.addScaledVector(q[3], (1 - u) * v)
    return toEllipsoid(a.normalize())
  }
}

/** One big four-sided patch over the corner (gnomonic coordinates about the diagonal), to be trimmed. */
const E1 = n3(1, -1, 0)
const E2 = n3(1, 1, -2)
export const TRIM_S: [number, number] = [-1.5, 1.5]
export const TRIM_T: [number, number] = [-1.7, 1.0]
export function bigCornerPatch(): SurfFn {
  return (u, v) => {
    const s = TRIM_S[0] + (TRIM_S[1] - TRIM_S[0]) * u
    const t = TRIM_T[0] + (TRIM_T[1] - TRIM_T[0]) * v
    return toEllipsoid(E1.clone().multiplyScalar(s).addScaledVector(E2, t).add(W_C).normalize())
  }
}

/** Isoparms of the big patch, kept where they lie on the corner (x, y, z ≥ 0). */
export function trimmedCornerIsos(n = 7): THREE.Vector3[][] {
  const P = bigCornerPatch()
  const out: THREE.Vector3[][] = []
  const keep = (pts: THREE.Vector3[]) => {
    let cur: THREE.Vector3[] = []
    for (const p of pts) {
      if (p.x >= -1e-6 && p.y >= -1e-6 && p.z >= -1e-6) cur.push(p.clone().addScaledVector(ellipsoidN(p), 0.06))
      else if (cur.length) {
        if (cur.length > 1) out.push(cur)
        cur = []
      }
    }
    if (cur.length > 1) out.push(cur)
  }
  for (let i = 1; i < n; i++) {
    keep(Array.from({ length: 121 }, (_, k) => P(i / n, k / 120)))
    keep(Array.from({ length: 121 }, (_, k) => P(k / 120, i / n)))
  }
  return out
}

/** The box around the corner: the three rounded edges carried on, and the three flat faces. */
export function cornerContext(): { grid: Grid; flat: boolean }[] {
  const L = 22
  const DZ = 16
  const out: { grid: Grid; flat: boolean }[] = []
  const band = (arc: (t: number) => THREE.Vector3, dir: THREE.Vector3, len: number) => {
    const pos: THREE.Vector3[][] = []
    const nor: THREE.Vector3[][] = []
    for (let j = 0; j <= 1; j++) {
      const pr: THREE.Vector3[] = []
      const nr: THREE.Vector3[] = []
      for (let i = 0; i <= 32; i++) {
        const p = arc(i / 32)
        const n = ellipsoidN(p)
        pr.push(p.clone().addScaledVector(dir, len * j))
        nr.push(n)
      }
      pos.push(pr)
      nor.push(nr)
    }
    out.push({ grid: { pos, nor }, flat: false })
  }
  band((t) => new THREE.Vector3(AX * Math.cos((t * Math.PI) / 2), AY * Math.sin((t * Math.PI) / 2), 0), new THREE.Vector3(0, 0, -1), DZ)
  band((t) => new THREE.Vector3(AX * Math.cos((t * Math.PI) / 2), 0, AZ * Math.sin((t * Math.PI) / 2)), new THREE.Vector3(0, -1, 0), L)
  band((t) => new THREE.Vector3(0, AY * Math.cos((t * Math.PI) / 2), AZ * Math.sin((t * Math.PI) / 2)), new THREE.Vector3(-1, 0, 0), L)
  const quad = (o: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, n: THREE.Vector3) => {
    const pos = [
      [o.clone(), o.clone().add(a)],
      [o.clone().add(b), o.clone().add(a).add(b)],
    ]
    out.push({ grid: { pos, nor: pos.map((r) => r.map(() => n.clone())) }, flat: true })
  }
  quad(new THREE.Vector3(AX, 0, 0), new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, 0, -DZ), new THREE.Vector3(1, 0, 0))
  quad(new THREE.Vector3(0, AY, 0), new THREE.Vector3(-L, 0, 0), new THREE.Vector3(0, 0, -DZ), new THREE.Vector3(0, 1, 0))
  quad(new THREE.Vector3(0, 0, AZ), new THREE.Vector3(-L, 0, 0), new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, 0, 1))
  return out
}
