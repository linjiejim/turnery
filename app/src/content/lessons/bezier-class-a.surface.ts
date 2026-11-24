import * as THREE from "three"
import type { V2 } from "@/three/geom"
import { basisDers, clampedKnots, elevate, findSpan, type Nurbs } from "./nurbs-curves.nurbs"

/**
 * Tensor-product B-spline patches for 「Bezier 与 NURBS、单跨度面与升阶；Class-A」. The nets
 * are height fields: net[i][j] sits at x_i, y_j with every column sharing its x and every row its
 * y, so an isoparm v = const lies in a plane y = const and its curvature comb can be drawn in
 * that plane. A Bézier patch is the special case with one span each way.
 */
export type V3 = [number, number, number]
export type Patch = { net: V3[][]; pu: number; pv: number; Uu: number[]; Uv: number[] }

export function bezierPatch(net: V3[][]): Patch {
  const nu = net.length
  const nv = net[0].length
  return { net, pu: nu - 1, pv: nv - 1, Uu: clampedKnots(nu, nu - 1), Uv: clampedKnots(nv, nv - 1) }
}

export function patchOf(net: V3[][], pu: number, pv: number): Patch {
  return { net, pu, pv, Uu: clampedKnots(net.length, pu), Uv: clampedKnots(net[0].length, pv) }
}

/** Point and unit normal at (u, v). */
export function evalPatch(s: Patch, u: number, v: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  const nu = s.net.length
  const nv = s.net[0].length
  const ku = findSpan(nu, s.pu, u, s.Uu)
  const kv = findSpan(nv, s.pv, v, s.Uv)
  const Du = basisDers(ku, u, s.pu, s.Uu, 1)
  const Dv = basisDers(kv, v, s.pv, s.Uv, 1)
  const P = new THREE.Vector3()
  const Su = new THREE.Vector3()
  const Sv = new THREE.Vector3()
  for (let a = 0; a <= s.pu; a++)
    for (let b = 0; b <= s.pv; b++) {
      const q = s.net[ku - s.pu + a][kv - s.pv + b]
      const w = Du[0][a] * Dv[0][b]
      const wu = Du[1][a] * Dv[0][b]
      const wv = Du[0][a] * Dv[1][b]
      P.x += w * q[0]
      P.y += w * q[1]
      P.z += w * q[2]
      Su.x += wu * q[0]
      Su.y += wu * q[1]
      Su.z += wu * q[2]
      Sv.x += wv * q[0]
      Sv.y += wv * q[1]
      Sv.z += wv * q[2]
    }
  const n = Su.cross(Sv).normalize()
  if (n.z < 0) n.negate()
  return { p: P, n }
}

/** A tessellated patch with exact normals (zebra stripes read the normals, so they must be right). */
export function patchGeometry(s: Patch, nu = 64, nv = 36) {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const { p, n } = evalPatch(s, i / nu, j / nv)
      pos.push(p.x, p.y, p.z)
      nor.push(n.x, n.y, n.z)
    }
  const row = nu + 1
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * row + i
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/** An isoparm: u fixed (dir "u") or v fixed (dir "v"), lifted a little so it draws over the surface. */
export function isoparm(s: Patch, dir: "u" | "v", at: number, from = 0, to = 1, n = 48, lift = 0.25) {
  const out: THREE.Vector3[] = []
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n
    const { p } = dir === "u" ? evalPatch(s, at, t) : evalPatch(s, t, at)
    p.z += lift
    out.push(p)
  }
  return out
}

/** The isoparm v = v0 as a planar curve in (x, z), and the y of its plane. */
export function section(s: Patch, v0: number): { curve: Nurbs; y: number } {
  const nv = s.net[0].length
  const kv = findSpan(nv, s.pv, v0, s.Uv)
  const N = basisDers(kv, v0, s.pv, s.Uv, 0)[0]
  let y = 0
  const pts: V2[] = s.net.map((col) => {
    let x = 0
    let z = 0
    y = 0
    for (let b = 0; b <= s.pv; b++) {
      const q = col[kv - s.pv + b]
      x += N[b] * q[0]
      y += N[b] * q[1]
      z += N[b] * q[2]
    }
    return [x, z]
  })
  return { curve: { pts, p: s.pu, U: s.Uu }, y }
}

/** Elevate a Bézier net one degree in both directions; `k` eases from the old net for animation. */
export function elevateNet(net: V3[][], k = 1): V3[][] {
  // Along u: each column index i is a control point holding a whole row of v points.
  const nv = net[0].length
  const alongU: V3[][] = []
  for (let j = 0; j < nv; j++) {
    const col = elevate(net.map((r) => r[j]), k) as V3[]
    col.forEach((p, i) => (alongU[i] ??= []).push(p))
  }
  return alongU.map((r) => elevate(r, k) as V3[])
}

/** A regular grid of x and y with heights from z(i, j). */
export function gridNet(nu: number, nv: number, w: number, h: number, z: (i: number, j: number) => number, x0 = -w / 2): V3[][] {
  return Array.from({ length: nu }, (_, i) => Array.from({ length: nv }, (_, j) => [x0 + (w * i) / (nu - 1), -h / 2 + (h * j) / (nv - 1), z(i, j)] as V3))
}

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

/** Stripes from the reflected view direction: parallel light tubes, as in 「斑马纹」 (copied from there). */
const FRAG = /* glsl */ `
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

export function zebraMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    uniforms: {
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uDir: { value: new THREE.Vector3(0.35, 1, 0.2).normalize() },
      uFreq: { value: 14 },
    },
  })
}
