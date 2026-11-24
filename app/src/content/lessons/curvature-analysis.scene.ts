import * as THREE from "three"
import { edgeLine, label, line, tag } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { boundary, clampedKnots, curvature, curvePoint, derivs, diverging, lineMaterial, surfaceMaterial, tessellate, trackResolution, type Surf } from "./surface-from-curves.patch"

/**
 * 5.3.2 「曲率分析（高斯曲率、平均曲率）与拔模分析」. Four sample surfaces
 * (dome, saddle, cylinder, cone) colour-mapped by Gaussian and mean
 * curvature, with a click-to-probe of the principal curvatures; a blind task
 * to find a 0.3 mm dent on a gently domed panel; developable surfaces
 * unrolled flat (and a sphere that can't be); and a draft analysis on a
 * styled body with a movable parting line.
 *
 * Curvature comes from finite differences of each surface's parametric
 * form (surface-from-curves.patch.ts), so the colours are what the surface
 * really does. Sign: convex (bending away from the outward normal) is positive.
 */
export type Shape = "dome" | "saddle" | "cylinder" | "cone"
export type MapKind = "shaded" | "gauss" | "mean"
export type DevShape = "cylinder" | "cone" | "sphere"

export type Probe = { k1: number; k2: number; K: number; H: number }

export type CurvState = {
  step: number
  shape: Shape
  map: MapKind
  probe: Probe | null
  probed: boolean
  seenShapes: Shape[]
  seenMean: Shape[]
  /** The hidden dent, mm, on the panel. */
  dent: { x: number; y: number }
  guesses: { x: number; y: number; hit: boolean }[]
  found: boolean
  dev: DevShape
  unroll: number
  unrolledCyl: boolean
  unrolledCone: boolean
  triedSphere: boolean
  /** Draft step. */
  parting: number
  minDraft: number
  /** Draft added to the styling either side of the widest line, degrees. */
  taper: number
  undercut: number
  lowDraft: number
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// ------------------------------------------------------------------ sample shapes

export function shapeSurf(shape: Shape): Surf {
  const X = (u: number) => -45 + 90 * u
  const Y = (v: number) => -45 + 90 * v
  switch (shape) {
    case "dome": {
      const R = 80
      const base = Math.sqrt(R * R - 2 * 45 * 45)
      return (u, v) => {
        const x = X(u)
        const y = Y(v)
        return V(x, y, Math.sqrt(R * R - x * x - y * y) - base + 4)
      }
    }
    case "saddle":
      return (u, v) => {
        const x = X(u)
        const y = Y(v)
        return V(x, y, 18 + (x * x - y * y) / 140)
      }
    case "cylinder": {
      const R = 60
      const base = Math.sqrt(R * R - 45 * 45)
      return (u, v) => {
        const x = X(u)
        return V(x, Y(v), Math.sqrt(R * R - x * x) - base + 4)
      }
    }
    case "cone":
      // Axis along Y, radius growing from 38 to 70 mm; 100° of the circumference.
      return (u, v) => {
        const y = Y(v)
        const r = 38 + (32 * v)
        const a = THREE.MathUtils.degToRad(-50 + 100 * u)
        return V(r * Math.sin(a), y, r * Math.cos(a) - r * Math.cos(THREE.MathUtils.degToRad(50)) + 4)
      }
  }
}

/** Colour scales: curvature that maps to full colour. */
const K_FULL = 1.5e-4
const H_FULL = 1 / 80

// ------------------------------------------------------------------ the dented panel

const PANEL = { hx: 80, hy: 55, R: 600, dent: 0.3, sigma: 6 }

export function panelSurf(dent: { x: number; y: number }): Surf {
  return (u, v) => {
    const x = -PANEL.hx + 2 * PANEL.hx * u
    const y = -PANEL.hy + 2 * PANEL.hy * v
    const r2 = (x - dent.x) ** 2 + (y - dent.y) ** 2
    return V(x, y, 14 - (x * x + y * y) / (2 * PANEL.R) - PANEL.dent * Math.exp(-r2 / (2 * PANEL.sigma ** 2)))
  }
}

const randomDent = () => ({ x: Math.round((Math.random() * 2 - 1) * 55), y: Math.round((Math.random() * 2 - 1) * 32) })

// ------------------------------------------------------------------ developable or not

const CYL = { R: 40, angle: THREE.MathUtils.degToRad(150), len: 90 }
const CONE = { s0: 50, s1: 120, phi: THREE.MathUtils.degToRad(50), beta0: THREE.MathUtils.degToRad(25) }
const CAP = { R: 60, rho: 42 }

/** The shape bent part of the way from its curved state (k = 0) to flat (k = 1). Isometric for the cylinder and cone. */
export function devSurf(dev: DevShape, k: number): Surf {
  if (dev === "cylinder") {
    const L = CYL.R * CYL.angle
    const kappa = (1 - k) / CYL.R
    return (u, v) => {
      const s = (u - 0.5) * L
      const y = (v - 0.5) * CYL.len
      if (kappa < 1e-6) return V(s, y, 4)
      const rho = 1 / kappa
      return V(rho * Math.sin(s / rho), y, rho * Math.cos(s / rho) - rho + CYL.R * (1 - Math.cos(CYL.angle / 2)) * (1 - k) + 4)
    }
  }
  if (dev === "cone") {
    const beta = CONE.beta0 + (Math.PI / 2 - CONE.beta0) * k
    const mid = (CONE.s0 + CONE.s1) / 2
    return (u, v) => {
      const sig = CONE.s0 + (CONE.s1 - CONE.s0) * v
      const th = ((u - 0.5) * CONE.phi) / Math.sin(beta)
      const r = sig * Math.sin(beta)
      return V(r * Math.sin(th), -r * Math.cos(th) + mid * Math.sin(beta), (CONE.s1 - sig) * Math.cos(beta) + 2)
    }
  }
  // A spherical cap pressed flat, keeping distances from its centre (they can't all be kept).
  return (u, v) => {
    const rho = CAP.rho * u
    const phi = 2 * Math.PI * v
    const a = rho / CAP.R
    const sphere = V(CAP.R * Math.sin(a) * Math.cos(phi), CAP.R * Math.sin(a) * Math.sin(phi), CAP.R * Math.cos(a) - CAP.R * Math.cos(CAP.rho / CAP.R) + 2)
    const flat = V(rho * Math.cos(phi), rho * Math.sin(phi), 2)
    return sphere.lerp(flat, k)
  }
}

/** Stretch the cap's rim needs to lie flat: the flat circle is longer than the circle on the sphere. */
export const capStretch = (rho: number) => (rho < 1e-6 ? 0 : rho / (CAP.R * Math.sin(rho / CAP.R)) - 1)
export const CAP_MAX_STRETCH = capStretch(CAP.rho)

// ------------------------------------------------------------------ the styled body for draft

/**
 * A styled body (a mouse or a remote): plan a rounded superellipse, side profile a cubic B-spline in
 * (scale, z) with a near-vertical band around z = 8 (its widest line) and a domed top. `taper` adds
 * draft to the styling: the sides lean in by that angle above and below z = 8, which leaves a crease there.
 */
const BODY = { a: 60, b: 38, n: 2.6, zw: 8 }
const PROFILE = [
  [0.93, 0],
  [0.975, 2.5],
  [1, 5],
  [1, 7],
  [1, 9],
  [1, 11],
  [0.97, 17],
  [0.8, 24],
  [0.45, 29],
  [0, 29],
].map(([s, z]) => new THREE.Vector3(s, z, 0))
const PROFILE_U = clampedKnots(PROFILE.length, 3)

const sp = (c: number, e: number) => Math.sign(c) * Math.abs(c) ** e

/** u around the plan, v up the side profile from the bottom (v = 0) to the top centre (v = 1). */
export function bodySurf(taper: number): Surf {
  const k = Math.tan(THREE.MathUtils.degToRad(taper))
  return (u, v) => {
    const th = 2 * Math.PI * u
    const q = curvePoint(PROFILE, 3, PROFILE_U, v)
    const px = BODY.a * sp(Math.cos(th), 2 / BODY.n)
    const py = BODY.b * sp(Math.sin(th), 2 / BODY.n)
    const r = Math.hypot(px, py) || 1
    const sigma = q.x * (1 - (k * Math.abs(q.y - BODY.zw)) / r)
    return V(px * sigma, py * sigma, q.y)
  }
}

/** The parting line: where the body crosses height z (found along each profile). */
function partingLoop(z: number, taper: number) {
  const S = bodySurf(taper)
  // The profile's z rises monotonically with v: bisect for the v at height z.
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (S(0, mid).z < z) lo = mid
    else hi = mid
  }
  return Array.from({ length: 121 }, (_, i) => S(i / 120, lo).add(V(0, 0, 0.05)))
}

type DraftClass = "ok" | "low" | "under"

/** Draft of a point: faces above the parting line release upward with the cavity, those below downward with the core. */
export function draftClass(n: THREE.Vector3, z: number, parting: number, min: number): DraftClass {
  const along = z >= parting ? n.z : -n.z
  const d = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, along))))
  if (d >= min) return "ok"
  if (d > -min) return "low"
  return "under"
}

// ------------------------------------------------------------------ scene

export class CurvatureAnalysisScene extends LessonScene<CurvState> {
  private body = new THREE.Group()
  private marks = new THREE.Group()
  private mapMat = surfaceMaterial(true)
  private plainMat = surfaceMaterial()
  private partingMat: ReturnType<typeof lineMaterial>
  private mesh: THREE.Mesh | null = null
  private down: { x: number; y: number } | null = null

  constructor(v: Viewer, emit: (s: CurvState) => void) {
    super(v, emit, {
      step: 0,
      shape: "dome",
      map: "gauss",
      probe: null,
      probed: false,
      seenShapes: ["dome"],
      seenMean: [],
      dent: randomDent(),
      guesses: [],
      found: false,
      dev: "cylinder",
      unroll: 0,
      unrolledCyl: false,
      unrolledCone: false,
      triedSphere: false,
      parting: 0,
      minDraft: 1,
      taper: 0,
      undercut: 0,
      lowDraft: 0,
    })
    v.setGrid(120, 10)
    this.partingMat = lineMaterial(v, 3)
    this.own(trackResolution(v, [this.partingMat]))
    this.root.add(this.body, this.marks)

    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => (this.down = { x: e.clientX, y: e.clientY })
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
      this.onClick(e)
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
    this.v.tweens.cancel("unroll")
    const patch: Partial<CurvState> = { step, probe: null }
    if (step === 0) patch.map = "gauss"
    if (step === 1) patch.map = "mean"
    if (step === 2) Object.assign(patch, { map: "shaded", guesses: s.found ? s.guesses : [] })
    if (step === 3) patch.unroll = 0
    if (step === 4) Object.assign(patch, { parting: 0, taper: 0, ...this.draftStats(0, s.minDraft, 0) })
    this.set(patch)
    const v = this.v
    if (step <= 1) v.flyTo(V(150, -195, 150), V(0, 0, 10), 900)
    else if (step === 2) v.fit(new THREE.Box3(V(-PANEL.hx, -PANEL.hy, 0), V(PANEL.hx, PANEL.hy, 14)), { dir: V(0.12, -0.55, 1), padding: 0.92 })
    else if (step === 3) v.flyTo(V(150, -210, 150), V(0, -10, 12), 900)
    else v.flyTo(V(150, -150, 70), V(0, 0, 12), 900)
  }

  // ------------------------------------------------------------ actions

  setShape(shape: Shape) {
    const s = this.state
    this.set({
      shape,
      probe: null,
      seenShapes: s.seenShapes.includes(shape) ? s.seenShapes : [...s.seenShapes, shape],
      seenMean: s.map === "mean" && !s.seenMean.includes(shape) ? [...s.seenMean, shape] : s.seenMean,
    })
  }

  setMap(map: MapKind) {
    const s = this.state
    this.set({ map, seenMean: map === "mean" && s.step <= 1 && !s.seenMean.includes(s.shape) ? [...s.seenMean, s.shape] : s.seenMean })
  }

  newPanel() {
    this.set({ dent: randomDent(), guesses: [], found: false, map: "shaded" })
  }

  setDev(dev: DevShape) {
    this.v.tweens.cancel("unroll")
    this.set({ dev, unroll: 0 })
  }

  setUnroll(unroll: number) {
    const s = this.state
    this.set({
      unroll,
      unrolledCyl: s.unrolledCyl || (s.dev === "cylinder" && unroll >= 1),
      unrolledCone: s.unrolledCone || (s.dev === "cone" && unroll >= 1),
      triedSphere: s.triedSphere || (s.dev === "sphere" && unroll >= 0.9),
    })
  }

  playUnroll(dev?: DevShape) {
    if (dev && dev !== this.state.dev) this.setDev(dev)
    const from = this.state.unroll >= 1 ? 0 : this.state.unroll
    this.v.tweens.run(1300, (k) => this.setUnroll(Math.round((from + (1 - from) * k) * 100) / 100), { tag: "unroll" })
  }

  setParting(parting: number) {
    this.set({ parting, ...this.draftStats(parting, this.state.minDraft, this.state.taper) })
  }

  setTaper(taper: number) {
    this.set({ taper, ...this.draftStats(this.state.parting, this.state.minDraft, taper) })
  }

  /** Share of the side area that is undercut or short of draft. */
  private draftStats(parting: number, min: number, taper: number) {
    const S = bodySurf(taper)
    let total = 0
    let under = 0
    let low = 0
    for (let i = 0; i < 96; i++)
      for (let j = 0; j < 40; j++) {
        const u = (i + 0.5) / 96
        const v = (j + 0.5) / 40
        const d = derivs(S, u, v)
        const n = d.su.clone().cross(d.sv)
        const a = n.length()
        n.normalize()
        // Normals point outward when su × sv does; flip if needed.
        if (n.dot(V(d.p.x, d.p.y, d.p.z - BODY.zw)) < 0) n.negate()
        total += a
        const c = draftClass(n, d.p.z, parting, min)
        if (c === "under") under += a
        if (c === "low") low += a
      }
    return { undercut: (100 * under) / total, lowDraft: (100 * low) / total }
  }

  private onClick(e: PointerEvent) {
    const s = this.state
    if (!this.mesh || (s.step !== 0 && s.step !== 1 && s.step !== 2)) return
    const hit = this.v.pick(e, [this.mesh], false)
    if (!hit || !hit.uv) return
    if (s.step === 2) {
      if (s.found) return
      const p = hit.point
      const ok = Math.hypot(p.x - s.dent.x, p.y - s.dent.y) <= 11
      this.set({ guesses: [...s.guesses, { x: p.x, y: p.y, hit: ok }], found: ok })
      return
    }
    const c = curvature(derivs(shapeSurf(s.shape), hit.uv.x, hit.uv.y))
    this.probeUV = [hit.uv.x, hit.uv.y]
    this.set({ probe: { k1: c.k1, k2: c.k2, K: c.K, H: c.H }, probed: true })
  }

  private probeUV: [number, number] = [0.5, 0.5]

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.clear(this.body)
    this.clear(this.marks)
    this.mesh = null
    this.plainMat.color.copy(tk.model)
    this.partingMat.color.copy(tk.defined)
    if (s.step <= 1) this.renderShape()
    else if (s.step === 2) this.renderPanel()
    else if (s.step === 3) this.renderDev()
    else this.renderDraft()
    this.v.invalidate()
  }

  private colourBy(S: Surf, map: MapKind, kFull: number, hFull: number) {
    const tk = this.v.tokens
    return (u: number, v: number, _p: THREE.Vector3, out: THREE.Color) => {
      const c = curvature(derivs(S, u, v))
      diverging(map === "gauss" ? c.K / kFull : c.H / hFull, tk, out)
    }
  }

  private renderShape() {
    const s = this.state
    const kit = this.v.kit
    const S = shapeSurf(s.shape)
    const { geo } = tessellate(S, 40, 40, { colour: this.colourBy(S, s.map, K_FULL, H_FULL) })
    const mesh = new THREE.Mesh(geo, this.mapMat)
    this.mesh = mesh
    this.body.add(mesh, edgeLine(boundary(S), kit))
    if (!s.probe) return
    const [u, v] = this.probeUV
    const d = derivs(S, u, v)
    const c = curvature(d)
    const p = d.p.clone().addScaledVector(c.n, 0.3)
    // The two principal normal sections, drawn as their osculating circles (a line where the curvature is 0).
    const arc = (k: number, dir: THREE.Vector3) =>
      Array.from({ length: 33 }, (_, i) => {
        const sLen = -26 + (52 * i) / 32
        if (Math.abs(k) < 1e-5) return p.clone().addScaledVector(dir, sLen)
        const ctr = p.clone().addScaledVector(c.n, -1 / k)
        return ctr.addScaledVector(c.n, Math.cos(sLen * k) / k).addScaledVector(dir, Math.sin(sLen * k) / k)
      })
    this.marks.add(line(arc(c.k1, c.d1), kit.sketchDefined), line(arc(c.k2, c.d2), kit.sketchDefined))
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), kit.modelDark)
    dot.position.copy(p)
    this.marks.add(dot)
    const end1 = arc(c.k1, c.d1)[32]
    const end2 = arc(c.k2, c.d2)[32]
    this.marks.add(tag("k1", end1.add(V(0, 0, 3))), tag("k2", end2.add(V(0, 0, 3))))
  }

  private renderPanel() {
    const s = this.state
    const kit = this.v.kit
    const S = panelSurf(s.dent)
    const colour = s.map === "shaded" ? undefined : this.colourBy(S, s.map, 1e-4, 1 / 250)
    const { geo } = tessellate(S, 128, 88, { colour })
    const mesh = new THREE.Mesh(geo, colour ? this.mapMat : this.plainMat)
    this.mesh = mesh
    this.body.add(mesh, edgeLine(boundary(S, 96), kit))
    for (const g of s.guesses) {
      const z = S((g.x + PANEL.hx) / (2 * PANEL.hx), (g.y + PANEL.hy) / (2 * PANEL.hy)).z + 0.3
      if (g.hit) {
        const ring = Array.from({ length: 49 }, (_, i) => V(s.dent.x + 11 * Math.cos((i / 48) * Math.PI * 2), s.dent.y + 11 * Math.sin((i / 48) * Math.PI * 2), z + 0.2))
        this.marks.add(line(ring, kit.sketch))
        this.marks.add(label(t("凹坑：深 0.3 mm，直径约 25 mm", "Dent: 0.3 mm deep, about 25 mm across"), V(s.dent.x, s.dent.y + 16, z + 4), "border-primary text-primary font-sans"))
      } else {
        const cross = (a: number) => [V(g.x - a, g.y - a, z), V(g.x + a, g.y + a, z)]
        this.marks.add(line(cross(2.5), kit.sketchThin), line([V(g.x - 2.5, g.y + 2.5, z), V(g.x + 2.5, g.y - 2.5, z)], kit.sketchThin))
      }
    }
  }

  private renderDev() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    const S = devSurf(s.dev, s.unroll)
    // Developable shapes bend without stretching (green). The cap must stretch at its rim to lie flat.
    const colour = (u: number, _v: number, _p: THREE.Vector3, out: THREE.Color) => diverging(s.dev === "sphere" ? (capStretch(CAP.rho * u) * s.unroll) / 0.1 : 0, tk, out)
    const { geo } = tessellate(S, s.dev === "sphere" ? 28 : 48, s.dev === "sphere" ? 72 : 24, { colour })
    this.body.add(new THREE.Mesh(geo, this.mapMat))
    if (s.dev === "sphere") {
      const rim = Array.from({ length: 97 }, (_, i) => S(1, i / 96))
      this.body.add(edgeLine(rim, kit))
      if (s.unroll > 0.05) {
        const pct = (CAP_MAX_STRETCH * s.unroll * 100).toFixed(1)
        this.marks.add(label(t(`边缘拉长 ${pct}%`, `Rim stretched ${pct}%`), S(1, 0.875).add(V(0, 0, 8)), "border-warning text-warning font-sans"))
      }
    } else {
      this.body.add(edgeLine(boundary(S), kit))
      if (s.unroll >= 1) this.marks.add(label(t("平整摊开，没有拉伸", "Lies flat with no stretching"), S(0.5, 1).add(V(0, 0, 8)), "border-success text-success font-sans"))
    }
  }

  private renderDraft() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    const S = bodySurf(s.taper)
    const colours: Record<DraftClass, THREE.Color> = { ok: tk.good, low: tk.warn, under: tk.bad }
    const colour = (u: number, v: number, p: THREE.Vector3, out: THREE.Color) => {
      const d = derivs(S, u, v)
      const n = d.su.clone().cross(d.sv).normalize()
      if (n.dot(V(p.x, p.y, p.z - BODY.zw)) < 0) n.negate()
      out.copy(colours[draftClass(n, p.z, s.parting, s.minDraft)])
    }
    const { geo } = tessellate(S, 120, 48, { colour })
    this.body.add(new THREE.Mesh(geo, this.mapMat))
    this.body.add(edgeLine(partingLoop(0.01, s.taper), kit))
    const loop = partingLoop(s.parting, s.taper)
    this.marks.add(line(loop, this.partingMat))
    this.marks.add(label(t(`分型线 · ${s.parting.toFixed(1)} mm`, `Parting line · ${s.parting.toFixed(1)} mm`), loop[100].clone().add(V(0, -6, 3)), "font-sans"))
    this.marks.add(...pullArrows(kit, V(-BODY.a - 22, 0, s.parting)))
  }

  dispose() {
    super.dispose()
    this.mapMat.dispose()
    this.plainMat.dispose()
    this.partingMat.dispose()
  }
}

/** Two arrows from the parting line: cavity up, core down. */
function pullArrows(kit: Viewer["kit"], at: THREE.Vector3) {
  const out: THREE.Object3D[] = []
  for (const dir of [1, -1]) {
    const g = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 10), kit.modelDark)
    shaft.rotation.x = Math.PI / 2
    shaft.position.z = 8
    const head = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 16), kit.modelDark)
    head.rotation.x = Math.PI / 2
    head.position.z = 16
    g.add(shaft, head)
    g.position.copy(at)
    if (dir < 0) g.rotation.x = Math.PI
    out.push(g)
  }
  out.push(label(t("型腔 ↑ · 型芯 ↓", "Cavity ↑ · core ↓"), at.clone().add(V(-4, 0, 24)), "border-transparent bg-transparent font-sans text-muted-foreground"))
  return out
}
