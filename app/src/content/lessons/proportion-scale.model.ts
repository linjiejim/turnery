/**
 * Model for 6.1.4 「比例、体块与尺度」: an electric kettle built from masses.
 * Primary: the body (a truncated cone). Secondary: the power base, the lid
 * dome, the handle loop, the spout. Tertiary: the lid knob and the switch.
 *
 * Everything is in millimetres at the product's real size: the design is
 * drawn at a reference size and multiplied by `scale`; with `humanHandle`
 * the handle keeps its own size (it's sized by the hand, not the product).
 *
 * The visual centre of mass is the centroid of the front silhouette
 * (the XZ outline), found by sampling it on a grid; dark parts can count
 * extra (an assumption: dark things are judged heavier, see the lesson).
 * The tipping angle treats that silhouette as a thin, even plate standing
 * on the base: how far it can lean before its centroid passes the base edge.
 */
export type Kettle = {
  bodyH: number
  bodyD: number
  /** Top diameter / bottom diameter of the body. */
  taper: number
  baseH: number
  lidH: number
  /** Handle size factor (span and reach). */
  handle: number
  /** Spout size factor (0 = no spout). */
  spout: number
  /** Overall size factor. */
  scale: number
  humanHandle: boolean
  darkHeavy: boolean
}

export const DESIGN: Kettle = { bodyH: 170, bodyD: 160, taper: 0.82, baseH: 14, lidH: 14, handle: 1, spout: 0.8, scale: 1, humanHandle: false, darkHeavy: true }

/** Weight of dark parts in the visual centroid (an assumption, shown in the lesson). */
export const DARK_WEIGHT = 1.5
/** The reference hand's breadth across four fingers, mm (adult means are roughly 75–90 mm). */
export const HAND_BREADTH = 85
const GRIP = 8
const KNOB = { r: 8, h: 11 }

export type Level = 1 | 2 | 3
export type Part = "base" | "body" | "lid" | "knob" | "handle" | "spout" | "switch"
export const LEVEL: Record<Part, Level> = { body: 1, base: 2, lid: 2, handle: 2, spout: 2, knob: 3, switch: 3 }
export const DARK: Record<Part, boolean> = { base: true, knob: true, body: false, lid: false, handle: false, spout: false, switch: false }

export type Layout = {
  k: number
  /** Base radius, body bottom / top radius. */
  rb: number
  r0: number
  r1: number
  zb: number
  zt: number
  lidH: number
  knob: { r: number; z0: number; z1: number }
  /** Handle centreline (x, z), grip half-thickness. */
  handle: [number, number][]
  grip: number
  /** Handle's clear opening for the fingers, mm. */
  opening: number
  /** Spout as a quad in the XZ plane (root top, root bottom, tip bottom, tip top), and its axis for 3D. */
  spout: [number, number][] | null
  spoutAxis: { from: [number, number]; to: [number, number]; r0: number; r1: number } | null
  /** The product's own height (to the top of the knob), and the top of everything (a hand-sized handle may stand above it). */
  height: number
  top: number
  width: number
  /** Left and right ends of the outline (spout tip, handle back). */
  xMin: number
  xMax: number
}

export function layout(p: Kettle): Layout {
  const k = p.scale
  const r0 = (p.bodyD / 2) * k
  const r1 = r0 * p.taper
  const rb = r0 * 1.04
  const zb = p.baseH * k
  const zt = zb + p.bodyH * k
  const lidH = p.lidH * k
  const knob = { r: KNOB.r * k, z0: zt + lidH - 2 * k, z1: zt + lidH + KNOB.h * k }
  const rAt = (z: number) => r0 + ((r1 - r0) * (z - zb)) / (zt - zb)

  // Handle: a D loop on +X. Sized by the product, or by the hand.
  const hk = p.humanHandle ? 1 : k
  const span = 0.62 * DESIGN.bodyH * p.handle * hk
  const reach = 46 * p.handle * hk
  const grip = GRIP * hk
  let zTop = zt - 0.1 * p.bodyH * k
  const zLow = Math.max(grip + 2, zTop - span)
  // A hand-sized handle keeps its span even if the product is too small for it.
  if (p.humanHandle) zTop = Math.max(zTop, zLow + span)
  const xT = rAt(Math.min(zTop, zt)) - grip * 0.3
  const xL = rAt(Math.max(zb, Math.min(zLow, zt))) - grip * 0.3
  const out = Math.max(xT, xL) + reach
  // Where the top of the handle meets the body (below the rim, even when a hand-sized loop stands above it).
  const zAttach = Math.min(zTop, zt - 0.05 * p.bodyH * k)
  const handle: [number, number][] = [
    [xT, zAttach],
    [xT + reach * 0.55, zTop + grip * 0.6],
    [out, zTop - (zTop - zLow) * 0.22],
    [out, zLow + (zTop - zLow) * 0.25],
    [xL + reach * 0.5, zLow - grip * 0.4],
    [xL, zLow],
  ]
  const opening = zTop - zLow - 2 * grip

  // Spout: a cone on −X near the top, leaning out at 40°.
  let spout: [number, number][] | null = null
  let spoutAxis: Layout["spoutAxis"] = null
  if (p.spout > 0.05) {
    const len = 46 * p.spout * k
    const rr0 = 13 * p.spout * k
    const rr1 = 5 * p.spout * k
    const zr = zt - 34 * k
    const from: [number, number] = [-rAt(zr) + rr0 * 0.6, zr]
    const a = (40 * Math.PI) / 180
    const dir: [number, number] = [-Math.cos(a), Math.sin(a)]
    const nrm: [number, number] = [dir[1], -dir[0]]
    const to: [number, number] = [from[0] + dir[0] * len, from[1] + dir[1] * len]
    spout = [
      [from[0] - nrm[0] * rr0, from[1] - nrm[1] * rr0],
      [from[0] + nrm[0] * rr0, from[1] + nrm[1] * rr0],
      [to[0] + nrm[0] * rr1, to[1] + nrm[1] * rr1],
      [to[0] - nrm[0] * rr1, to[1] - nrm[1] * rr1],
    ]
    spoutAxis = { from, to, r0: rr0, r1: rr1 }
  }
  const xs = [-rb, rb, -r0, r0, out + grip, ...(spout ? spout.map((q) => q[0]) : [])]
  const zs = [knob.z1, zTop + grip * 1.6]
  return {
    k,
    rb,
    r0,
    r1,
    zb,
    zt,
    lidH,
    knob,
    handle,
    grip,
    opening,
    spout,
    spoutAxis,
    height: knob.z1,
    top: Math.max(...zs),
    width: Math.max(...xs) - Math.min(...xs),
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
  }
}

// ------------------------------------------------------------------ silhouette

function inPoly(x: number, z: number, poly: [number, number][]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

function distToPolyline(x: number, z: number, pts: [number, number][]) {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz))
  }
  return best
}

/** A smooth handle centreline from the six control points (Catmull–Rom, sampled). */
export function handleCurve(pts: [number, number][], n = 48): [number, number][] {
  const out: [number, number][] = []
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]
  for (let s = 0; s < pts.length - 1; s++) {
    for (let k = 0; k < n / (pts.length - 1); k++) {
      const t = k / (n / (pts.length - 1))
      const [p0, p1, p2, p3] = [P(s - 1), P(s), P(s + 1), P(s + 2)]
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Which part covers a point of the front silhouette (front-most first), or null. */
function partAt(L: Layout, curve: [number, number][], x: number, z: number): Part | null {
  if (z >= L.knob.z0 && z <= L.knob.z1 && Math.abs(x) <= L.knob.r) return "knob"
  if (z >= L.zt && z <= L.zt + L.lidH) {
    const u = x / L.r1
    const v = (z - L.zt) / L.lidH
    if (u * u + v * v <= 1) return "lid"
  }
  if (z >= L.zb && z <= L.zt) {
    const r = L.r0 + ((L.r1 - L.r0) * (z - L.zb)) / (L.zt - L.zb)
    if (Math.abs(x) <= r) return "body"
  }
  if (z >= 0 && z <= L.zb && Math.abs(x) <= L.rb) return "base"
  if (L.spout && inPoly(x, z, L.spout)) return "spout"
  if (x > 0 && distToPolyline(x, z, curve) <= L.grip) return "handle"
  return null
}

export type Measure = {
  /** Visual centroid (x, z), mm. */
  cx: number
  cz: number
  /** Centroid height as a share of the total height. */
  czShare: number
  /** Silhouette area share by level. */
  share: Record<Level, number>
  /** How far the silhouette plate can lean either way before tipping, degrees. */
  tipHandle: number
  tipSpout: number
  height: number
  width: number
  baseD: number
  opening: number
}

export function measure(p: Kettle): Measure {
  const L = layout(p)
  const curve = handleCurve(L.handle)
  const xs: number[] = [-L.rb, L.rb, ...curve.map((q) => q[0] + L.grip), ...(L.spout ? L.spout.map((q) => q[0]) : [])]
  const x0 = Math.min(...xs) - 1
  const x1 = Math.max(...xs) + 1
  const z1 = Math.max(L.top, ...curve.map((q) => q[1] + L.grip)) + 1
  const cell = Math.max(z1, x1 - x0) / 180
  let w = 0
  let mx = 0
  let mz = 0
  const area: Record<Level, number> = { 1: 0, 2: 0, 3: 0 }
  for (let z = cell / 2; z < z1; z += cell)
    for (let x = x0 + cell / 2; x < x1; x += cell) {
      const part = partAt(L, curve, x, z)
      if (!part) continue
      const wt = p.darkHeavy && DARK[part] ? DARK_WEIGHT : 1
      w += wt
      mx += wt * x
      mz += wt * z
      area[LEVEL[part]] += 1
    }
  const total = area[1] + area[2] + area[3] || 1
  const cx = mx / (w || 1)
  const cz = mz / (w || 1)
  const deg = (v: number) => (Math.atan2(v, cz) * 180) / Math.PI
  return {
    cx,
    cz,
    czShare: cz / L.height,
    share: { 1: area[1] / total, 2: area[2] / total, 3: area[3] / total },
    tipHandle: deg(L.rb - cx),
    tipSpout: deg(L.rb + cx),
    height: L.height,
    width: L.width,
    baseD: 2 * L.rb,
    opening: L.opening,
  }
}
