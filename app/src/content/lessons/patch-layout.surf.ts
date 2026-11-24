import * as THREE from "three"
import type { SceneTokens } from "@/three/tokens"

/**
 * Surface helpers shared by the T5 surfacing lessons (「分面」, 「奇点」, 「SubD」): a zebra material
 * (the shader of 「斑马纹」, copied so those lessons stay independent), grid meshes from a parametric
 * function with normals from its derivatives, and isoparametric lines.
 */

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

/** Stripes from the reflected view direction: a row of parallel light tubes, like Zebra / Light tunnel in CAD. */
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
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    uniforms: {
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uDir: { value: dir.clone().normalize() },
      uFreq: { value: 9 },
    },
  })
}

/** Stripe colours from the theme (ink-like stripes on the background colour). */
export function paintZebra(m: THREE.ShaderMaterial, tk: SceneTokens, freq = 9) {
  ;(m.uniforms.uA.value as THREE.Color).copy(tk.defined)
  ;(m.uniforms.uB.value as THREE.Color).copy(tk.bg)
  m.uniforms.uFreq.value = freq
}

export type SurfFn = (u: number, v: number) => THREE.Vector3

/** Unit normal from the partial derivatives (central differences, one-sided at the edges, nudged inwards where degenerate). */
export function normalAt(P: SurfFn, u: number, v: number, h = 1e-4): THREE.Vector3 {
  const du = (uu: number, vv: number) => {
    const a = Math.max(0, uu - h)
    const b = Math.min(1, uu + h)
    return P(b, vv).sub(P(a, vv)).divideScalar(b - a)
  }
  const dv = (uu: number, vv: number) => {
    const a = Math.max(0, vv - h)
    const b = Math.min(1, vv + h)
    return P(uu, b).sub(P(uu, a)).divideScalar(b - a)
  }
  const n = du(u, v).cross(dv(u, v))
  if (n.lengthSq() > 1e-14) return n.normalize()
  // A collapsed edge: take the normal a little way in.
  const uu = u < 0.5 ? u + 2e-3 : u - 2e-3
  const vv = v < 0.5 ? v + 2e-3 : v - 2e-3
  const m = du(uu, vv).cross(dv(uu, vv))
  return m.lengthSq() > 1e-14 ? m.normalize() : new THREE.Vector3(0, 0, 1)
}

export type Grid = { pos: THREE.Vector3[][]; nor: THREE.Vector3[][] }

/** Sample P on an (nu + 1) × (nv + 1) grid, rows by v. `normal` overrides the derivative normal. */
export function sampleGrid(P: SurfFn, nu: number, nv: number, normal?: (u: number, v: number) => THREE.Vector3): Grid {
  const pos: THREE.Vector3[][] = []
  const nor: THREE.Vector3[][] = []
  for (let j = 0; j <= nv; j++) {
    const pr: THREE.Vector3[] = []
    const nr: THREE.Vector3[] = []
    for (let i = 0; i <= nu; i++) {
      const u = i / nu
      const v = j / nv
      pr.push(P(u, v))
      nr.push(normal ? normal(u, v) : normalAt(P, u, v))
    }
    pos.push(pr)
    nor.push(nr)
  }
  return { pos, nor }
}

/** Turn the grid's normals round if the middle one points against `ref`. */
export function orient(g: Grid, ref: THREE.Vector3) {
  const j = Math.floor(g.nor.length / 2)
  const i = Math.floor(g.nor[0].length / 2)
  if (g.nor[j][i].dot(ref) < 0) for (const row of g.nor) for (const n of row) n.negate()
  return g
}

/** An indexed mesh from a grid; the winding follows the normals so the outside is the front. */
export function gridGeometry(g: Grid, colors?: THREE.Color[][]) {
  const nv = g.pos.length - 1
  const nu = g.pos[0].length - 1
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const p = g.pos[j][i]
      const n = g.nor[j][i]
      pos.push(p.x, p.y, p.z)
      nor.push(n.x, n.y, n.z)
      if (colors) col.push(colors[j][i].r, colors[j][i].g, colors[j][i].b)
    }
  // Which way do the cells wind? Vote over the grid (collapsed cells don't count).
  let vote = 0
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = g.pos[j][i]
      const e1 = g.pos[j][i + 1].clone().sub(a)
      const e2 = g.pos[j + 1][i].clone().sub(a)
      vote += Math.sign(e1.cross(e2).dot(g.nor[j][i]))
    }
  const flip = vote < 0
  const idx: number[] = []
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i
      const b = a + 1
      const c = a + nu + 1
      const d = c + 1
      if (flip) idx.push(a, c, b, b, c, d)
      else idx.push(a, b, c, b, d, c)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  if (colors) geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  return geo
}

/** Polylines as one LineSegments geometry. */
export function segmentsGeometry(polylines: THREE.Vector3[][]) {
  const pos: number[] = []
  for (const pl of polylines)
    for (let i = 0; i < pl.length - 1; i++) {
      const a = pl[i]
      const b = pl[i + 1]
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/** Isoparametric curves of P: u = const for each of `us`, v = const for each of `vs`. */
export function isoCurves(P: SurfFn, us: number[], vs: number[], samples = 40): THREE.Vector3[][] {
  const out: THREE.Vector3[][] = []
  for (const u of us) out.push(Array.from({ length: samples + 1 }, (_, k) => P(u, k / samples)))
  for (const v of vs) out.push(Array.from({ length: samples + 1 }, (_, k) => P(k / samples, v)))
  return out
}

/** n + 1 evenly spaced parameters from 0 to 1, without the ends when `inner`. */
export function params(n: number, inner = true) {
  const out: number[] = []
  for (let i = inner ? 1 : 0; i <= (inner ? n - 1 : n); i++) out.push(i / n)
  return out
}

/** Lines that don't take part in picking. */
export function noPick<T extends THREE.Object3D>(o: T): T {
  o.raycast = () => {}
  return o
}
