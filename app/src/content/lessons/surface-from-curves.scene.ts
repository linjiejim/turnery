import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { edgeLine, label, line, tag } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import {
  boundary,
  isoU,
  isoV,
  loftPatch,
  paintZebra,
  patchKnots,
  patchSurf,
  sampleCurve,
  surfaceMaterial,
  tessellate,
  zebraMaterial,
  type Surf,
} from "./surface-from-curves.patch"

/**
 * 5.2.1 「由曲线生成曲面」. One design intent, a crowned panel 120 × 80 mm
 * (think of a roof or a lid), built five ways from curves: loft through
 * sections, sweep along one rail, sweep along two rails, a curve network,
 * and four edge curves. Each result shows its structure lines and how far it
 * strays from the intent. Then: dragging the middle crown (who listens to
 * interior curves), matching curve sets to methods, loft order and section
 * direction (folds and twists), and too many slightly-off sections (ripples).
 *
 * The panel: z = 8(1 − Y²) + 6(1 − X²) + c(1 − X²)(1 − Y²), X = x/60, Y = y/40.
 * Its end sections, side edges, middle section and spine are the input curves.
 */
export type Method = "loft" | "sweep1" | "sweep2" | "network" | "edge"
export const METHODS: Method[] = ["loft", "sweep1", "sweep2", "network", "edge"]

export type SfcState = {
  step: number
  method: Method
  crown: number
  seen: Method[]
  crownChanged: boolean
  sawEdgeAfterCrown: boolean
  /** Matching game: which curve set is shown, which are solved, the last pick. */
  set: number
  matched: boolean[]
  pick: Method | null
  /** Loft order (section indices in the order picked) and each section's direction. */
  order: number[]
  flipped: boolean[]
  sawBad: boolean
  clean: boolean
  /** Ripples: 9 measured sections instead of 3. */
  many: boolean
  sawMany: boolean
  sawFew: boolean
}

const HX = 60
const HY = 40
const CROWN = 4
const KEY_POS = new THREE.Vector3(150, -195, 135)
const KEY_TARGET = new THREE.Vector3(0, 0, 6)

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// ------------------------------------------------------------------ the panel and its curves

export function intent(x: number, y: number, c: number) {
  const a = 1 - (x / HX) ** 2
  const b = 1 - (y / HY) ** 2
  return 8 * b + 6 * a + c * a * b
}
const endSec = (sx: number) => (y: number) => V(sx * HX, y, 8 * (1 - (y / HY) ** 2))
const midSec = (c: number) => (y: number) => V(0, y, intent(0, y, c))
const sideEdge = (sy: number) => (x: number) => V(x, sy * HY, 6 * (1 - (x / HX) ** 2))
const spine = (c: number) => (x: number) => V(x, 0, intent(x, 0, c))
const alongY = (f: (y: number) => THREE.Vector3, n = 40) => Array.from({ length: n + 1 }, (_, i) => f(-HY + (2 * HY * i) / n))
const alongX = (f: (x: number) => THREE.Vector3, n = 48) => Array.from({ length: n + 1 }, (_, i) => f(-HX + (2 * HX * i) / n))

/** Quadratic Lagrange through values at −1, 0, 1. */
const lag3 = (s: number, a: number, m: number, b: number) => (m + ((b - a) / 2) * s + ((a + b) / 2 - m) * s * s)

/** The result of each method, built from its own input curves only. */
export function methodSurf(method: Method, c: number): Surf {
  const X = (u: number) => -HX + 2 * HX * u
  const Y = (v: number) => -HY + 2 * HY * v
  switch (method) {
    case "loft":
      // Through three sections, quadratic across them: nothing else is known between the sections.
      return (u, v) => {
        const y = Y(v)
        return V(X(u), y, lag3(2 * u - 1, endSec(-1)(y).z, midSec(c)(y).z, endSec(1)(y).z))
      }
    case "sweep1": {
      // One profile (the middle section) carried along one rail (the spine), kept square to the rail.
      const h = (y: number) => midSec(c)(y).z - midSec(c)(0).z
      return (u, v) => {
        const x = X(u)
        const y = Y(v)
        const slope = -(6 + c) * (2 * x) / (HX * HX)
        const tx = 1 / Math.hypot(1, slope)
        const tz = slope * tx
        const r = spine(c)(x)
        return V(r.x - tz * h(y), y, r.z + tx * h(y))
      }
    }
    case "sweep2":
      // Two rails hold the side edges; the three profiles, measured from the rails, blend in between.
      return (u, v) => {
        const x = X(u)
        const y = Y(v)
        const shape = (f: (y: number) => THREE.Vector3) => f(y).z - f(HY).z
        const rail = sideEdge(-1)(x).z + (sideEdge(1)(x).z - sideEdge(-1)(x).z) * v
        return V(x, y, rail + lag3(2 * u - 1, shape(endSec(-1)), shape(midSec(c)), shape(endSec(1))))
      }
    case "network":
      // Gordon surface: loft one way + loft the other way − the tensor through the nine crossings.
      return (u, v) => {
        const x = X(u)
        const y = Y(v)
        const s = 2 * u - 1
        const w = 2 * v - 1
        const lx = lag3(s, endSec(-1)(y).z, midSec(c)(y).z, endSec(1)(y).z)
        const ly = lag3(w, sideEdge(-1)(x).z, spine(c)(x).z, sideEdge(1)(x).z)
        const at = (xx: number, yy: number) => intent(xx, yy, c)
        const tz = lag3(w, lag3(s, at(-HX, -HY), at(0, -HY), at(HX, -HY)), lag3(s, at(-HX, 0), at(0, 0), at(HX, 0)), lag3(s, at(-HX, HY), at(0, HY), at(HX, HY)))
        return V(x, y, lx + ly - tz)
      }
    case "edge":
      // Coons patch from the four edges: the inside is only a blend of the edges.
      return (u, v) => {
        const x = X(u)
        const y = Y(v)
        const z = (1 - u) * endSec(-1)(y).z + u * endSec(1)(y).z + (1 - v) * sideEdge(-1)(x).z + v * sideEdge(1)(x).z
        return V(x, y, z)
      }
  }
}

/** Largest distance (along Z) between a method's result and the design intent, and where. */
export function deviationOf(method: Method, c: number) {
  const S = methodSurf(method, c)
  let best = { d: 0, p: V(0, 0, 0) }
  for (let i = 0; i <= 24; i++)
    for (let j = 0; j <= 16; j++) {
      const p = S(i / 24, j / 16)
      const d = Math.abs(p.z - intent(p.x, p.y, c))
      if (d > best.d) best = { d, p }
    }
  return best
}

function methodCurves(method: Method, c: number): { pts: THREE.Vector3[]; role: "section" | "rail" | "edge" }[] {
  const ends = [endSec(-1), endSec(1)].map((f) => ({ pts: alongY(f), role: "section" as const }))
  const sides = [sideEdge(-1), sideEdge(1)]
  switch (method) {
    case "loft":
      return [ends[0], { pts: alongY(midSec(c)), role: "section" }, ends[1]]
    case "sweep1":
      return [
        { pts: alongX(spine(c)), role: "rail" },
        { pts: alongY(midSec(c)), role: "section" },
      ]
    case "sweep2":
      return [...sides.map((f) => ({ pts: alongX(f), role: "rail" as const })), ends[0], { pts: alongY(midSec(c)), role: "section" }, ends[1]]
    case "network":
      return [ends[0], { pts: alongY(midSec(c)), role: "section" }, ends[1], ...[sides[0], spine(c), sides[1]].map((f) => ({ pts: alongX(f), role: "rail" as const }))]
    case "edge":
      return [...ends.map((e) => ({ ...e, role: "edge" as const })), ...sides.map((f) => ({ pts: alongX(f), role: "edge" as const }))]
  }
}

/** Where each result's structure lines (isoparms) sit, in its own parameters. */
function methodIso(method: Method): { us: number[]; vs: number[] } {
  const q = [0, 0.25, 0.5, 0.75, 1]
  const sixth = [0, 1, 2, 3, 4, 5, 6].map((i) => i / 6)
  if (method === "loft") return { us: [0, 0.5, 1], vs: q }
  if (method === "network") return { us: [0, 0.5, 1], vs: [0, 0.5, 1] }
  if (method === "edge") return { us: q, vs: q }
  return { us: sixth, vs: q }
}

// ------------------------------------------------------------------ the matching game

export type CurveSet = {
  best: Method
  /** Methods that also build it properly. */
  also: Method[]
  curves: THREE.Vector3[][]
  surf: Surf
}

function polyline(f: (k: number) => THREE.Vector3, n = 48) {
  return Array.from({ length: n + 1 }, (_, i) => f(i / n))
}

export function curveSets(): CurveSet[] {
  // 1 · a 3 × 3 network on a saddle-like hump.
  const net = (x: number, y: number) => 14 + 8 * (1 - (x / 60) ** 2) - 6 * (1 - (y / 40) ** 2)
  const network: CurveSet = {
    best: "network",
    also: [],
    curves: [
      ...[-60, 0, 60].map((x) => polyline((k) => V(x, -40 + 80 * k, net(x, -40 + 80 * k)))),
      ...[-40, 0, 40].map((y) => polyline((k) => V(-60 + 120 * k, y, net(-60 + 120 * k, y)))),
    ],
    surf: (u, v) => V(-60 + 120 * u, -40 + 80 * v, net(-60 + 120 * u, -40 + 80 * v)),
  }
  // 2 · one U profile and one path: a gutter or a trim strip.
  const path = (k: number) => V(-60 + 120 * k, 18 * Math.sin(Math.PI * (k - 0.5) * 1.6), 16)
  const frame = (k: number) => {
    const d = path(Math.min(1, k + 1e-3)).sub(path(Math.max(0, k - 1e-3))).normalize()
    return V(-d.y, d.x, 0)
  }
  const prof = (k: number, t: number) => {
    const a = Math.PI + Math.PI * t
    return path(k).addScaledVector(frame(k), 10 * Math.cos(a)).add(V(0, 0, 10 * Math.sin(a)))
  }
  const sweep1: CurveSet = { best: "sweep1", also: [], curves: [polyline(path), polyline((t) => prof(0, t), 24)], surf: (u, v) => prof(u, v) }
  // 3 · four edges around a twisted corner patch.
  const corners = [V(-55, -40, 2), V(55, -40, 16), V(55, 40, 4), V(-55, 40, 22)]
  const edgeCurve = (a: THREE.Vector3, b: THREE.Vector3, bulge: THREE.Vector3) => (k: number) => a.clone().lerp(b, k).addScaledVector(bulge, 4 * k * (1 - k))
  const e0 = edgeCurve(corners[0], corners[1], V(0, -6, 8))
  const e1 = edgeCurve(corners[3], corners[2], V(0, 6, 6))
  const e2 = edgeCurve(corners[0], corners[3], V(-6, 0, 10))
  const e3 = edgeCurve(corners[1], corners[2], V(6, 0, 4))
  const coons: Surf = (u, v) =>
    e0(u)
      .multiplyScalar(1 - v)
      .addScaledVector(e1(u), v)
      .addScaledVector(e2(v), 1 - u)
      .addScaledVector(e3(v), u)
      .sub(
        corners[0]
          .clone()
          .multiplyScalar((1 - u) * (1 - v))
          .addScaledVector(corners[1], u * (1 - v))
          .addScaledVector(corners[2], u * v)
          .addScaledVector(corners[3], (1 - u) * v),
      )
  const edge: CurveSet = { best: "edge", also: ["network", "sweep2"], curves: [polyline(e0), polyline(e1), polyline(e2), polyline(e3)], surf: coons }
  // 4 · four sections of a hull: open U shapes of changing width and depth.
  const hull = [
    { x: -60, w: 18, d: 14 },
    { x: -20, w: 30, d: 24 },
    { x: 20, w: 28, d: 22 },
    { x: 60, w: 12, d: 9 },
  ]
  const sections = hull.map(({ x, w, d }) => Array.from({ length: 7 }, (_, i) => V(x, w * Math.sin(-Math.PI / 2 + (Math.PI * i) / 6), 30 - d * Math.cos(-Math.PI / 2 + (Math.PI * i) / 6))))
  const hullPatch = loftPatch(sections, 3, 3)
  const loft: CurveSet = { best: "loft", also: [], curves: sections.map((s) => sampleCurve(s, 3, 36)), surf: patchSurf(hullPatch) }
  // 5 · two rails and one profile at the start: a scoop that widens.
  const r1 = (k: number) => V(-55 + 110 * k, -18 - 16 * k * k, 0)
  const r2 = (k: number) => V(-55 + 110 * k, 18 + 16 * k * k, 0)
  const scoop = (u: number, v: number) => r1(u).lerp(r2(u), v).add(V(0, 0, 4 * v * (1 - v) * (22 - 6 * u)))
  const sweep2: CurveSet = { best: "sweep2", also: [], curves: [polyline(r1), polyline(r2), polyline((v) => scoop(0, v), 24)], surf: scoop }
  return [network, sweep1, edge, loft, sweep2]
}

// ------------------------------------------------------------------ loft order and ripples

/** The sections for the order lesson: x = −60, −20, 20, 60, five control points across. */
function orderSections() {
  return [-60, -20, 20, 60].map((x) => [-40, -20, 0, 20, 40].map((y) => V(x, y, intent(x, y, CROWN))))
}

/** A repeatable ±1 pseudo-random number (a "measurement error"). */
const noise = (i: number, j: number) => {
  const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

function rippleSections(many: boolean) {
  const xs = many ? Array.from({ length: 9 }, (_, i) => -60 + 15 * i) : [-60, 0, 60]
  return xs.map((x, i) => [-40, -20, 0, 20, 40].map((y, j) => V(x, y, intent(x, y, CROWN) + (many && i > 0 && i < 8 ? 0.45 * noise(i, j) : 0))))
}

export function orderIsClean(order: number[], flipped: boolean[]) {
  if (order.length !== 4) return false
  const up = order.every((o, i) => o === i)
  const down = order.every((o, i) => o === 3 - i)
  return (up || down) && flipped.every((f) => f === flipped[0])
}

// ------------------------------------------------------------------ scene

export class SurfaceFromCurvesScene extends LessonScene<SfcState> {
  private body = new THREE.Group()
  private marks = new THREE.Group()
  private pickables = new THREE.Group()
  private surfMat = surfaceMaterial()
  private ghostMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
  private zebra = zebraMaterial()
  private pickMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  private crownHandle: CSS2DObject
  private sets = curveSets()
  private down: { x: number; y: number } | null = null
  private dead = false

  constructor(v: Viewer, emit: (s: SfcState) => void) {
    super(v, emit, {
      step: 0,
      method: "loft",
      crown: CROWN,
      seen: ["loft"],
      crownChanged: false,
      sawEdgeAfterCrown: false,
      set: 0,
      matched: [false, false, false, false, false],
      pick: null,
      order: [],
      flipped: [false, false, true, false],
      sawBad: false,
      clean: false,
      many: false,
      sawMany: false,
      sawFew: false,
    })
    v.setGrid(120, 10)
    this.crownHandle = this.makeCrownHandle()
    this.root.add(this.body, this.marks, this.pickables, this.crownHandle)

    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => (this.down = { x: e.clientX, y: e.clientY })
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 || this.state.step !== 3) return
      this.onPick(e)
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
    })
  }

  enter(step: number) {
    const s = this.state
    this.v.tweens.cancel("crown")
    const patch: Partial<SfcState> = { step }
    if (step === 0) patch.crown = CROWN
    if (step === 1 && s.method === "sweep1") patch.method = "network"
    if (step === 2) patch.pick = null
    if (step === 3) Object.assign(patch, { order: [], flipped: [false, false, true, false], clean: false })
    if (step === 4) patch.sawFew = s.sawFew || !s.many
    this.set(patch)
    const v = this.v
    // Input curves are nudged towards the eye: draw them again once the camera has arrived.
    const settle = () => !this.dead && this.state.step === step && this.render()
    if (step === 2) this.fitSet()
    else if (step === 3) v.flyTo(V(95, -215, 170), V(0, 0, 4), 900).then(settle)
    else if (step === 4) v.flyTo(V(120, -185, 120), V(0, 0, 6), 900).then(settle)
    else v.flyTo(KEY_POS.clone(), KEY_TARGET.clone(), 900).then(settle)
  }

  // ------------------------------------------------------------ actions

  setMethod(method: Method) {
    const s = this.state
    this.set({
      method,
      seen: s.seen.includes(method) ? s.seen : [...s.seen, method],
      sawEdgeAfterCrown: s.sawEdgeAfterCrown || (s.step === 1 && method === "edge" && s.crownChanged),
    })
  }

  setCrown(crown: number) {
    const s = this.state
    const changed = s.crownChanged || Math.abs(crown - CROWN) >= 3
    this.set({ crown, crownChanged: changed, sawEdgeAfterCrown: s.sawEdgeAfterCrown || (changed && s.method === "edge") })
  }

  /** Predict reveal: show the edge-curve surface, then raise the middle section. */
  raiseCrown() {
    this.setMethod("edge")
    const from = this.state.crown
    const to = from < 9 ? 12 : 4
    this.v.tweens.run(1100, (k) => this.setCrown(Math.round((from + (to - from) * k) * 2) / 2), { tag: "crown" })
  }

  setSet(set: number) {
    this.set({ set, pick: null })
    this.fitSet()
  }

  pickMethod(m: Method) {
    const s = this.state
    const cs = this.sets[s.set]
    const ok = cs.best === m || cs.also.includes(m)
    const matched = ok ? s.matched.map((x, i) => (i === s.set ? true : x)) : s.matched
    this.set({ pick: m, matched })
  }

  curveSet(set: number) {
    return this.sets[set]
  }

  resetOrder() {
    this.set({ order: [], clean: false })
  }

  /** Predict reveal: loft all four in order, as they are (one of them runs the other way). */
  loftAsIs() {
    this.updateOrder([0, 1, 2, 3], this.state.flipped)
  }

  setMany(many: boolean) {
    this.set({ many, sawMany: this.state.sawMany || many, sawFew: this.state.sawFew || !many })
  }

  private updateOrder(order: number[], flipped: boolean[]) {
    const clean = orderIsClean(order, flipped)
    const bad = order.length >= 2 && !orderIsCleanPartial(order, flipped)
    this.set({ order, flipped, clean, sawBad: this.state.sawBad || bad })
  }

  private onPick(e: PointerEvent) {
    const hit = this.v.pick(e, this.pickables.children, false)
    if (!hit) return
    const { kind, index } = hit.object.userData as { kind: string; index: number }
    const s = this.state
    if (kind === "arrow") this.updateOrder(s.order, s.flipped.map((f, i) => (i === index ? !f : f)))
    else if (kind === "section" && !s.order.includes(index)) this.updateOrder([...s.order, index], s.flipped)
  }

  private fitSet() {
    const S = this.sets[this.state.set].surf
    const box = new THREE.Box3()
    for (const c of this.sets[this.state.set].curves) for (const p of c) box.expandByPoint(p)
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) box.expandByPoint(S(i / 8, j / 8))
    const set = this.state.set
    this.v.fit(box, { dir: V(0.75, -1, 0.85), padding: 1.05 }).then(() => !this.dead && this.state.step === 2 && this.state.set === set && this.render())
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.clear(this.body)
    this.clear(this.marks)
    this.clear(this.pickables)
    this.surfMat.color.copy(tk.model)
    this.ghostMat.color.copy(tk.ghost)
    paintZebra(this.zebra, tk, 9)
    this.crownHandle.visible = s.step === 1
    if (s.step <= 1) this.renderMethod()
    else if (s.step === 2) this.renderSet()
    else if (s.step === 3) this.renderOrder()
    else this.renderRipples()
    this.v.invalidate()
  }

  private renderMethod() {
    const s = this.state
    const kit = this.v.kit
    const S = methodSurf(s.method, s.crown)
    const { geo } = tessellate(S, 48, 32)
    this.body.add(new THREE.Mesh(geo, this.surfMat))
    this.body.add(edgeLine(boundary(S), kit))
    const iso = methodIso(s.method)
    for (const u of iso.us) if (u > 0 && u < 1) this.body.add(edgeLine(isoU(S, u), kit, true))
    for (const v of iso.vs) if (v > 0 && v < 1) this.body.add(edgeLine(isoV(S, v), kit, true))

    const curves = methodCurves(s.method, s.crown)
    for (const c of curves) this.marks.add(line(this.towardEye(c.pts), kit.sketch))
    const roleText = { section: t("截面", "Section"), rail: t("轨道", "Rail"), edge: t("边", "Edge") }
    const shown = new Set<string>()
    for (const c of curves) {
      // One label per role is enough: put it at the curve's far end.
      const key = s.method === "network" ? c.pts[0].x.toFixed(0) + c.pts[0].y.toFixed(0) : c.role
      if (shown.has(key) || (s.method === "network" && shown.size >= 2)) continue
      shown.add(key)
      const text = s.method === "network" ? (c.role === "section" ? t("横向曲线", "Curves across") : t("纵向曲线", "Curves along")) : roleText[c.role]
      const end = c.pts[c.pts.length - 1].clone().add(V(0, 0, 3))
      this.marks.add(label(text, end, "border-transparent bg-transparent font-sans text-primary"))
    }

    const dev = deviationOf(s.method, s.crown)
    if (dev.d > 0.2) {
      const I: (u: number, v: number) => THREE.Vector3 = (u, v) => V(-HX + 2 * HX * u, -HY + 2 * HY * v, intent(-HX + 2 * HX * u, -HY + 2 * HY * v, s.crown))
      const ghost = tessellate(I, 24, 16)
      this.body.add(new THREE.Mesh(ghost.geo, this.ghostMat))
      // The intent's centre lines, dashed, so the gap reads even where the ghost hides behind the result.
      for (const k of [0.5]) this.marks.add(line(isoU(I, k).map((p) => p.add(V(0, 0, 0.3))), kit.construction), line(isoV(I, k).map((p) => p.add(V(0, 0, 0.3))), kit.construction))
      const q = V(dev.p.x, dev.p.y, intent(dev.p.x, dev.p.y, s.crown))
      this.marks.add(line([dev.p, q], kit.dimension))
      const txt = t(`离设计意图 ${dev.d.toFixed(1)} mm`, `${dev.d.toFixed(1)} mm off the intent`)
      this.marks.add(label(txt, dev.p.clone().lerp(q, 0.5).add(V(0, 0, 10)), "border-warning text-warning font-sans"))
    }
    if (s.step === 1) this.crownHandle.position.set(0, 0, intent(0, 0, s.crown) + 0.5)
  }

  private renderSet() {
    const s = this.state
    const kit = this.v.kit
    const cs = this.sets[s.set]
    for (const c of cs.curves) this.marks.add(line(this.towardEye(c), kit.sketch))
    if (s.matched[s.set]) {
      const { geo } = tessellate(cs.surf, 36, 24)
      this.body.add(new THREE.Mesh(geo, this.surfMat))
      this.body.add(edgeLine(boundary(cs.surf), kit))
      for (const k of [0.25, 0.5, 0.75]) this.body.add(edgeLine(isoU(cs.surf, k), kit, true), edgeLine(isoV(cs.surf, k), kit, true))
    }
  }

  private renderOrder() {
    const s = this.state
    const kit = this.v.kit
    const secs = orderSections()
    const dirOf = (i: number) => (s.flipped[i] ? [...secs[i]].reverse() : secs[i])
    if (s.order.length >= 2) {
      const P = loftPatch(
        s.order.map((i) => dirOf(i)),
        3,
        3,
      )
      const S = patchSurf(P)
      const { geo } = tessellate(S, 48, 40)
      this.body.add(new THREE.Mesh(geo, this.surfMat))
      this.body.add(edgeLine(boundary(S, 64), kit))
      const { us } = patchKnots(P)
      for (const u of us) if (u > 0 && u < 1) this.body.add(edgeLine(isoU(S, u, 64), kit, true))
      for (const v of [0.25, 0.5, 0.75]) this.body.add(edgeLine(isoV(S, v, 64), kit, true))
    }
    secs.forEach((sec, i) => {
      const pts = sampleCurve(dirOf(i), 3, 40)
      const lifted = pts.map((p) => p.clone().add(V(0, 0, 0.4)))
      this.marks.add(line(lifted, s.order.includes(i) ? kit.sketchDefined : kit.sketch))
      // A fat invisible tube to click the section by.
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 3.2, 6), this.pickMat)
      tube.userData = { kind: "section", index: i }
      this.pickables.add(tube)
      // The direction arrow at the section's end; click it to flip the direction.
      const end = pts[pts.length - 1]
      const dir = end.clone().sub(pts[pts.length - 3]).normalize()
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8, 18), kit.highlight)
      cone.position.copy(end).addScaledVector(dir, 4).add(V(0, 0, 0.4))
      cone.quaternion.setFromUnitVectors(V(0, 1, 0), dir)
      cone.userData = { kind: "arrow", index: i }
      this.pickables.add(cone)
      const start = pts[0]
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), kit.highlight)
      dot.position.copy(start).add(V(0, 0, 0.4))
      this.marks.add(dot)
      const k = s.order.indexOf(i)
      const name = k >= 0 ? t(`第 ${k + 1} 条`, `#${k + 1}`) : t(`截面 ${"ABCD"[i]}`, `Section ${"ABCD"[i]}`)
      this.marks.add(tag(name, V(sec[0].x, 0, intent(sec[0].x, 0, CROWN) + 9), k >= 0 ? "" : "bg-primary text-primary-foreground"))
    })
    if (s.order.length >= 2 && !orderIsCleanPartial(s.order, s.flipped))
      this.marks.add(label(t("曲面扭了或折回来了", "The surface twists or folds back"), V(0, -HY - 14, 22), "border-warning text-warning font-sans"))
  }

  private renderRipples() {
    const s = this.state
    const kit = this.v.kit
    const secs = rippleSections(s.many)
    const P = loftPatch(secs, 3, 3)
    const S = patchSurf(P)
    const { geo } = tessellate(S, 96, 64)
    this.body.add(new THREE.Mesh(geo, this.zebra))
    this.body.add(edgeLine(boundary(S, 64), kit))
    for (const sec of secs) this.marks.add(line(sampleCurve(sec, 3, 40).map((p) => p.add(V(0, 0, 0.4))), kit.sketch))
  }

  /** Input curves lie on the result's edges: nudge them towards the eye so the surface doesn't hide them. */
  private towardEye(pts: THREE.Vector3[], by = 0.8) {
    const eye = this.v.camera.position
    return pts.map((p) => p.clone().addScaledVector(eye.clone().sub(p).normalize(), by))
  }

  private makeCrownHandle() {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-ns-resize transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("上下拖动，改中间的拱高", "Drag up or down to change the crown in the middle")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.tweens.cancel("crown")
      this.v.controls.enabled = false
      // Drag on a vertical plane facing the camera through the handle.
      const n = this.v.camera.position.clone().sub(this.v.controls.target).setZ(0).normalize()
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, V(0, 0, 0))
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const top = 14
        const c = Math.round(Math.max(0, Math.min(14, hit.z - top)) * 2) / 2
        if (c !== this.state.crown) this.setCrown(c)
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }

  dispose() {
    this.dead = true
    super.dispose()
    this.surfMat.dispose()
    this.ghostMat.dispose()
    this.zebra.dispose()
    this.pickMat.dispose()
  }
}

/** A partial pick (fewer than four) that is still in order and in one direction. */
function orderIsCleanPartial(order: number[], flipped: boolean[]) {
  const steps = order.every((o, i) => i === 0 || Math.abs(o - order[i - 1]) === 1)
  const mono = order.every((o, i) => i < 2 || Math.sign(o - order[i - 1]) === Math.sign(order[1] - order[0]))
  return steps && mono && new Set(order.map((o) => flipped[o])).size === 1
}
