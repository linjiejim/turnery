import * as THREE from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { SceneTokens } from "@/three/tokens"
import type { Viewer } from "@/three/viewer"

/**
 * Surface maths shared by the T5 surface lessons (由曲线生成曲面, 曲面连续性与匹配,
 * 曲率分析, 修剪与缝合): clamped B-spline curves and tensor-product patches,
 * global interpolation (for lofts), curvature from finite differences of any
 * parametric surface, tessellation with normals and per-vertex colours,
 * isoparm polylines, a zebra-stripe material (copied from zebra-stripes.scene.ts)
 * and a diverging colour map built from the scene tokens.
 *
 * Conventions: parameters run 0…1. A patch's net is net[i][j], i along u, j along v.
 */

export type Surf = (u: number, v: number) => THREE.Vector3

// ------------------------------------------------------------------ B-splines

/** Clamped uniform knot vector for `n` control points of degree `p`. */
export function clampedKnots(n: number, p: number): number[] {
  const inner = n - p - 1
  const U: number[] = []
  for (let i = 0; i <= p; i++) U.push(0)
  for (let i = 1; i <= inner; i++) U.push(i / (inner + 1))
  for (let i = 0; i <= p; i++) U.push(1)
  return U
}

function findSpan(n: number, p: number, t: number, U: number[]) {
  if (t >= U[n + 1]) return n
  if (t <= U[p]) return p
  let lo = p
  let hi = n + 1
  let mid = (lo + hi) >> 1
  while (t < U[mid] || t >= U[mid + 1]) {
    if (t < U[mid]) hi = mid
    else lo = mid
    mid = (lo + hi) >> 1
  }
  return mid
}

/** Non-zero basis functions N[span−p … span] at t (Piegl & Tiller A2.2). */
function basisFuns(span: number, t: number, p: number, U: number[]) {
  const N = [1]
  const left: number[] = []
  const right: number[] = []
  for (let j = 1; j <= p; j++) {
    left[j] = t - U[span + 1 - j]
    right[j] = U[span + j] - t
    let saved = 0
    for (let r = 0; r < j; r++) {
      const tmp = N[r] / (right[r + 1] + left[j - r] || 1e-12)
      N[r] = saved + right[r + 1] * tmp
      saved = left[j - r] * tmp
    }
    N[j] = saved
  }
  return N
}

/** All n basis values at t (zeros outside the span): handy for small dense systems. */
function basisRow(n: number, p: number, t: number, U: number[]) {
  const row = new Array<number>(n).fill(0)
  const span = findSpan(n - 1, p, t, U)
  const N = basisFuns(span, t, p, U)
  for (let k = 0; k <= p; k++) row[span - p + k] = N[k]
  return row
}

export function curvePoint(P: THREE.Vector3[], p: number, U: number[], t: number, out = new THREE.Vector3()) {
  const n = P.length - 1
  const span = findSpan(n, p, t, U)
  const N = basisFuns(span, t, p, U)
  out.set(0, 0, 0)
  for (let k = 0; k <= p; k++) out.addScaledVector(P[span - p + k], N[k])
  return out
}

/** Samples a clamped uniform B-spline (degree min(p, n−1)) through its control polygon. */
export function sampleCurve(P: THREE.Vector3[], p: number, n = 48) {
  const deg = Math.min(p, P.length - 1)
  const U = clampedKnots(P.length, deg)
  return Array.from({ length: n + 1 }, (_, i) => curvePoint(P, deg, U, i / n))
}

/** Gaussian elimination with partial pivoting; solves A X = B for several right-hand sides (3D points). */
function solve(A: number[][], B: THREE.Vector3[][]): THREE.Vector3[][] {
  const n = A.length
  const M = A.map((r) => [...r])
  const R = B.map((col) => col.map((p) => p.clone()))
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    ;[M[c], M[piv]] = [M[piv], M[c]]
    for (const col of R) [col[c], col[piv]] = [col[piv], col[c]]
    const d = M[c][c] || 1e-12
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / d
      if (!f) continue
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k]
      for (const col of R) col[r].addScaledVector(col[c], -f)
    }
  }
  for (let r = 0; r < n; r++) for (const col of R) col[r].divideScalar(M[r][r] || 1e-12)
  return R
}

/**
 * Global interpolation of several point rows with one shared parametrisation (Piegl & Tiller A9.1,
 * the way a loft interpolates its sections): rows[k][i] is point i of row k. Parameters by
 * averaged chord length (or uniform), knots by averaging. Returns control points per row.
 */
export function interpolateRows(rows: THREE.Vector3[][], p: number, param: "chord" | "uniform" = "chord") {
  const n = rows[0].length
  const deg = Math.min(p, n - 1)
  const t: number[] = [0]
  if (param === "uniform") for (let i = 1; i < n; i++) t.push(i / (n - 1))
  else {
    const d = new Array<number>(n).fill(0)
    for (const r of rows) {
      let total = 0
      const seg: number[] = []
      for (let i = 1; i < n; i++) {
        seg.push(r[i].distanceTo(r[i - 1]))
        total += seg[i - 1]
      }
      for (let i = 1; i < n; i++) d[i] += total > 1e-9 ? seg[i - 1] / total : 1 / (n - 1)
    }
    let acc = 0
    for (let i = 1; i < n; i++) {
      acc += d[i] / rows.length
      t.push(acc)
    }
    t[n - 1] = 1
  }
  const U: number[] = []
  for (let i = 0; i <= deg; i++) U.push(0)
  for (let j = 1; j < n - deg; j++) {
    let s = 0
    for (let i = j; i < j + deg; i++) s += t[i]
    U.push(s / deg)
  }
  for (let i = 0; i <= deg; i++) U.push(1)
  const A = t.map((tk) => basisRow(n, deg, tk, U))
  return { P: solve(A, rows), U, p: deg, t }
}

// ------------------------------------------------------------------ patches

export type Patch = { net: THREE.Vector3[][]; pu: number; pv: number; ku: number[]; kv: number[] }

/** A Bézier patch: one span each way, degrees from the net's size. */
export function bezierPatch(net: THREE.Vector3[][]): Patch {
  const pu = net.length - 1
  const pv = net[0].length - 1
  return { net, pu, pv, ku: clampedKnots(net.length, pu), kv: clampedKnots(net[0].length, pv) }
}

export function patchPoint(P: Patch, u: number, v: number, out = new THREE.Vector3()) {
  const nu = P.net.length - 1
  const nv = P.net[0].length - 1
  const su = findSpan(nu, P.pu, u, P.ku)
  const sv = findSpan(nv, P.pv, v, P.kv)
  const Nu = basisFuns(su, u, P.pu, P.ku)
  const Nv = basisFuns(sv, v, P.pv, P.kv)
  out.set(0, 0, 0)
  for (let a = 0; a <= P.pu; a++) {
    const row = P.net[su - P.pu + a]
    for (let b = 0; b <= P.pv; b++) out.addScaledVector(row[sv - P.pv + b], Nu[a] * Nv[b])
  }
  return out
}

export const patchSurf =
  (P: Patch): Surf =>
  (u, v) =>
    patchPoint(P, u, v)

/** Distinct interior and end knots each way: where the isoparms (structure lines) of a patch sit. */
export function patchKnots(P: Patch) {
  const uniq = (U: number[]) => [...new Set(U.map((k) => Math.round(k * 1e6) / 1e6))]
  return { us: uniq(P.ku), vs: uniq(P.kv) }
}

/**
 * Loft through sections given as control polygons with the same point count (a clamped uniform
 * B-spline of degree `pv` each): every column of control points is interpolated across the
 * sections. The sections' order and direction are used as given, as a loft does.
 */
export function loftPatch(sections: THREE.Vector3[][], pv = 3, pu = 3, param: "chord" | "uniform" = "chord"): Patch {
  const m = sections[0].length
  const cols = Array.from({ length: m }, (_, j) => sections.map((s) => s[j]))
  const r = interpolateRows(cols, pu, param)
  const net = sections.map((_, i) => r.P.map((col) => col[i]))
  const deg = Math.min(pv, m - 1)
  return { net, pu: r.p, pv: deg, ku: r.U, kv: clampedKnots(m, deg) }
}

// ------------------------------------------------------------------ differential geometry

export type Derivs = { p: THREE.Vector3; su: THREE.Vector3; sv: THREE.Vector3; suu: THREE.Vector3; suv: THREE.Vector3; svv: THREE.Vector3 }

/** Partial derivatives by central differences; near the border the stencil shifts inside. */
export function derivs(S: Surf, u: number, v: number, h = 1e-3): Derivs {
  const uc = Math.min(1 - h, Math.max(h, u))
  const vc = Math.min(1 - h, Math.max(h, v))
  const p = S(u, v)
  const c = S(uc, vc)
  const up = S(uc + h, vc)
  const um = S(uc - h, vc)
  const vp = S(uc, vc + h)
  const vm = S(uc, vc - h)
  const su = up.clone().sub(um).divideScalar(2 * h)
  const sv = vp.clone().sub(vm).divideScalar(2 * h)
  const suu = up.clone().add(um).addScaledVector(c, -2).divideScalar(h * h)
  const svv = vp.clone().add(vm).addScaledVector(c, -2).divideScalar(h * h)
  const suv = S(uc + h, vc + h)
    .sub(S(uc + h, vc - h))
    .sub(S(uc - h, vc + h))
    .add(S(uc - h, vc - h))
    .divideScalar(4 * h * h)
  return { p, su, sv, suu, suv, svv }
}

export type Curvature = {
  /** Unit normal su × sv. */
  n: THREE.Vector3
  /** Gaussian curvature k1·k2, 1/mm². */
  K: number
  /** Mean curvature (k1 + k2) / 2, 1/mm. */
  H: number
  k1: number
  k2: number
  /** Principal directions (unit, in space) for k1 and k2. */
  d1: THREE.Vector3
  d2: THREE.Vector3
}

/**
 * Curvatures at a point. Sign convention: positive where the surface bends away from its normal
 * (convex seen from the side the normal points to), so a dome with its normal up is positive.
 * Gaussian curvature doesn't depend on the convention.
 */
export function curvature(d: Derivs): Curvature {
  const n = d.su.clone().cross(d.sv)
  const len = n.length() || 1e-12
  n.divideScalar(len)
  const E = d.su.dot(d.su)
  const F = d.su.dot(d.sv)
  const G = d.sv.dot(d.sv)
  // Second fundamental form with the sign flipped, so convex = positive.
  const L = -d.suu.dot(n)
  const M = -d.suv.dot(n)
  const N = -d.svv.dot(n)
  const den = E * G - F * F || 1e-12
  const K = (L * N - M * M) / den
  const H = (E * N - 2 * F * M + G * L) / (2 * den)
  const disc = Math.sqrt(Math.max(0, H * H - K))
  const k1 = H + disc
  const k2 = H - disc
  const dir = (k: number) => {
    // (L − kE) du + (M − kF) dv = 0, or (M − kF) du + (N − kG) dv = 0: take the better-conditioned row.
    const a1 = L - k * E
    const b1 = M - k * F
    const a2 = M - k * F
    const b2 = N - k * G
    let du: number
    let dv: number
    if (Math.abs(a1) + Math.abs(b1) > Math.abs(a2) + Math.abs(b2)) [du, dv] = [-b1, a1]
    else [du, dv] = [-b2, a2]
    if (Math.abs(du) + Math.abs(dv) < 1e-12) [du, dv] = [1, 0]
    return d.su.clone().multiplyScalar(du).addScaledVector(d.sv, dv).normalize()
  }
  const d1 = dir(k1)
  let d2 = dir(k2)
  // At an umbilic both rows vanish: any pair of perpendicular tangents will do.
  if (Math.abs(d1.dot(d2)) > 0.9) d2 = n.clone().cross(d1).normalize()
  return { n, K, H, k1, k2, d1, d2 }
}

// ------------------------------------------------------------------ tessellation

export type Tess = {
  geo: THREE.BufferGeometry
  /** Grid points, index j * (nu + 1) + i. */
  pts: THREE.Vector3[]
  nu: number
  nv: number
}

/**
 * Tessellate S over [0,1]² as an (nu × nv) grid with normals from the surface (su × sv, or flipped).
 * `colour` (optional) fills a per-vertex colour attribute; give it the grid point and its (u, v).
 */
export function tessellate(S: Surf, nu: number, nv: number, opts: { flip?: boolean; colour?: (u: number, v: number, p: THREE.Vector3, out: THREE.Color) => void } = {}): Tess {
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const uvs: number[] = []
  const pts: THREE.Vector3[] = []
  const c = new THREE.Color()
  const h = 1e-3
  for (let j = 0; j <= nv; j++) {
    const v = j / nv
    for (let i = 0; i <= nu; i++) {
      const u = i / nu
      const p = S(u, v)
      pts.push(p)
      pos.push(p.x, p.y, p.z)
      uvs.push(u, v)
      const u0 = Math.max(0, u - h)
      const u1 = Math.min(1, u + h)
      const v0 = Math.max(0, v - h)
      const v1 = Math.min(1, v + h)
      const su = S(u1, v).sub(S(u0, v))
      const sv = S(u, v1).sub(S(u, v0))
      const n = su.cross(sv)
      // A collapsed edge (a pole): take the normal from just inside.
      if (n.lengthSq() < 1e-16) {
        const vi = v < 0.5 ? v + 0.02 : v - 0.02
        const ui = u < 0.5 ? u + 0.02 : u - 0.02
        n.copy(S(u1, vi).sub(S(u0, vi)).cross(S(ui, v1).sub(S(ui, v0))))
        if (n.lengthSq() < 1e-16) n.set(0, 0, 1)
      }
      n.normalize()
      if (opts.flip) n.negate()
      nor.push(n.x, n.y, n.z)
      if (opts.colour) {
        opts.colour(u, v, p, c)
        col.push(c.r, c.g, c.b)
      }
    }
  }
  const idx: number[] = []
  const row = nu + 1
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * row + i
      if (opts.flip) idx.push(a, a + row + 1, a + 1, a, a + row, a + row + 1)
      else idx.push(a, a + 1, a + row + 1, a, a + row + 1, a + row)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  if (opts.colour) geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  return { geo, pts, nu, nv }
}

/** A line of constant u (running along v), or of constant v. */
export function isoU(S: Surf, u: number, n = 48) {
  return Array.from({ length: n + 1 }, (_, j) => S(u, j / n))
}
export function isoV(S: Surf, v: number, n = 48) {
  return Array.from({ length: n + 1 }, (_, i) => S(i / n, v))
}

/** The four boundary curves of S as one closed loop. */
export function boundary(S: Surf, n = 48) {
  return [...isoV(S, 0, n), ...isoU(S, 1, n).slice(1), ...isoV(S, 1, n).reverse().slice(1), ...isoU(S, 0, n).reverse().slice(1)]
}

// ------------------------------------------------------------------ materials

/** Double-sided surface material (open surfaces are seen from both sides), coloured in render(). */
export function surfaceMaterial(vertexColors = false) {
  return new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    vertexColors,
    roughness: 0.55,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
}

/** A thick screen-space line material in a colour of our own; keep its resolution in step with the view. */
export function lineMaterial(v: Viewer, width = 2.4, dashed = false) {
  const m = new LineMaterial({ linewidth: width, worldUnits: false, dashed, dashSize: 3, gapSize: 2 })
  m.resolution.set(v.size.w, v.size.h)
  return m
}

/** Keep LineMaterials' resolution in step with the viewport (returns a cleanup for own()). */
export function trackResolution(v: Viewer, mats: LineMaterial[]) {
  return v.onFrame(() => {
    let changed = false
    for (const m of mats)
      if (m.resolution.x !== v.size.w || m.resolution.y !== v.size.h) {
        m.resolution.set(v.size.w, v.size.h)
        changed = true
      }
    return changed
  })
}

const ZEBRA_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

/** Stripes from the reflected view direction: a row of parallel light tubes (copied from zebra-stripes.scene.ts). */
const ZEBRA_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uDir;
uniform float uFreq;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 r = reflect(normalize(vP - cameraPosition), n);
  float s = asin(clamp(dot(r, uDir), -1.0, 1.0)) * uFreq;
  float t = abs(fract(s) - 0.5) * 2.0;
  float w = clamp(fwidth(s) * 1.5, 0.001, 0.5);
  float m = smoothstep(0.5 - w, 0.5 + w, t);
  gl_FragColor = vec4(mix(uA, uB, m), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function zebraMaterial(dir = new THREE.Vector3(0.3, 1, 0.25)) {
  return new THREE.ShaderMaterial({
    vertexShader: ZEBRA_VERT,
    fragmentShader: ZEBRA_FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uDir: { value: dir.clone().normalize() },
      uFreq: { value: 9 },
    },
  })
}

/** Stripe colours from the theme (ink on background), and the stripe density. */
export function paintZebra(m: THREE.ShaderMaterial, tk: SceneTokens, freq = 9) {
  ;(m.uniforms.uA.value as THREE.Color).copy(tk.defined)
  ;(m.uniforms.uB.value as THREE.Color).copy(tk.bg)
  m.uniforms.uFreq.value = freq
}

/**
 * Diverging colour map from the analysis tokens, t in [−1, 1]:
 * negative → accent blue, zero → good green, positive → warn orange → bad red.
 */
export function diverging(t: number, tk: SceneTokens, out: THREE.Color) {
  const k = Math.max(-1, Math.min(1, t))
  if (k >= 0) {
    if (k < 0.5) out.copy(tk.good).lerp(tk.warn, k * 2)
    else out.copy(tk.warn).lerp(tk.bad, (k - 0.5) * 2)
  } else out.copy(tk.good).lerp(tk.highlight, -k)
  return out
}

/** Signed volume enclosed by a closed, outward-facing triangle mesh (divergence theorem), mm³. */
export function meshVolume(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute("position")
  const index = geo.getIndex()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let vol = 0
  const count = index ? index.count : p.count
  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i
    const ib = index ? index.getX(i + 1) : i + 1
    const ic = index ? index.getX(i + 2) : i + 2
    a.fromBufferAttribute(p, ia)
    b.fromBufferAttribute(p, ib)
    c.fromBufferAttribute(p, ic)
    vol += a.dot(b.cross(c)) / 6
  }
  return vol
}
