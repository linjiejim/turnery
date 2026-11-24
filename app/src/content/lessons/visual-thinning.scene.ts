import * as THREE from "three"
import { edgeLine, label, line } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 6.1.1 「视觉减薄」: a slab-like device (a router / speaker base) on a
 * table, seen from where its user's eye really is. The side profile is the
 * whole design space: a lower shell that can tuck in (straight taper) or
 * curve under, a chamfer on the bottom edge, a parting line, a darker lower
 * shell, and a round or chamfer on the top edge.
 *
 * What is measured, from the chosen eye point, on the front centre line:
 * - silhouette (看起来的厚度): the image height from where the top ends
 *   (the surface turns steeper than 45°) down to the lowest visible point,
 *   converted to millimetres at the distance of the front edge;
 * - bright band (亮面): the part of that which faces the viewer, faces up or
 *   level (so the overhead light reaches it) and is in the light colour.
 * The shading is a simplified overhead room light, so faces that point down
 * really do go dark, and the table gets a soft shadow under the body.
 */
export type ViewId = "desk" | "counter" | "level"
export type TopKind = "round" | "chamfer"
export type PresetId = "plain" | "tuck" | "curve" | "chamfer" | "dark" | "split" | "round"

export type Shape = {
  tuck: number
  split: number
  curve: number
  chamfer: number
  top: number
  topKind: TopKind
  dark: boolean
}

export type Measure = {
  /** Apparent thickness of the silhouette, mm at the front edge's distance. */
  sil: number
  /** The bright side band, same units. */
  lit: number
  /** The same measure for the plain box from the same eye. */
  base: number
  /** The top face's apparent depth, same units. */
  topSeen: number
  /** Lower shell entirely hidden from the eye. */
  hidden: boolean
  /** Angle of the lower shell just under the parting line, from vertical, degrees. */
  tuckAngle: number
  /** Viewing angle below horizontal to the front edge, degrees. */
  look: number
  /** Inside volume, % of the plain box. */
  volume: number
}

export type ThinState = Shape &
  Measure & {
    step: number
    view: ViewId
    side: boolean
    darkTable: boolean
    seenViews: ViewId[]
    preset: PresetId
    seenPresets: PresetId[]
    tables: number
    /** Top edge kinds tried at 8 mm or more: 1 round, 2 chamfer. */
    tops: number
  }

/** Body: 240 × 160 × 36, plan corners R36. */
export const BODY = { w: 240, d: 160, h: 36, rc: 36 }

/** Eye points: height above the table and distance in front of the product's front edge, mm. */
export const EYES: Record<ViewId, { up: number; out: number }> = {
  desk: { up: 450, out: 600 },
  counter: { up: 650, out: 500 },
  level: { up: BODY.h / 2, out: 700 },
}

export const PLAIN: Shape = { tuck: 0, split: 18, curve: 0, chamfer: 0, top: 2, topKind: "round", dark: false }

export const PRESETS: Record<PresetId, Shape> = {
  plain: PLAIN,
  tuck: { ...PLAIN, tuck: 12, split: 14 },
  curve: { ...PLAIN, curve: 10 },
  chamfer: { ...PLAIN, chamfer: 8 },
  dark: { ...PLAIN, dark: true },
  split: { ...PLAIN, split: 6 },
  round: { ...PLAIN, top: 12 },
}

/** Surfaces flatter than this (normal's up component) read as part of the top. */
const TOP_NZ = 0.7
const K = 8

type PS = { r: number; z: number; nr: number; nz: number }

export const eyePoint = (v: ViewId) => new THREE.Vector3(0, -BODY.d / 2 - EYES[v].out, EYES[v].up)

/** The side profile, bottom to top, as pieces (normals are continuous inside a piece). r ≤ 0 is the inset from the plan outline. */
export function profile(p: Shape): PS[][] {
  const H = BODY.h
  const top = Math.max(0.5, p.top)
  const split = Math.max(2, Math.min(p.split, H - top - 0.5))
  const c = Math.min(p.chamfer, split * 0.8)
  const inset = (z: number) => (z >= split ? 0 : (p.tuck * (split - z)) / split + p.curve * ((split - z) / split) ** 2)
  const slope = (z: number) => p.tuck / split + (2 * p.curve * (split - z)) / (split * split)
  const out: PS[][] = []
  if (c > 0.05) {
    const a = { r: -inset(0) - c, z: 0 }
    const b = { r: -inset(c), z: c }
    const l = Math.hypot(b.r - a.r, b.z - a.z)
    const nr = (b.z - a.z) / l
    const nz = -(b.r - a.r) / l
    out.push([
      { ...a, nr, nz },
      { ...b, nr, nz },
    ])
  }
  const lower: PS[] = []
  const N = p.tuck > 0 || p.curve > 0 ? 16 : 1
  for (let k = 0; k <= N; k++) {
    const z = c + ((split - c) * k) / N
    const s = slope(z)
    const l = Math.hypot(1, s)
    lower.push({ r: -inset(z), z, nr: 1 / l, nz: -s / l })
  }
  out.push(lower)
  out.push([
    { r: 0, z: split, nr: 1, nz: 0 },
    { r: 0, z: H - top, nr: 1, nz: 0 },
  ])
  if (p.topKind === "round") {
    const pts: PS[] = []
    for (let k = 0; k <= 12; k++) {
      const f = (Math.PI / 2) * (k / 12)
      pts.push({ r: -top + top * Math.cos(f), z: H - top + top * Math.sin(f), nr: Math.cos(f), nz: Math.sin(f) })
    }
    out.push(pts)
  } else {
    const s = Math.SQRT1_2
    out.push([
      { r: 0, z: H - top, nr: s, nz: s },
      { r: -top, z: H, nr: s, nz: s },
    ])
  }
  return out
}

function topInset(p: Shape) {
  return Math.max(0.5, p.top)
}

/** Area of the plan outline moved in by i. */
function area(i: number) {
  const { w, d, rc } = BODY
  return (w - 2 * i) * (d - 2 * i) - (4 - Math.PI) * (rc - i) ** 2
}

function volume(p: Shape) {
  const pts = profile(p).flat()
  let v = 0
  for (let k = 1; k < pts.length; k++) v += ((area(-pts[k - 1].r) + area(-pts[k].r)) / 2) * (pts[k].z - pts[k - 1].z)
  return v
}

/** Where the top ends: the point on the top edge whose surface is at 45°. */
function topEnd(p: Shape) {
  const top = topInset(p)
  return p.topKind === "round" ? { r: -top + top * Math.SQRT1_2, z: BODY.h - top + top * Math.SQRT1_2 } : { r: 0, z: BODY.h - top }
}

const effSplit = (p: Shape) => Math.max(2, Math.min(p.split, BODY.h - topInset(p) - 0.5))

/** Measure a shape from an eye point, on the front centre line (x = 0). */
function raw(p: Shape, view: ViewId): Omit<Measure, "base"> {
  const E = eyePoint(view)
  const y0 = -BODY.d / 2
  const alpha = (r: number, z: number) => Math.atan2(E.z - z, y0 - r - E.y)
  const d0 = Math.hypot(E.y - y0, E.z - BODY.h / 2)
  const split = effSplit(p)
  const T = topEnd(p)
  const aT = alpha(T.r, T.z)

  let aB = aT
  let lit = 0
  let lowerSeen = 0
  for (const pc of profile(p)) {
    for (let k = 1; k < pc.length; k++) {
      const a = pc[k - 1]
      const b = pc[k]
      const nr = (a.nr + b.nr) / 2
      const nz = (a.nz + b.nz) / 2
      const my = y0 - (a.r + b.r) / 2
      const mz = (a.z + b.z) / 2
      // Outward normal on the front is (0, −nr, nz); the eye sees the segment if it faces the eye.
      const facing = -nr * (E.y - my) + nz * (E.z - mz)
      if (facing <= 0) continue
      const aa = alpha(a.r, a.z)
      const ab = alpha(b.r, b.z)
      if (mz < split) lowerSeen += Math.abs(aa - ab)
      // Everything from where the top ends upwards reads as top.
      if (Math.min(a.z, b.z) >= T.z - 1e-6) continue
      aB = Math.max(aB, aa, ab)
      const side = nz <= TOP_NZ
      const litUp = nz >= -0.05
      const light = !(p.dark && mz < split)
      if (side && litUp && light) lit += Math.abs(aa - ab)
    }
  }
  const back = alpha(-BODY.d + topInset(p), BODY.h)
  return {
    sil: Math.max(0, aB - aT) * d0,
    lit: lit * d0,
    topSeen: Math.max(0, aT - back) * d0,
    hidden: (p.tuck > 0 || p.curve > 0) && lowerSeen * d0 < 0.05,
    tuckAngle: THREE.MathUtils.radToDeg(Math.atan(p.tuck / split)),
    look: THREE.MathUtils.radToDeg(Math.atan2(E.z - BODY.h / 2, y0 - E.y)),
    volume: (volume(p) / volume(PLAIN)) * 100,
  }
}

const baseCache = new Map<ViewId, number>()

export function measure(p: Shape, view: ViewId): Measure {
  let base = baseCache.get(view)
  if (base === undefined) {
    base = raw(PLAIN, view).sil
    baseCache.set(view, base)
  }
  return { ...raw(p, view), base }
}

// ------------------------------------------------------------------ shading

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

/** Overhead room light: faces lit by how much of the ceiling they see, a little light from the viewer's side, and the ceiling's reflection. */
const BODY_FRAG = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uDark;
uniform float uSplit;
uniform float uDarkOn;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vP);
  vec3 base = (uDarkOn > 0.5 && vP.z < uSplit) ? uDark : uLight;
  float sky = 0.5 + 0.5 * n.z;
  float lit = 0.12 + 0.88 * sky * sky + 0.1 * max(dot(n, v), 0.0);
  vec3 r = reflect(-v, n);
  float spec = smoothstep(0.82, 0.97, r.z) * 0.22;
  gl_FragColor = vec4(base * lit + vec3(spec), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** The table: its colour, darkened by a soft shadow around and under the body. */
const TABLE_FRAG = /* glsl */ `
uniform vec3 uTable;
uniform vec2 uHalf;
uniform float uR;
varying vec3 vN;
varying vec3 vP;
float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  float d = sdRound(vP.xy, uHalf, uR);
  float shade = 1.0 - smoothstep(-6.0, 34.0, d);
  float under = 1.0 - smoothstep(-14.0, 0.0, d);
  gl_FragColor = vec4(uTable * (1.0 - 0.42 * shade - 0.3 * under), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function ring(r: number, z: number) {
  const { w, d, rc } = BODY
  const out: { p: THREE.Vector3; c: number; s: number }[] = []
  const corners: [number, number, number][] = [
    [1, -1, -Math.PI / 2],
    [1, 1, 0],
    [-1, 1, Math.PI / 2],
    [-1, -1, Math.PI],
  ]
  for (const [sx, sy, a0] of corners) {
    for (let k = 0; k <= K; k++) {
      const a = a0 + (Math.PI / 2) * (k / K)
      const c = Math.cos(a)
      const s = Math.sin(a)
      out.push({ p: new THREE.Vector3(sx * (w / 2 - rc) + (rc + r) * c, sy * (d / 2 - rc) + (rc + r) * s, z), c, s })
    }
  }
  return out
}

function bodyGeometry(p: Shape) {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  for (const pc of profile(p)) {
    const start = pos.length / 3
    let cols = 0
    for (const s of pc) {
      const rg = ring(s.r, s.z)
      cols = rg.length
      for (const q of rg) {
        pos.push(q.p.x, q.p.y, q.p.z)
        nor.push(s.nr * q.c, s.nr * q.s, s.nz)
      }
    }
    for (let j = 0; j < pc.length - 1; j++)
      for (let i = 0; i < cols; i++) {
        const i2 = (i + 1) % cols
        const a = start + j * cols + i
        const b = start + j * cols + i2
        const c = start + (j + 1) * cols + i2
        const d = start + (j + 1) * cols + i
        idx.push(a, b, c, a, c, d)
      }
  }
  // Caps.
  const pts = profile(p).flat()
  const caps: [PS, number][] = [
    [pts[pts.length - 1], 1],
    [pts[0], -1],
  ]
  for (const [s, dir] of caps) {
    const rg = ring(s.r, s.z)
    const centre = pos.length / 3
    pos.push(0, 0, s.z)
    nor.push(0, 0, dir)
    for (const q of rg) {
      pos.push(q.p.x, q.p.y, q.p.z)
      nor.push(0, 0, dir)
    }
    for (let i = 0; i < rg.length; i++) {
      const a = centre + 1 + i
      const b = centre + 1 + ((i + 1) % rg.length)
      if (dir > 0) idx.push(centre, a, b)
      else idx.push(centre, b, a)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

export class ThinScene extends LessonScene<ThinState> {
  private body = new THREE.Group()
  private marks = new THREE.Group()
  private bodyMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: BODY_FRAG,
    uniforms: { uLight: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uSplit: { value: 18 }, uDarkOn: { value: 0 } },
  })
  private tableMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: TABLE_FRAG,
    uniforms: { uTable: { value: new THREE.Color() }, uHalf: { value: new THREE.Vector2(BODY.w / 2, BODY.d / 2) }, uR: { value: BODY.rc } },
  })
  private zoneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })

  constructor(v: Viewer, emit: (s: ThinState) => void) {
    super(v, emit, {
      ...PLAIN,
      ...measure(PLAIN, "desk"),
      step: 0,
      view: "desk",
      side: false,
      darkTable: false,
      seenViews: ["desk"],
      preset: "plain",
      seenPresets: ["plain"],
      tables: 1,
      tops: 0,
    })
    v.showGrid(false)
    const table = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), this.tableMat)
    table.position.set(0, 200, -0.05)
    table.userData = { kind: "table" }
    this.root.add(table, this.body, this.marks)
  }

  enter(step: number) {
    const shape: Shape =
      step === 2 ? { ...PLAIN, tuck: 8, split: 14 } : step === 4 ? { ...PLAIN, split: 12 } : step === 5 ? { ...PLAIN, split: 14 } : { ...PLAIN }
    this.update({
      step,
      ...shape,
      view: "desk",
      side: step === 2,
      darkTable: false,
      preset: "plain",
    })
    this.frame()
  }

  // ------------------------------------------------------------ actions

  setView(view: ViewId) {
    const seen = this.state.seenViews.includes(view) ? this.state.seenViews : [...this.state.seenViews, view]
    this.update({ view, seenViews: seen, side: false })
    this.frame()
  }

  setSide(side: boolean) {
    this.update({ side })
    this.frame()
  }

  setShape(patch: Partial<Shape>) {
    this.update(patch)
  }

  setPreset(preset: PresetId) {
    const seen = this.state.seenPresets.includes(preset) ? this.state.seenPresets : [...this.state.seenPresets, preset]
    this.update({ ...PRESETS[preset], preset, seenPresets: seen })
  }

  setDarkTable(darkTable: boolean) {
    this.update({ darkTable, tables: this.state.tables | (darkTable ? 2 : 1) })
  }

  /** Change state and recompute the measurements. */
  private update(patch: Partial<ThinState>) {
    const next = { ...this.state, ...patch }
    const tops = next.step === 3 && next.top >= 8 ? next.tops | (next.topKind === "round" ? 1 : 2) : next.tops
    this.set({ ...patch, tops, ...measure(next, next.view) })
  }

  private frame() {
    const s = this.state
    // The side view is drawn without perspective, so the overlay in front of the body lines up with its outline.
    this.v.setProjection(s.side ? "orthographic" : "perspective")
    if (s.side) {
      this.v.setView("right", { target: new THREE.Vector3(0, -95, 60), distance: 680 })
      return
    }
    const E = eyePoint(s.view)
    this.v.flyTo(E, new THREE.Vector3(0, -6, s.view === "level" ? BODY.h / 2 : 10), 900)
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    const kit = this.v.kit
    const u = this.bodyMat.uniforms
    ;(u.uLight.value as THREE.Color).copy(tk.model)
    ;(u.uDark.value as THREE.Color).copy(tk.modelDark).multiplyScalar(0.7)
    u.uSplit.value = effSplit(s)
    u.uDarkOn.value = s.dark ? 1 : 0
    const light = tk.dark ? tk.ink : tk.paper
    const dark = tk.modelDark.clone().lerp(tk.dark ? tk.paper : tk.ink, 0.45)
    ;(this.tableMat.uniforms.uTable.value as THREE.Color).copy(s.darkTable ? dark : light)
    this.zoneMat.color.copy(tk.modified)

    this.clear(this.body)
    const mesh = new THREE.Mesh(bodyGeometry(s), this.bodyMat)
    mesh.userData = { kind: "face", feature: "body", role: "model" }
    this.body.add(mesh)
    // Parting line: a thin groove that reads as a dark line.
    const groove = ring(0.15, effSplit(s)).map((q) => q.p)
    this.body.add(edgeLine([...groove, groove[0]], kit))

    this.clear(this.marks)
    if (s.side) this.drawSection()
    else this.drawBar()
    this.v.invalidate()
  }

  /** The measured band, as a bar in front of the front face from where the top ends to the lowest visible point. */
  private drawBar() {
    const s = this.state
    if (s.sil < 0.5) return
    const kit = this.v.kit
    const E = eyePoint(s.view)
    const x = 24
    const y0 = -BODY.d / 2
    const T = topEnd(s)
    const B = lowestVisible(s, E)
    const pT = new THREE.Vector3(x, y0 - T.r - 3, T.z)
    const pB = new THREE.Vector3(x, y0 - B.r - 3, Math.max(B.z, 0.6))
    // Keep the bar in one plane facing the eye: slide the bottom point along its sight line to the top point's depth.
    const toEye = E.clone().sub(pB).normalize()
    const k = (pT.y - pB.y) / (toEye.y || 1)
    pB.addScaledVector(toEye, k)
    this.marks.add(line([pT, pB], kit.sketch))
    for (const p of [pT, pB]) this.marks.add(line([p.clone().add(new THREE.Vector3(-5, 0, 0)), p.clone().add(new THREE.Vector3(5, 0, 0))], kit.sketch))
    const mid = pT.clone().add(pB).multiplyScalar(0.5).add(new THREE.Vector3(10, 0, 0))
    const l = label(t(`看起来 ${s.sil.toFixed(1)} mm`, `Looks ${s.sil.toFixed(1)} mm`), mid, "border-primary text-primary")
    l.center.set(0, 0.5)
    this.marks.add(l)
  }

  /** Side view: the profile, the eye's sight lines through the top end and the lowest visible point, and the hidden zone. */
  private drawSection() {
    const s = this.state
    const kit = this.v.kit
    const E = eyePoint(s.view)
    const x = BODY.w / 2 + 2
    const y0 = -BODY.d / 2
    const P = (r: number, z: number) => new THREE.Vector3(x, y0 - r, z)
    const pts = profile(s).flat()
    this.marks.add(line(pts.map((q) => P(q.r, q.z)), kit.sketchDefined))
    const T = topEnd(s)
    const B = lowestVisible(s, E)
    const eyeDir = (p: THREE.Vector3) => new THREE.Vector3(0, E.y - p.y, E.z - p.z).normalize()
    const pT = P(T.r, T.z)
    const pB = P(B.r, B.z)
    this.marks.add(line([pT, pT.clone().addScaledVector(eyeDir(pT), 150)], kit.sketch))
    this.marks.add(line([pB, pB.clone().addScaledVector(eyeDir(pB), 150)], kit.sketch))
    const end = pT.clone().addScaledVector(eyeDir(pT), 154)
    const lb = label(t("视线：去往眼睛", "Sight lines, to the eye"), end, "border-transparent bg-transparent font-sans text-primary")
    lb.center.set(1, 1)
    this.marks.add(lb)

    // Hidden zone: below the sight line through B, down to the table, outside the body.
    const back = eyeDir(pB).negate()
    if (B.z > 0.5 && back.z < -1e-3) {
      const q = pB.clone().addScaledVector(back, -pB.z / back.z)
      const below = pts.filter((p) => p.z < B.z - 1e-6)
      const poly = [pB, q, ...below.map((p) => P(p.r, p.z))]
      const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p.y, p.z))))
      // ShapeGeometry lies in XY: put its (y, z) onto the plane x = const.
      const pos = g.getAttribute("position")
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, x + 0.5, pos.getX(i), pos.getY(i))
      pos.needsUpdate = true
      const m = new THREE.Mesh(g, this.zoneMat)
      m.raycast = () => {}
      this.marks.add(m)
      this.marks.add(line([pB, q], kit.construction))
      const hz = label(t("这里看不见", "Hidden from here"), P(B.r + 8, Math.max(2, B.z * 0.35)), "border-transparent bg-transparent font-sans text-foreground")
      hz.center.set(0, 0.5)
      this.marks.add(hz)
    }

    // The desk, seen edge on.
    this.marks.add(edgeLine([new THREE.Vector3(x, -260, 0), new THREE.Vector3(x, 110, 0)], kit))
    const desk = label(t("桌面", "Desk"), new THREE.Vector3(x, -250, -2), "border-transparent bg-transparent font-sans text-muted-foreground")
    desk.center.set(0, 0)
    this.marks.add(desk)

    // Overhead light.
    for (const y of [-50, 0, 50]) {
      const a = new THREE.Vector3(x, y, 104)
      const b = new THREE.Vector3(x, y, 64)
      this.marks.add(line([a, b], kit.dimension))
      this.marks.add(line([b.clone().add(new THREE.Vector3(0, -3, 5)), b, b.clone().add(new THREE.Vector3(0, 3, 5))], kit.dimension))
    }
    const lt = label(t("顶光：灯在头顶", "Overhead light"), new THREE.Vector3(x, 0, 109), "border-transparent bg-transparent font-sans text-muted-foreground")
    lt.center.set(0.5, 1)
    this.marks.add(lt)
  }

  dispose() {
    this.v.showGrid(true)
    this.v.setProjection("perspective")
    super.dispose()
    this.bodyMat.dispose()
    this.tableMat.dispose()
    this.zoneMat.dispose()
  }
}

/** The lowest point of the profile the eye still sees (the profile is convex, so it's the end of the last front-facing segment). */
function lowestVisible(p: Shape, E: THREE.Vector3) {
  const y0 = -BODY.d / 2
  const alpha = (r: number, z: number) => Math.atan2(E.z - z, y0 - r - E.y)
  let best = { r: 0, z: BODY.h, a: -Infinity }
  for (const pc of profile(p))
    for (let k = 1; k < pc.length; k++) {
      const a = pc[k - 1]
      const b = pc[k]
      const nr = (a.nr + b.nr) / 2
      const nz = (a.nz + b.nz) / 2
      const facing = -nr * (E.y - (y0 - (a.r + b.r) / 2)) + nz * (E.z - (a.z + b.z) / 2)
      if (facing <= 0) continue
      for (const q of [a, b]) {
        const al = alpha(q.r, q.z)
        if (al > best.a) best = { r: q.r, z: q.z, a: al }
      }
    }
  return best
}
