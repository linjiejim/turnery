import * as THREE from "three"

/**
 * A part built from axis-aligned boxes, meshed as small square cells on its
 * outside, and an undercut test by line of sight: a face that leans towards
 * one mould half has to see out along that half's pull direction, without
 * the part itself in the way. A face neither half can see out of is an
 * undercut. The test runs per cell against the boxes (a slab test each), so
 * turning the pull direction recolours the part live.
 */
export type Box = { min: [number, number, number]; max: [number, number, number]; tag: string }

export type Cell = {
  /** Centre and outward normal. */
  p: THREE.Vector3
  n: THREE.Vector3
  /** Four corners, counter-clockwise seen from outside. */
  q: THREE.Vector3[]
  tag: string
  area: number
}

export type Release = "cavity" | "core" | "side" | "under"

const EPS = 1e-6

function inside(p: THREE.Vector3, b: Box) {
  return (
    p.x > b.min[0] + EPS && p.x < b.max[0] - EPS && p.y > b.min[1] + EPS && p.y < b.max[1] - EPS && p.z > b.min[2] + EPS && p.z < b.max[2] - EPS
  )
}

/** Every box boundary on one axis inside [lo, hi], with long intervals cut to at most `max`. */
function breaks(lo: number, hi: number, boxes: Box[], axis: number, max: number) {
  const set = new Set<number>([lo, hi])
  for (const b of boxes) for (const v of [b.min[axis], b.max[axis]]) if (v > lo + EPS && v < hi - EPS) set.add(v)
  const sorted = [...set].sort((a, b) => a - b)
  const out: number[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]
    const b = sorted[i]
    const n = Math.max(1, Math.ceil((b - a) / max - 1e-9))
    for (let k = 1; k <= n; k++) out.push(a + ((b - a) * k) / n)
  }
  return out
}

/** The outside of the union of boxes, as cells no larger than `maxCell` mm. */
export function cellsOf(boxes: Box[], maxCell = 3): Cell[] {
  const out: Cell[] = []
  const seen = new Set<string>()
  const probe = new THREE.Vector3()
  for (const b of boxes) {
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3
      const v = (axis + 2) % 3
      const us = breaks(b.min[u], b.max[u], boxes, u, maxCell)
      const vs = breaks(b.min[v], b.max[v], boxes, v, maxCell)
      for (const sign of [-1, 1]) {
        const w = sign > 0 ? b.max[axis] : b.min[axis]
        const n = new THREE.Vector3()
        n.setComponent(axis, sign)
        for (let i = 0; i < us.length - 1; i++)
          for (let j = 0; j < vs.length - 1; j++) {
            const c = new THREE.Vector3()
            c.setComponent(axis, w)
            c.setComponent(u, (us[i] + us[i + 1]) / 2)
            c.setComponent(v, (vs[j] + vs[j + 1]) / 2)
            probe.copy(c).addScaledVector(n, 1e-3)
            if (boxes.some((o) => inside(probe, o))) continue
            const key = `${axis}${sign}|${c.x.toFixed(3)}|${c.y.toFixed(3)}|${c.z.toFixed(3)}`
            if (seen.has(key)) continue
            seen.add(key)
            const corner = (a: number, bb: number) => {
              const p = new THREE.Vector3()
              p.setComponent(axis, w)
              p.setComponent(u, a)
              p.setComponent(v, bb)
              return p
            }
            const q = [corner(us[i], vs[j]), corner(us[i + 1], vs[j]), corner(us[i + 1], vs[j + 1]), corner(us[i], vs[j + 1])]
            out.push({ p: c, n, q: sign > 0 ? q : q.reverse(), tag: b.tag, area: (us[i + 1] - us[i]) * (vs[j + 1] - vs[j]) })
          }
      }
    }
  }
  return out
}

/** The nearest box a ray from o along d hits (beyond a hair's breadth), or null. */
export function blocker(o: THREE.Vector3, d: THREE.Vector3, boxes: Box[]): Box | null {
  let best: Box | null = null
  let bestT = Infinity
  for (const b of boxes) {
    let t0 = 1e-4
    let t1 = Infinity
    let hit = true
    for (let k = 0; k < 3; k++) {
      const ok = o.getComponent(k)
      const dk = d.getComponent(k)
      if (Math.abs(dk) < 1e-12) {
        if (ok <= b.min[k] + EPS || ok >= b.max[k] - EPS) {
          hit = false
          break
        }
        continue
      }
      let a = (b.min[k] - ok) / dk
      let c = (b.max[k] - ok) / dk
      if (a > c) [a, c] = [c, a]
      t0 = Math.max(t0, a)
      t1 = Math.min(t1, c)
      if (t0 > t1 - 1e-9) {
        hit = false
        break
      }
    }
    if (hit && t0 < bestT) {
      bestT = t0
      best = b
    }
  }
  return best
}

/**
 * Which half releases a cell for pull direction `d` (the cavity moves along +d, the core along −d),
 * and, for an undercut, the box in the way. A face parallel to the pull (within `side`) slides along
 * it: zero draft, but not an undercut; the faces that catch are the ones facing a half that can't get out.
 */
export function release(c: Cell, d: THREE.Vector3, boxes: Box[], side = 1e-3): { r: Release; by: Box | null } {
  const k = c.n.dot(d)
  const o = c.p.clone().addScaledVector(c.n, 0.01)
  if (Math.abs(k) <= side) return { r: "side", by: null }
  const by = blocker(o, k > 0 ? d : d.clone().negate(), boxes)
  return { r: by ? "under" : k > 0 ? "cavity" : "core", by }
}

/** Two triangles per cell; `color` is filled by the caller. */
export function cellGeometry(cells: Cell[]) {
  const pos = new Float32Array(cells.length * 18)
  const nor = new Float32Array(cells.length * 18)
  cells.forEach((c, i) => {
    const [a, b, cc, d] = c.q
    const tri = [a, b, cc, a, cc, d]
    tri.forEach((p, j) => {
      pos.set([p.x, p.y, p.z], i * 18 + j * 3)
      nor.set([c.n.x, c.n.y, c.n.z], i * 18 + j * 3)
    })
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3))
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cells.length * 18), 3))
  return g
}

/** Paint each cell's six vertices. */
export function paintCells(g: THREE.BufferGeometry, colours: THREE.Color[]) {
  const attr = g.getAttribute("color") as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  colours.forEach((c, i) => {
    for (let j = 0; j < 6; j++) arr.set([c.r, c.g, c.b], i * 18 + j * 3)
  })
  attr.needsUpdate = true
}

/** A box as a plain mesh geometry (mould steel, mechanisms). */
export function boxGeometry(b: { min: [number, number, number]; max: [number, number, number] }) {
  const g = new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
  g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2)
  return g
}

/** Unit pull direction from a tilt away from +Z and a heading in the XY plane (degrees). */
export function pullDir(tilt: number, heading: number) {
  const t = THREE.MathUtils.degToRad(tilt)
  const h = THREE.MathUtils.degToRad(heading)
  return new THREE.Vector3(Math.sin(t) * Math.cos(h), Math.sin(t) * Math.sin(h), Math.cos(t))
}
