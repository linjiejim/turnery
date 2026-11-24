import * as THREE from "three"
import type { Line2 } from "three/addons/lines/Line2.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { face, label, line } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { lineAngle, projectCircle, screenToWorld, type ScreenEllipse } from "./perspective-ellipses.conic"
import { LessonScene } from "./scene"

/**
 * 6.4.1 「透视与椭圆」: the viewport camera is the eye. A box floats at a known height; the learner
 * moves the eye up and down (the horizon line is always at eye height), turns the box (two vanishing
 * points on the horizon, or one), and looks down at it (verticals converge to a third). Then a
 * cylinder: its end ellipses are computed exactly from the camera (perspective-ellipses.conic.ts), the
 * learner drags a line onto the minor axis, and it lines up with the cylinder's axis. Last, five rings
 * on a column: the further a ring is from the horizon, the rounder its ellipse.
 *
 * Every construction line is rebuilt from the real camera whenever it moves, so what is drawn is the
 * true perspective of what is rendered.
 */
export type Visit = "below" | "through" | "above"

export type PerspState = {
  step: number
  /** Eye height, mm. */
  eye: number
  /** Box turned about the vertical, degrees (0 and 90: a face square to the view). */
  yaw: number
  /** Look at the box (camera pitches) instead of straight ahead. */
  aim: boolean
  seen: Visit[]
  oneSeen: boolean
  twoSeen: boolean
  /** Cylinder: turned about the vertical, and tilted from upright, degrees. */
  cylYaw: number
  cylTilt: number
  /** The learner's minor axis: the screen direction of its handle, degrees (a line, so ±180° is the same answer). */
  guess: number
  /** Angle between the guess and the true minor axis on the last release, degrees. */
  err: number | null
  revealed: boolean
  /** Poses where the guess landed within tolerance. */
  matched: string[]
  /** Step 5: degree labels on the rings. */
  degShown: boolean
}

/** The box: 120 × 80 × 80 mm, floating from z = 70 to 150 (as if on a glass shelf). */
export const BOX = { hx: 60, hy: 40, hz: 40, z: 110 }
export const BOX_BOTTOM = BOX.z - BOX.hz
export const BOX_TOP = BOX.z + BOX.hz
/** Eye distance from the box (and the column), mm. */
const DIST = 480
const RING_DIST = 320
/** Camera field of view for this lesson: a normal-to-wide lens, so vanishing points come near the picture. */
const FOV = 50
/** Rings on the column, mm. */
export const RINGS = [40, 85, 130, 175, 220]
export const COLUMN = { r: 30, z0: 20, z1: 240, mid: 130 }
const CYL = { r: 34, len: 130, z: 110 }
/** Within this angle the guessed minor axis counts as right, degrees. */
export const TOL = 4

export const visitOf = (eye: number): Visit => (eye < BOX_BOTTOM ? "below" : eye > BOX_TOP ? "above" : "through")
/** Camera pitch, degrees, positive looking down. */
export const pitchOf = (s: Pick<PerspState, "aim" | "eye" | "step">) =>
  s.step === 4 ? THREE.MathUtils.radToDeg(Math.atan((s.eye - COLUMN.mid) / RING_DIST)) : s.aim ? THREE.MathUtils.radToDeg(Math.atan((s.eye - BOX.z) / DIST)) : 0

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const deg = THREE.MathUtils.degToRad

/** Unit axis of the cylinder from its two angles. */
const cylAxis = (yaw: number, tilt: number) => V(Math.sin(deg(tilt)) * Math.cos(deg(yaw)), Math.sin(deg(tilt)) * Math.sin(deg(yaw)), Math.cos(deg(tilt)))

export class PerspectiveScene extends LessonScene<PerspState> {
  private model = new THREE.Group()
  private guides = new THREE.Group()
  private fov0: number
  private sig = ""
  private mats: LineMaterial[] = []
  private hl = this.lm(2)
  private vp1 = this.lm(1.4)
  private vp2 = this.lm(1.4)
  private vp3 = this.lm(1.4)
  private ellipseMat = this.lm(2.2)
  private hiddenMat = this.lm(1.6, true)
  private guessMat = this.lm(2.4)
  private minorMat = this.lm(2.4)
  private axisMat = this.lm(1.4, true)
  /** The ellipse the guess hangs on, from the last construction. */
  private ell: ScreenEllipse | null = null
  private axisScreen = 0
  private handle: CSS2DObject

  constructor(v: Viewer, emit: (s: PerspState) => void) {
    super(v, emit, {
      step: 0,
      eye: 200,
      yaw: 25,
      aim: false,
      seen: [],
      oneSeen: false,
      twoSeen: false,
      cylYaw: 35,
      cylTilt: 65,
      guess: 0,
      err: null,
      revealed: false,
      matched: [],
      degShown: false,
    })
    this.fov0 = v.camera.fov
    v.camera.fov = FOV
    v.camera.updateProjectionMatrix()
    v.showGrid(false)
    this.handle = this.makeHandle()
    this.root.add(this.model, this.guides, this.handle)
    this.own(
      v.onFrame(() => {
        const c = v.camera
        const sig = [c.position.x, c.position.y, c.position.z, c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w].map((n) => n.toFixed(4)).join() + `${v.size.w}x${v.size.h}`
        if (sig === this.sig) return false
        this.sig = sig
        this.construct()
        return true
      }),
    )
  }

  private lm(width: number, dashed = false) {
    const m = new LineMaterial({ linewidth: width, worldUnits: false, dashed, dashSize: 6, gapSize: 4, depthTest: false, transparent: true })
    this.mats.push(m)
    return m
  }

  enter(step: number) {
    const v = this.v
    v.tweens.cancel("camera")
    const patch: Partial<PerspState> = { step }
    if (step === 0) Object.assign(patch, { eye: 200, yaw: 25, aim: false })
    if (step === 1) Object.assign(patch, { eye: 210, yaw: 25, aim: false })
    if (step === 2) Object.assign(patch, { eye: 230, yaw: 30, aim: false })
    if (step === 3) Object.assign(patch, { cylYaw: 35, cylTilt: 65, err: null, revealed: false })
    if (step === 4) Object.assign(patch, { eye: COLUMN.mid, aim: true, degShown: false })
    v.controls.enabled = step === 3
    this.set(patch)
    if (step === 3) {
      v.flyTo(V(-170, -430, 290), V(0, 0, CYL.z), 900).then(() => {
        // Start the guess well off the answer, so there is something to find.
        if (this.state.step === 3 && this.ell) this.set({ guess: (THREE.MathUtils.radToDeg(this.ell.minor) + 58) % 180 })
      })
    } else this.place(900)
  }

  // ------------------------------------------------------------ actions

  setEye(eye: number) {
    const s = this.state
    const seen = s.step === 0 && !s.seen.includes(visitOf(eye)) ? [...s.seen, visitOf(eye)] : s.seen
    this.set({ eye, seen })
    this.place(0)
  }

  setYaw(yaw: number) {
    const s = this.state
    this.set({ yaw, oneSeen: s.oneSeen || yaw <= 1 || yaw >= 89, twoSeen: s.twoSeen || (yaw >= 15 && yaw <= 75) })
  }

  setAim(aim: boolean) {
    this.set({ aim })
    this.place(700)
  }

  setCylinder(cylYaw: number, cylTilt: number) {
    this.set({ cylYaw, cylTilt, err: null, revealed: false })
  }

  reveal() {
    this.set({ revealed: true })
  }

  showDegrees() {
    this.set({ degShown: true })
  }

  /** Put the camera at the eye: straight ahead, or looking at the box / column. */
  private place(ms: number) {
    const s = this.state
    if (s.step === 3) return
    const ring = s.step === 4
    const d = ring ? RING_DIST : DIST
    const z = ring ? COLUMN.mid : BOX.z
    const eye = V(0, -d, s.eye)
    const target = ring || s.aim ? V(0, 0, z) : V(0, 0, s.eye)
    this.v.flyTo(eye, target, ms)
  }

  // ------------------------------------------------------------ model

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.hl.color.copy(tk.defined)
    this.vp1.color.copy(tk.highlight)
    this.vp2.color.copy(tk.modified)
    this.vp3.color.copy(tk.good)
    this.ellipseMat.color.copy(tk.highlight)
    this.hiddenMat.color.copy(tk.highlight)
    this.guessMat.color.copy(tk.modified)
    this.minorMat.color.copy(tk.highlight)
    this.axisMat.color.copy(tk.defined)
    this.clear(this.model)
    if (s.step <= 2) {
      const g = new THREE.BoxGeometry(BOX.hx * 2, BOX.hy * 2, BOX.hz * 2)
      g.rotateZ(deg(s.yaw))
      g.translate(0, 0, BOX.z)
      this.model.add(face(g, kit, { feature: "box" }))
    } else if (s.step === 3) {
      const a = cylAxis(s.cylYaw, s.cylTilt)
      const g = new THREE.CylinderGeometry(CYL.r, CYL.r, CYL.len, 72, 1)
      g.rotateX(Math.PI / 2)
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), a))
      g.translate(0, 0, CYL.z)
      this.model.add(face(g, kit, { feature: "cylinder" }))
    } else {
      // An open tube, so its rims don't read as extra rings.
      const g = new THREE.CylinderGeometry(COLUMN.r, COLUMN.r, COLUMN.z1 - COLUMN.z0, 72, 1, true)
      g.rotateX(Math.PI / 2)
      g.translate(0, 0, (COLUMN.z0 + COLUMN.z1) / 2)
      this.model.add(face(g, kit, { feature: "column", role: "ghost", edges: false }))
    }
    this.construct()
  }

  // ------------------------------------------------------------ construction (camera dependent)

  private construct() {
    const v = this.v
    const cam = v.camera
    cam.updateMatrixWorld()
    for (const m of this.mats) m.resolution.set(v.size.w, v.size.h)
    this.clear(this.guides)
    const s = this.state
    this.handle.visible = false
    if (s.step <= 2) this.boxGuides()
    else if (s.step === 3) this.cylinderGuides()
    else this.ringGuides()
    v.invalidate()
  }

  private add(o: THREE.Object3D) {
    if ((o as Line2).isLine2) o.renderOrder = 3
    this.guides.add(o)
  }

  private forward() {
    return this.v.forward(new THREE.Vector3())
  }

  /** The horizon: the image of the horizontal plane through the eye. */
  private horizon(name: string) {
    const cam = this.v.camera
    const f = this.forward()
    const fh = V(f.x, f.y, 0)
    if (fh.lengthSq() < 1e-6) return
    fh.normalize()
    const right = V(fh.y, -fh.x, 0)
    const mid = cam.position.clone().addScaledVector(fh, 8000)
    this.add(line([mid.clone().addScaledVector(right, -12000), mid.clone().addScaledVector(right, 12000)], this.hl))
    const at = cam.position.clone().addScaledVector(fh, 1000).addScaledVector(right, -1000 * Math.tan(deg(19)))
    const tagEl = label(name, at, "border-transparent bg-transparent font-sans font-medium text-foreground")
    tagEl.center.set(0.5, 1.25)
    this.add(tagEl)
  }

  private boxGuides() {
    const s = this.state
    this.horizon(t(`视平线 · 眼高 ${Math.round(s.eye)} mm`, `Horizon line · eye height ${Math.round(s.eye)} mm`))
    if (s.step === 0) return
    const cam = this.v.camera
    const f = this.forward()
    const yaw = deg(s.yaw)
    const c = V(0, 0, BOX.z)
    const ex = V(Math.cos(yaw), Math.sin(yaw), 0)
    const ey = V(-Math.sin(yaw), Math.cos(yaw), 0)
    const ez = V(0, 0, 1)
    const corner = (sx: number, sy: number, sz: number) => c.clone().addScaledVector(ex, sx * BOX.hx).addScaledVector(ey, sy * BOX.hy).addScaledVector(ez, sz * BOX.hz)
    const families: { name: string; d: THREE.Vector3; mat: LineMaterial; tone: string; edges: [THREE.Vector3, THREE.Vector3][] }[] = [
      { name: "VP1", d: ex, mat: this.vp1, tone: "border-primary text-primary", edges: [-1, 1].flatMap((a) => [-1, 1].map((b) => [corner(-1, a, b), corner(1, a, b)] as [THREE.Vector3, THREE.Vector3])) },
      { name: "VP2", d: ey, mat: this.vp2, tone: "border-scene-modified text-scene-modified", edges: [-1, 1].flatMap((a) => [-1, 1].map((b) => [corner(a, -1, b), corner(a, 1, b)] as [THREE.Vector3, THREE.Vector3])) },
    ]
    if (s.step === 2)
      families.push({ name: "VP3", d: ez, mat: this.vp3, tone: "border-scene-good text-scene-good", edges: [-1, 1].flatMap((a) => [-1, 1].map((b) => [corner(a, b, -1), corner(a, b, 1)] as [THREE.Vector3, THREE.Vector3])) })
    for (const fam of families) {
      const dot = fam.d.dot(f)
      if (Math.abs(dot) < 0.02) {
        // Parallel to the picture: these edges stay parallel and have no vanishing point.
        for (const [p, q] of fam.edges) this.add(line([p.clone().addScaledVector(fam.d, -90), q.clone().addScaledVector(fam.d, 90)], fam.mat))
        const where = fam.name === "VP3" ? V(-BOX.hx - 110, 0, BOX.z) : V(0, 0, BOX_BOTTOM - 26)
        this.add(label(t(`这组边与画面平行：不汇聚，没有 ${fam.name}`, `These edges are parallel to the picture: they don't converge, so there's no ${fam.name}`), where, `${fam.tone} font-sans`))
        continue
      }
      const d = fam.d.clone().multiplyScalar(Math.sign(dot))
      for (const [p, q] of fam.edges) {
        const near = p.dot(d) < q.dot(d) ? p : q
        this.add(line([near, near.clone().addScaledVector(d, 12000)], fam.mat))
      }
      this.vpMarker(fam.name, cam.position.clone().addScaledVector(d, 9000), fam.tone)
    }
  }

  /** A vanishing point's label: on it when it's in the picture, at the edge with an arrow when it's off. */
  private vpMarker(name: string, p: THREE.Vector3, tone: string) {
    const v = this.v
    const { w, h } = v.size
    const sp = v.project(p)
    const m = 12
    const dx = sp.x - w / 2
    const dy = sp.y - h / 2
    const k = Math.min(1, dx ? (w / 2 - m) / Math.abs(dx) : Infinity, dy ? (h / 2 - m) / Math.abs(dy) : Infinity)
    if (k >= 1) {
      const tagEl = label(name, p, `${tone} font-sans font-medium`)
      tagEl.center.set(0.5, 1.35)
      this.add(tagEl)
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), this.v.kit.highlight)
      dot.position.copy(p)
      dot.scale.setScalar(v.worldPerPixel(p) * 4)
      this.add(dot)
      return
    }
    const x = w / 2 + dx * k
    const y = h / 2 + dy * k
    const arrow = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "→" : "←") : dy > 0 ? "↓" : "↑"
    const text = arrow === "←" || arrow === "↑" ? `${arrow} ${name}` : `${name} ${arrow}`
    const ref = v.camera.position.clone().addScaledVector(this.forward(), 1000)
    const at = screenToWorld(v.camera, w, h, x, y, ref)
    const tagEl = label(t(`${text}（在画面外）`, `${text} (off the picture)`), at, `${tone} font-sans`)
    // Anchor the tag on its edge of the view, so it stays inside.
    if (arrow === "→") tagEl.center.set(1, 0.5)
    else if (arrow === "←") tagEl.center.set(0, 0.5)
    else if (arrow === "↓") tagEl.center.set(0.5, 1)
    else tagEl.center.set(0.5, 0)
    this.add(tagEl)
  }

  private cylinderGuides() {
    const s = this.state
    const v = this.v
    const cam = v.camera
    const { w, h } = v.size
    const a = cylAxis(s.cylYaw, s.cylTilt)
    const c = V(0, 0, CYL.z)
    const ends = [c.clone().addScaledVector(a, CYL.len / 2), c.clone().addScaledVector(a, -CYL.len / 2)]
    const toEye = (p: THREE.Vector3) => cam.position.clone().sub(p)
    // The visible end faces the eye.
    const facing = ends.map((p, i) => toEye(p).normalize().dot(a) * (i === 0 ? 1 : -1))
    const vis = facing[0] >= facing[1] ? 0 : 1
    const ells = ends.map((p) => projectCircle(cam, w, h, p, a, CYL.r))
    ends.forEach((p, i) => {
      const ring: THREE.Vector3[] = []
      const e1 = new THREE.Vector3().crossVectors(a, Math.abs(a.z) < 0.9 ? V(0, 0, 1) : V(1, 0, 0)).normalize()
      const e2 = new THREE.Vector3().crossVectors(a, e1)
      for (let k = 0; k <= 96; k++) {
        const th = (k / 96) * Math.PI * 2
        ring.push(p.clone().addScaledVector(e1, Math.cos(th) * CYL.r).addScaledVector(e2, Math.sin(th) * CYL.r))
      }
      this.add(line(ring, i === vis ? this.ellipseMat : this.hiddenMat))
    })
    const e = ells[vis]
    this.ell = e
    if (!e) return
    // The axis on screen: through the images of both end centres.
    const p0 = v.project(ends[0])
    const p1 = v.project(ends[1])
    this.axisScreen = Math.atan2(p1.y - p0.y, p1.x - p0.x)
    const ref = ends[vis]
    const W = (x: number, y: number) => screenToWorld(cam, w, h, x, y, ref)
    const seg = (ang: number, len: number) => {
      const u = [Math.cos(ang), Math.sin(ang)]
      return [W(e.cx - u[0] * len, e.cy - u[1] * len), W(e.cx + u[0] * len, e.cy + u[1] * len)]
    }
    // Degree of the visible ellipse.
    // To the right along the major axis.
    const flip = Math.cos(e.minor + Math.PI / 2) < 0 ? -1 : 1
    const mx = Math.cos(e.minor + Math.PI / 2) * flip
    const my = Math.sin(e.minor + Math.PI / 2) * flip
    const tagAt = W(e.cx + mx * (e.a + 14), e.cy + my * (e.a + 14))
    const tagEl = label(t(`椭圆 ${Math.round(e.degree)}°`, `${Math.round(e.degree)}° ellipse`), tagAt, "font-sans")
    tagEl.center.set(0, 0.5)
    this.add(tagEl)
    // The learner's line.
    const g = deg(s.guess)
    const len = e.a + 46
    this.add(line(seg(g, len), this.guessMat))
    this.handle.visible = true
    this.handle.position.copy(W(e.cx + Math.cos(g) * len, e.cy + Math.sin(g) * len))
    if (s.revealed) {
      for (const el of ells) {
        if (!el) continue
        const u = [Math.cos(el.minor), Math.sin(el.minor)]
        const l = el.b + 26
        this.add(line([W(el.cx - u[0] * l, el.cy - u[1] * l), W(el.cx + u[0] * l, el.cy + u[1] * l)], this.minorMat))
      }
      this.add(line([ends[1].clone().addScaledVector(a, -70), ends[0].clone().addScaledVector(a, 70)], this.axisMat))
      const off = THREE.MathUtils.radToDeg(lineAngle(e.minor, this.axisScreen))
      const tip = ends[vis].clone().addScaledVector(a, vis === 0 ? 74 : -74)
      const note = label(
        t(`轴线：和短轴相差 ${off < 0.05 ? "0.0" : off.toFixed(1)}°`, `Axis: ${off < 0.05 ? "0.0" : off.toFixed(1)}° from the minor axis`),
        tip,
        "border-transparent bg-transparent font-sans text-muted-foreground",
      )
      this.add(note)
    }
  }

  private ringGuides() {
    const s = this.state
    const v = this.v
    const cam = v.camera
    const { w, h } = v.size
    this.horizon(t(`视平线 · 眼高 ${Math.round(s.eye)} mm`, `Horizon line · eye height ${Math.round(s.eye)} mm`))
    const up = V(0, 0, 1)
    this.add(line([V(0, 0, COLUMN.z0 - 30), V(0, 0, COLUMN.z1 + 30)], this.axisMat))
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
    for (const z of RINGS) {
      const c = V(0, 0, z)
      const ring: THREE.Vector3[] = []
      for (let k = 0; k <= 96; k++) {
        const th = (k / 96) * Math.PI * 2
        ring.push(V(Math.cos(th) * COLUMN.r, Math.sin(th) * COLUMN.r, z))
      }
      this.add(line(ring, this.ellipseMat))
      const e = projectCircle(cam, w, h, c, up, COLUMN.r)
      if (!e) continue
      const W = (x: number, y: number) => screenToWorld(cam, w, h, x, y, c)
      const u = [Math.cos(e.minor), Math.sin(e.minor)]
      const l = e.b + 10
      this.add(line([W(e.cx - u[0] * l, e.cy - u[1] * l), W(e.cx + u[0] * l, e.cy + u[1] * l)], this.guessMat))
      if (s.degShown) {
        const flat = e.degree < 1.5
        const el = label(flat ? t("0° · 一条直线", "0° · a straight line") : `${Math.round(e.degree)}°`, c.clone().addScaledVector(right, COLUMN.r + 10), flat ? "font-sans border-primary text-primary" : "font-sans")
        el.center.set(0, 0.5)
        this.add(el)
      }
    }
  }

  // ------------------------------------------------------------ the guess handle

  private makeHandle() {
    const el = document.createElement("div")
    el.className = "interactive size-4 rounded-full border-2 border-scene-modified bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("拖动，转这条线", "Drag to turn this line")
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const move = (ev: PointerEvent) => {
        const r = this.v.renderer.domElement.getBoundingClientRect()
        const ellipse = this.ell
        if (!ellipse) return
        // The handle stays under the pointer: keep the full direction; the comparison ignores which end.
        const a = THREE.MathUtils.radToDeg(Math.atan2(ev.clientY - r.top - ellipse.cy, ev.clientX - r.left - ellipse.cx))
        this.set({ guess: Math.round(a * 2) / 2, err: null })
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        this.v.controls.enabled = this.state.step === 3
        this.judge()
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
    })
    return new CSS2DObject(el)
  }

  /** Compare the guess with the true minor axis of the visible ellipse. */
  private judge() {
    const s = this.state
    const e = this.ell
    if (!e) return
    const err = THREE.MathUtils.radToDeg(lineAngle(deg(s.guess), e.minor))
    const ok = err <= TOL
    const key = `${Math.round(s.cylYaw / 10)}/${Math.round(s.cylTilt / 10)}`
    this.set({ err, revealed: s.revealed || ok, matched: ok && !s.matched.includes(key) ? [...s.matched, key] : s.matched })
  }

  dispose() {
    const v = this.v
    v.camera.fov = this.fov0
    v.camera.updateProjectionMatrix()
    v.showGrid(true)
    v.controls.enabled = true
    super.dispose()
    for (const m of this.mats) m.dispose()
  }
}
