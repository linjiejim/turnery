import * as THREE from "three"
import type { V2 } from "@/three/geom"

/**
 * Procedural styled housings for the 5.6 lessons: a rounded-rectangle plan
 * swept by a section profile, closed by caps. A profile is a list of
 * (d, z) points: d is the inset from the plan outline (positive inwards),
 * z the height. Insets of a rounded rectangle are exact (the corner radius
 * shrinks, then goes sharp), and every inset ring has the same number of
 * points in the same places, so profile points can be swept ring by ring.
 * Normals are analytic; sharp profile corners are duplicated so they stay crisp.
 */
export type Plan = { a: number; b: number; r: number; nA: number; nB: number; nArc: number }

export type Ring = { x: number[]; y: number[]; nx: number[]; ny: number[] }

/** The plan outline inset by d: points and outward normals, counter-clockwise from (+a, 0). */
export function planRing(p: Plan, d: number): Ring {
  const e = Math.max(p.r, d)
  const rr = Math.max(p.r - d, 0)
  const cx = p.a - e
  const cy = p.b - e
  const out: Ring = { x: [], y: [], nx: [], ny: [] }
  const push = (x: number, y: number, nx: number, ny: number) => {
    out.x.push(x)
    out.y.push(y)
    out.nx.push(nx)
    out.ny.push(ny)
  }
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, n: number) => {
    for (let i = 0; i < n; i++) push(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, nx, ny)
  }
  const arc = (ox: number, oy: number, a0: number) => {
    for (let i = 0; i < p.nArc; i++) {
      const a = a0 + ((Math.PI / 2) * i) / p.nArc
      push(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr, Math.cos(a), Math.sin(a))
    }
  }
  const half = Math.max(1, Math.round(p.nB / 2))
  edge(p.a - d, 0, p.a - d, cy, 1, 0, half)
  arc(cx, cy, 0)
  edge(cx, p.b - d, -cx, p.b - d, 0, 1, p.nA)
  arc(-cx, cy, Math.PI / 2)
  edge(-(p.a - d), cy, -(p.a - d), -cy, -1, 0, p.nB)
  arc(-cx, -cy, Math.PI)
  edge(-cx, -(p.b - d), cx, -(p.b - d), 0, -1, p.nA)
  arc(cx, -cy, Math.PI * 1.5)
  edge(p.a - d, -cy, p.a - d, 0, 1, 0, half)
  return out
}

/** A profile vertex with its normal in the section: `no` outward (in plan), `nz` up. */
export type PV = { d: number; z: number; no: number; nz: number; tag?: string }

/**
 * Normals for a profile polyline walked so that the outside is on its right going up / inwards
 * (bottom → side → top for an outer surface). Corners sharper than `crease` degrees are split.
 */
export function withNormals(pts: (V2 | [number, number, string])[], crease = 25): PV[] {
  const seg = (i: number) => {
    const [d0, z0] = pts[i]
    const [d1, z1] = pts[i + 1]
    const l = Math.hypot(d1 - d0, z1 - z0) || 1
    // Tangent (dd, dz) → outward normal (dz, dd) in (outward, up).
    return { no: (z1 - z0) / l, nz: (d1 - d0) / l }
  }
  const out: PV[] = []
  const cos = Math.cos(THREE.MathUtils.degToRad(crease))
  for (let i = 0; i < pts.length; i++) {
    const [d, z, tag] = pts[i] as [number, number, string?]
    const a = i > 0 ? seg(i - 1) : null
    const b = i < pts.length - 1 ? seg(i) : null
    if (a && b && a.no * b.no + a.nz * b.nz < cos) {
      out.push({ d, z, ...a, tag }, { d, z, ...b, tag })
      continue
    }
    const n = a && b ? { no: a.no + b.no, nz: a.nz + b.nz } : (a ?? b)!
    const l = Math.hypot(n.no, n.nz) || 1
    out.push({ d, z, no: n.no / l, nz: n.nz / l, tag })
  }
  return out
}

/** Linear (d, z) between two points, n steps, the end excluded. */
export function segment(a: V2, b: V2, n: number): V2[] {
  const out: V2[] = []
  for (let i = 0; i < n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])
  return out
}

export type Surface = {
  pos: Float32Array
  nor: Float32Array
  /** Columns (ring points) × rows (profile vertices). */
  cols: number
  rows: number
  /** Per vertex: the profile vertex it came from (tags, classification). */
  meta: PV[]
}

/**
 * Sweep: rows[c] is the profile for ring column c (columns may differ, e.g. split at different
 * heights, but must have the same length). `flip` for surfaces facing inward (the inside of a shell).
 */
export function sweep(plan: Plan, rows: PV[][], flip = false): Surface {
  const cols = rows.length
  const k = rows[0].length
  const pos = new Float32Array(cols * k * 3)
  const nor = new Float32Array(cols * k * 3)
  const meta: PV[] = new Array(cols * k)
  const cache = new Map<number, Ring>()
  const ring = (d: number) => {
    const key = Math.round(d * 1000)
    let r = cache.get(key)
    if (!r) {
      r = planRing(plan, d)
      cache.set(key, r)
    }
    return r
  }
  const base = ring(0)
  for (let c = 0; c < cols; c++)
    for (let j = 0; j < k; j++) {
      const v = rows[c][j]
      const r = ring(v.d)
      const i = (c * k + j) * 3
      pos[i] = r.x[c]
      pos[i + 1] = r.y[c]
      pos[i + 2] = v.z
      const s = flip ? -1 : 1
      nor[i] = s * v.no * base.nx[c]
      nor[i + 1] = s * v.no * base.ny[c]
      nor[i + 2] = s * v.nz
      meta[c * k + j] = v
    }
  return { pos, nor, cols, rows: k, meta }
}

/** Triangles of a swept or capped grid (columns wrap around). */
export function gridIndex(cols: number, rows: number, flip = false) {
  const idx: number[] = []
  for (let c = 0; c < cols; c++) {
    const c1 = (c + 1) % cols
    for (let j = 0; j < rows - 1; j++) {
      const a = c * rows + j
      const b = c1 * rows + j
      const cc = c1 * rows + j + 1
      const d = c * rows + j + 1
      if (flip) idx.push(a, cc, b, a, d, cc)
      else idx.push(a, b, cc, a, cc, d)
    }
  }
  return idx
}

/**
 * A cap filling the plan inside inset d0: rings inset further and further in, to the middle.
 * z(x, y) gives its height (flat or with a bump); normals come from its slope. `down` for a cap facing −Z.
 */
export function cap(plan: Plan, d0: number, z: (x: number, y: number) => number, steps = 14, down = false): Surface {
  const dEnd = Math.min(plan.a, plan.b)
  const rings: Ring[] = []
  for (let j = 0; j <= steps; j++) rings.push(planRing(plan, d0 + ((dEnd - d0) * j) / steps))
  const cols = rings[0].x.length
  const k = rings.length
  const pos = new Float32Array(cols * k * 3)
  const nor = new Float32Array(cols * k * 3)
  const meta: PV[] = new Array(cols * k)
  const h = 0.05
  for (let c = 0; c < cols; c++)
    for (let j = 0; j < k; j++) {
      const x = rings[j].x[c]
      const y = rings[j].y[c]
      const zz = z(x, y)
      const gx = (z(x + h, y) - z(x - h, y)) / (2 * h)
      const gy = (z(x, y + h) - z(x, y - h)) / (2 * h)
      const n = new THREE.Vector3(-gx, -gy, 1).normalize()
      if (down) n.negate()
      const i = (c * k + j) * 3
      pos.set([x, y, zz], i)
      nor.set([n.x, n.y, n.z], i)
      meta[c * k + j] = { d: d0, z: zz, no: 0, nz: n.z, tag: "cap" }
    }
  return { pos, nor, cols, rows: k, meta }
}

/** One BufferGeometry from several surfaces (each with its own winding), plus an empty colour attribute. */
export function merge(parts: { s: Surface; flip: boolean }[]) {
  let n = 0
  for (const p of parts) n += p.s.cols * p.s.rows
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const idx: number[] = []
  const meta: PV[] = []
  let off = 0
  for (const p of parts) {
    pos.set(p.s.pos, off * 3)
    nor.set(p.s.nor, off * 3)
    for (const i of gridIndex(p.s.cols, p.s.rows, p.flip)) idx.push(i + off)
    meta.push(...p.s.meta)
    off += p.s.cols * p.s.rows
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3))
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  g.setIndex(idx)
  return { geo: g, meta }
}

/**
 * Studio material: a long softbox reflected in the surface (a highlight band runs along
 * the shoulder radius), a dark floor below, and the vertex colour's red channel as ambient occlusion
 * (a recessed groove sits in shadow). Colours come from the theme on every render.
 */
export function studioMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uBase: { value: new THREE.Color() }, uLight: { value: new THREE.Color() }, uDark: { value: new THREE.Color() } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vN;
      varying vec3 vP;
      varying float vAo;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vP = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vAo = color.r;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uLight;
      uniform vec3 uDark;
      varying vec3 vN;
      varying vec3 vP;
      varying float vAo;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vP - cameraPosition);
        // The softbox hangs above and behind the viewer: only faces turned toward the eye and up
        // (a shoulder radius) catch it, wherever the view is; a flat top reflects past it.
        vec3 rv = normalize((viewMatrix * vec4(reflect(v, n), 0.0)).xyz);
        float box = smoothstep(0.42, 0.55, rv.y) * (1.0 - smoothstep(0.82, 0.94, rv.y)) * smoothstep(0.05, 0.25, rv.z);
        float sky = smoothstep(-0.5, 0.4, rv.y);
        float diff = clamp(dot(n, normalize(vec3(-0.35, -0.55, 1.0))), 0.0, 1.0);
        vec3 col = uBase * (0.5 + 0.42 * diff);
        col = mix(uDark, col, 0.55 + 0.45 * sky);
        col = mix(col, uLight, box * 0.85);
        col = mix(uDark, col, vAo);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}
