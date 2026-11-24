import * as THREE from "three"
import { face, label, line } from "@/three/build"
import { lathe, type V2 } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { ANSUR, atPct, type Group } from "./anthropometry.data"
import { LessonScene } from "./scene"

/**
 * 6.2.2 「握持与把手」: a hand around a handle, seen along the handle's axis so the wrap reads as a
 * cross-section. Power grip (palm, fingers and thumb wrap the handle) or precision grip (pads only),
 * the handle's diameter and cross-section, three hand sizes, a twist test, and finger grooves.
 *
 * The hand is a simplified model: fingers are tubes that follow the handle's surface for their length,
 * the palm covers a fixed arc. Its "overlap" and "contact area" readouts come from that model and are
 * only illustrative. Hand length and breadth are ANSUR II values (see anthropometry.data.ts).
 */
export type GripKind = "power" | "precision"
export type HandSize = "f5" | "m50" | "m95"
export type Section = "round" | "oval" | "tri"

export type GripState = {
  step: number
  grip: GripKind
  diameter: number
  hand: HandSize
  section: Section
  grooves: boolean
  contact: boolean
  sawPower: boolean
  sawPrecision: boolean
  /** Hand sizes looked at in step 3. */
  hands: HandSize[]
  twisted: Section[]
  grooveMismatch: boolean
  /** A twist is being shown (for the label). */
  twisting: boolean
}

const HAND_DEF: Record<HandSize, { g: Group; pct: number }> = { f5: { g: "f", pct: 5 }, m50: { g: "m", pct: 50 }, m95: { g: "m", pct: 95 } }
export const handLength = (h: HandSize) => atPct(ANSUR.handLength[HAND_DEF[h].g], HAND_DEF[h].pct)
export const handBreadth = (h: HandSize) => atPct(ANSUR.handBreadth[HAND_DEF[h].g], HAND_DEF[h].pct)
/** Kong & Lowe (2005): the cylinder diameter rated most comfortable for maximum grip was about 19.7% of hand length. */
export const comfortDiameter = (h: HandSize) => 0.197 * handLength(h)
/** NIOSH 2004-164: single-handle tools, power tasks 1¼–2 in; precision tasks ¼–½ in. */
export const POWER_RANGE: [number, number] = [32, 51]
export const PRECISION_RANGE: [number, number] = [6, 13]

// ------------------------------------------------------------------ the hand model

/** Fractions of hand length: finger lengths (index … little) from the knuckle, thumb, palm contact arc. */
const FINGER = [0.38, 0.42, 0.39, 0.31]
const THUMB = 0.3
const PALM_ARC = 0.22

type Loop = { p: V2[]; n: V2[]; c: V2[]; s: number[]; total: number; top: number }

/** The handle's cross-section (CCW, in the YZ plane), all three shapes with the same perimeter as a circle of D. */
export function sectionPoints(section: Section, D: number, n = 180): V2[] {
  const R = D / 2
  let pts: V2[] = []
  if (section === "round") for (let i = 0; i < n; i++) pts.push([R * Math.cos((i / n) * 2 * Math.PI), R * Math.sin((i / n) * 2 * Math.PI)])
  else if (section === "oval") {
    for (let i = 0; i < n; i++) pts.push([1.3 * Math.cos((i / n) * 2 * Math.PI), 0.72 * Math.sin((i / n) * 2 * Math.PI)])
  } else {
    // Rounded triangle, flat side up: a triangle (circumradius 1) grown by a disc of radius rr.
    const rr = 0.42
    const vs = [-90, 30, 150].map((a) => (a * Math.PI) / 180)
    const per = Math.round(n / 3)
    for (let k = 0; k < 3; k++) {
      const v = vs[k]
      const a0 = v - Math.PI / 3
      const a1 = v + Math.PI / 3
      for (let i = 0; i < per; i++) {
        const a = a0 + ((a1 - a0) * i) / per
        pts.push([Math.cos(v) + rr * Math.cos(a), Math.sin(v) + rr * Math.sin(a)])
      }
    }
    // Start at the right like the others: rotate the list to the point nearest angle 0.
    let best = 0
    pts.forEach(([y, z], i) => {
      if (Math.abs(Math.atan2(z, y)) < Math.abs(Math.atan2(pts[best][1], pts[best][0]))) best = i
    })
    pts = [...pts.slice(best), ...pts.slice(0, best)]
  }
  if (section !== "round") {
    const per = perimeter(pts)
    const k = (Math.PI * D) / per
    pts = pts.map(([y, z]) => [y * k, z * k])
  }
  return pts
}

function perimeter(pts: V2[]) {
  let L = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    L += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return L
}

/** Outward normals, the finger-centre loop at `off` from the surface, its arc length, and where the top is. */
function loopOf(pts: V2[], off: number): Loop {
  const n = pts.length
  const nor: V2[] = pts.map((_, i) => {
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const ty = b[0] - a[0]
    const tz = b[1] - a[1]
    const l = Math.hypot(ty, tz) || 1
    return [tz / l, -ty / l]
  })
  const c: V2[] = pts.map((p, i) => [p[0] + nor[i][0] * off, p[1] + nor[i][1] * off])
  const s = [0]
  for (let i = 1; i <= n; i++) s.push(s[i - 1] + Math.hypot(c[i % n][0] - c[i - 1][0], c[i % n][1] - c[i - 1][1]))
  let top = 0
  pts.forEach(([y, z], i) => {
    if (z > pts[top][1] + 1e-6 || (Math.abs(z - pts[top][1]) < 1e-6 && Math.abs(y) < Math.abs(pts[top][0]))) top = i
  })
  return { p: pts, n: nor, c, s, total: s[n], top: s[top] }
}

/** Point on the loop at arc length s (wraps): finger centre, surface point and normal. */
function at(L: Loop, s: number) {
  const n = L.p.length
  s = ((s % L.total) + L.total) % L.total
  let i = 0
  while (i < n - 1 && L.s[i + 1] < s) i++
  const k = (s - L.s[i]) / Math.max(1e-9, L.s[i + 1] - L.s[i])
  const j = (i + 1) % n
  const lerp = (a: V2, b: V2): V2 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  return { c: lerp(L.c[i], L.c[j]), p: lerp(L.p[i], L.p[j]), n: lerp(L.n[i], L.n[j]) }
}

/** The wrap in the simplified model: how far the middle finger and thumb get, and their overlap (mm, < 0 is a gap). */
export function wrapOf(section: Section, D: number, h: HandSize) {
  const Lh = handLength(h)
  const rf = (handBreadth(h) / 8) * 0.95
  const loop = loopOf(sectionPoints(section, D, 120), rf)
  const need = loop.total - PALM_ARC * Lh
  const overlap = FINGER[1] * Lh + THUMB * Lh - need
  return { overlap, loop }
}

/** Contact in the simplified model, cm²: palm and fingers along their wrap (power) or three pads (precision). */
export function contactArea(s: Pick<GripState, "grip" | "diameter" | "hand" | "section">) {
  const Lh = handLength(s.hand)
  const B = handBreadth(s.hand)
  const rf = (B / 8) * 0.95
  if (s.grip === "precision") return (3 * (14 * rf * 1.3)) / 100
  const { loop } = wrapOf(s.section, s.diameter, s.hand)
  const free = loop.total - PALM_ARC * Lh
  const finger = FINGER.reduce((sum, f) => sum + Math.min(f * Lh, free) * rf * 1.3, 0)
  const thumb = Math.min(THUMB * Lh, free) * rf * 1.4
  return (PALM_ARC * Lh * B * 0.8 + finger + thumb) / 100
}

// ------------------------------------------------------------------ the scene

const initial = (): GripState => ({
  step: 0,
  grip: "power",
  diameter: 38,
  hand: "m50",
  section: "round",
  grooves: false,
  contact: false,
  sawPower: true,
  sawPrecision: false,
  hands: [],
  twisted: [],
  grooveMismatch: false,
  twisting: false,
})

/** The handle runs from X0 to X1: short on the viewer's side, so its end doesn't hide the wrap. */
const X0 = -120
const X1 = 58
/** Cyclic swap that turns a shape drawn in (y, z) and extruded along its z into a part along world X. */
const TO_X = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)

export class GripScene extends LessonScene<GripState> {
  private handle = new THREE.Group()
  private hand = new THREE.Group()
  private patches = new THREE.Group()
  private marks = new THREE.Group()
  private spin = new THREE.Group()
  private twist = 0
  private skin = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 })
  private skinSee = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false })
  private bad = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, emissiveIntensity: 0.15 })
  private touch = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })

  constructor(v: Viewer, emit: (s: GripState) => void) {
    super(v, emit, initial())
    v.setGrid(120, 10)
    for (const m of [this.skin, this.skinSee, this.bad, this.touch]) this.own(() => m.dispose())
    // The handle and the hand turn together in the twist test (the hand only when the section grips it).
    this.spin.add(this.handle, this.patches)
    this.root.add(this.spin, this.hand, this.marks)
    this.root.position.z = 70
  }

  enter(step: number) {
    this.v.tweens.cancel("twist")
    this.twist = 0
    const s = this.state
    const p: Partial<GripState> = { step, twisting: false }
    if (step === 0) Object.assign(p, { grip: s.grip, diameter: s.grip === "power" ? 38 : 10, hand: "m50", section: "round", grooves: false })
    if (step === 1) Object.assign(p, { grip: "power", diameter: 60, hand: "m50", section: "round", grooves: false, contact: false })
    if (step === 2) Object.assign(p, { grip: "power", diameter: 38, hand: "f5", section: "round", grooves: false, contact: false, hands: s.hands.includes("f5") ? s.hands : [...s.hands, "f5"] })
    if (step === 3) Object.assign(p, { grip: "power", diameter: 38, hand: "m50", section: "round", grooves: false, contact: false })
    if (step === 4) Object.assign(p, { grip: "power", diameter: 38, hand: "m50", section: "round", grooves: true, contact: false })
    this.set(p)
    this.look(step === 4 ? new THREE.Vector3(0.45, 1, 0.5) : new THREE.Vector3(1, -0.32, 0.34), step === 4 ? 470 : 430)
  }

  /** Look at the grip from `dir`, aimed left of it so it sits right of the overlay panel. */
  private look(dir: THREE.Vector3, dist: number) {
    const d = dir.clone().normalize()
    const right = new THREE.Vector3().crossVectors(d.clone().negate(), new THREE.Vector3(0, 0, 1)).normalize()
    const target = new THREE.Vector3(0, 0, 78).addScaledVector(right, -0.1 * dist)
    this.v.flyTo(target.clone().addScaledVector(d, dist), target, 800)
  }

  // ------------------------------------------------------------ actions

  setGrip(grip: GripKind) {
    const s = this.state
    this.set({
      grip,
      diameter: grip === "power" ? Math.max(s.diameter, 30) : Math.min(s.diameter, 12),
      sawPower: s.sawPower || grip === "power",
      sawPrecision: s.sawPrecision || grip === "precision",
    })
  }

  setDiameter(diameter: number) {
    this.set({ diameter })
  }

  setHand(hand: HandSize) {
    const s = this.state
    this.set({ hand, hands: s.hands.includes(hand) ? s.hands : [...s.hands, hand], grooveMismatch: s.grooveMismatch || (s.grooves && hand !== "m50") })
  }

  setSection(section: Section) {
    this.v.tweens.cancel("twist")
    this.twist = 0
    this.set({ section, twisting: false })
  }

  setGrooves(grooves: boolean) {
    const s = this.state
    this.set({ grooves, section: grooves ? "round" : s.section, grooveMismatch: s.grooveMismatch || (grooves && s.hand !== "m50") })
  }

  setContact(contact: boolean) {
    this.set({ contact })
  }

  /** Twist the handle 35° and back. A round one turns inside the hand; a shaped one takes the hand with it. */
  twistOnce() {
    const s = this.state
    this.set({ twisting: true, twisted: s.twisted.includes(s.section) ? s.twisted : [...s.twisted, s.section] })
    this.v.tweens.run(
      1600,
      (k) => {
        this.twist = THREE.MathUtils.degToRad(35) * Math.sin(Math.PI * k)
        this.place()
        if (k >= 1 && this.state.twisting) this.set({ twisting: false })
      },
      { tag: "twist" },
    )
  }

  // ------------------------------------------------------------ rendering

  /** The twist: the handle always turns; the hand turns with it unless the section is round. */
  private place() {
    this.spin.rotation.x = this.twist
    this.hand.rotation.x = this.state.section === "round" ? 0 : this.twist
    this.v.invalidate()
  }

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.skin.color.copy(tk.model).lerp(tk.modified, 0.18)
    this.skinSee.color.copy(this.skin.color)
    this.bad.color.copy(tk.bad)
    this.bad.emissive.copy(tk.bad)
    this.touch.color.copy(tk.highlight)
    this.clear(this.handle)
    this.clear(this.hand)
    this.clear(this.patches)
    this.clear(this.marks)

    const B = handBreadth(s.hand)
    const Lh = handLength(s.hand)
    const rf = (B / 8) * 0.95
    const pts = sectionPoints(s.section, s.diameter)
    const loop = loopOf(pts, rf)
    const surf = loopOf(pts, 0.4)

    this.buildHandle(pts)
    const ridge = s.grooves ? this.onRidges(B) : []
    if (s.grip === "power") this.powerHand(loop, surf, B, Lh, rf, ridge)
    else this.precisionHand(pts, B, Lh, rf)
    if (s.step === 3) this.twistArrow(s.diameter)
    this.place()
  }

  private skinMat() {
    return this.state.contact ? this.skinSee : this.skin
  }

  private buildHandle(pts: V2[]) {
    const s = this.state
    const kit = this.v.kit
    if (s.grooves) {
      // Finger grooves sized for a P50 man: a groove under each of his fingers, a ridge between.
      const g = handBreadth("m50") / 4
      const R = s.diameter / 2
      const prof: V2[] = []
      for (let x = X0; x <= X1 + 1e-6; x += 1) {
        const inGrip = Math.abs(x) <= 2 * g
        const r = inGrip ? R - 1.8 * Math.cos((2 * Math.PI * (x - g / 2)) / g) : R + 1.8
        prof.push([r, x])
      }
      const geo = lathe([[0, X0], ...prof, [0, X1]], Math.PI * 2, 48)
      geo.rotateY(Math.PI / 2)
      this.handle.add(face(geo, kit, { feature: "handle", edges: 50 }))
      return
    }
    const shape = new THREE.Shape(pts.map(([y, z]) => new THREE.Vector2(y, z)))
    const geo = new THREE.ExtrudeGeometry(shape, { depth: X1 - X0, bevelEnabled: false, curveSegments: 4 })
    geo.translate(0, 0, X0)
    geo.applyMatrix4(TO_X)
    geo.computeVertexNormals()
    const m = face(geo, kit, { feature: "handle", edges: 40 })
    this.handle.add(m)
    // A stripe along the handle, so a turn shows.
    const top = pts.reduce((a, b) => (b[1] > a[1] ? b : a))
    const z = top[1] + 0.3
    this.handle.add(line([new THREE.Vector3(X0, top[0] + 3, z), new THREE.Vector3(X1, top[0] + 3, z)], kit.sketch))
  }

  /** Fingers on ridges: those whose centre is more than a quarter pitch from a groove. */
  private onRidges(B: number) {
    const g = handBreadth("m50") / 4
    return [0, 1, 2, 3].filter((i) => {
      const x = ((3 - 2 * i) * B) / 8
      const m = (((x - g / 2) % g) + g) % g
      return Math.min(m, g - m) > g / 5
    })
  }

  /** Power grip: palm on top, fingers over the far side and under, thumb round the near side. */
  private powerHand(loop: Loop, surf: Loop, B: number, Lh: number, rf: number, ridge: number[]) {
    const ap = PALM_ARC * Lh
    const sF = loop.top - ap / 2
    const sT = loop.top + ap / 2
    const free = loop.total - ap - 2
    const mat = this.skinMat()
    // Fingers: index (i = 0) nearest the viewer at +X.
    FINGER.forEach((f, i) => {
      const x = ((3 - 2 * i) * B) / 8
      const len = Math.min(f * Lh, free)
      const pts: THREE.Vector3[] = []
      for (let d = 0; d <= len + 1e-6; d += Math.max(1.5, len / 40)) {
        const q = at(loop, sF - d)
        pts.push(new THREE.Vector3(x, q.c[0], q.c[1]))
      }
      const r = i === 3 ? rf * 0.88 : rf
      this.hand.add(this.tube(pts, r, ridge.includes(i) ? this.bad : mat))
      this.patch(surf, sF - len, sF, x - r * 0.65, x + r * 0.65)
      if (ridge.includes(i)) {
        const q = at(surf, sF - len * 0.35)
        this.marks.add(label(t("压在凸棱上", "On a ridge"), new THREE.Vector3(x + 10, q.p[0] + q.n[0] * 30, q.p[1] + q.n[1] * 30), "border-destructive text-destructive font-sans"))
      }
    })
    // Thumb, a little outside the index finger so it lies over it where they meet.
    const tx = B / 2 + rf * 0.55
    const tl = Math.min(THUMB * Lh, free)
    const tp: THREE.Vector3[] = []
    for (let d = 0; d <= tl + 1e-6; d += Math.max(1.5, tl / 30)) {
      const q = at(loop, sT + d)
      tp.push(new THREE.Vector3(tx, q.c[0] + q.n[0] * 1.5, q.c[1] + q.n[1] * 1.5))
    }
    this.hand.add(this.tube(tp, rf * 1.12, mat))
    this.patch(surf, sT, sT + tl, tx - rf * 0.7, tx + rf * 0.7)
    // Palm: from the knuckles to the heel of the hand, cupped round the handle, as thick as 0.28 B.
    const T = 0.28 * B
    const arc: V2[] = []
    for (let d = 0; d <= ap + 1e-6; d += ap / 24) arc.push(at(surf, sF + d).p)
    const zTop = Math.max(...arc.map((p) => p[1])) + T
    const shape = new THREE.Shape([...arc, [arc[arc.length - 1][0] - 6, zTop], [arc[0][0] + 6, zTop]].map(([y, z]) => new THREE.Vector2(y, z)))
    const pg = new THREE.ExtrudeGeometry(shape, { depth: B, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelOffset: -3, bevelSegments: 3, curveSegments: 4 })
    pg.translate(0, 0, -B / 2)
    pg.applyMatrix4(TO_X)
    pg.computeVertexNormals()
    this.hand.add(new THREE.Mesh(pg, mat))
    this.patch(surf, sF, sT, -B / 2 + 4, B / 2 - 4)
    // Forearm, off the heel of the hand.
    const heel = arc[arc.length - 1]
    this.hand.add(this.forearm(B, new THREE.Vector3(0, heel[0] - 4, zTop - T * 0.55), -0.35))
  }

  /** Precision grip: a thin rod pinched between the pads of thumb, index and middle finger; the palm stays clear. */
  private precisionHand(pts: V2[], B: number, Lh: number, rf: number) {
    const s = this.state
    const mat = this.skinMat()
    const R = s.diameter / 2
    const surf = loopOf(pts, 0.4)
    const T = 0.28 * B
    const palmBottom = R + 0.34 * Lh * 0.5
    const palmY0 = -0.18 * Lh
    const palmY1 = 0.12 * Lh
    const palm = new THREE.Mesh(new THREE.BoxGeometry(B, palmY1 - palmY0, T), mat)
    palm.position.set(0, (palmY0 + palmY1) / 2, palmBottom + T / 2)
    this.hand.add(palm)
    const pad = (phi: number) => {
      const a = (phi * Math.PI) / 180
      return { c: new THREE.Vector3(0, Math.cos(a) * (R + rf), Math.sin(a) * (R + rf)) }
    }
    // Index and middle reach over and down to the far top of the rod; ring and little curl in the air.
    FINGER.forEach((f, i) => {
      const x = ((3 - 2 * i) * B) / 8
      const r = i === 3 ? rf * 0.88 : rf
      const base = new THREE.Vector3(x, palmY1 - 4, palmBottom + T * 0.4)
      let tip: THREE.Vector3
      if (i < 2) {
        const phi = i === 0 ? 62 : 38
        tip = pad(phi).c.setX(x * 0.55)
        const sp = (phi / 360) * surf.total
        this.patch(surf, sp - 6, sp + 6, x * 0.55 - r * 0.6, x * 0.55 + r * 0.6)
      } else tip = new THREE.Vector3(x * 0.8, palmY1 + f * Lh * 0.35, palmBottom - f * Lh * 0.45)
      const ctrl = new THREE.Vector3(x * 0.9, Math.max(base.y, tip.y) + f * Lh * 0.35, (base.z + tip.z) / 2 + f * Lh * 0.2)
      const curve = new THREE.QuadraticBezierCurve3(base, ctrl, tip)
      this.hand.add(this.tube(curve.getPoints(24), r, mat))
    })
    // Thumb from the heel of the hand, round the near side to the bottom of the rod.
    const tipPhi = 205
    const tip = pad(tipPhi).c.setX(B * 0.25)
    const base = new THREE.Vector3(B * 0.4, palmY0 + 6, palmBottom + T * 0.2)
    const ctrl = new THREE.Vector3(B * 0.4, palmY0 - 0.12 * Lh, (base.z + tip.z) / 2)
    this.hand.add(this.tube(new THREE.QuadraticBezierCurve3(base, ctrl, tip).getPoints(24), rf * 1.12, mat))
    const st = (tipPhi / 360) * surf.total
    this.patch(surf, st - 6, st + 6, B * 0.25 - rf * 0.7, B * 0.25 + rf * 0.7)
    this.hand.add(this.forearm(B, new THREE.Vector3(0, palmY0 + 2, palmBottom + T * 0.5), -0.25))
  }

  /** Wrist and forearm, going off towards −Y from `wrist`, tilted up by `tilt` (radians). */
  private forearm(B: number, wrist: THREE.Vector3, tilt: number) {
    const len = 70
    const geo = new THREE.CylinderGeometry(B * 0.23, B * 0.26, len, 20)
    geo.translate(0, -len / 2, 0)
    geo.scale(1, 1, 0.62)
    const m = new THREE.Mesh(geo, this.skinMat())
    m.position.copy(wrist)
    m.rotation.x = tilt
    return m
  }

  /** A finger: a tube along `pts` with round ends. */
  private tube(pts: THREE.Vector3[], r: number, mat: THREE.Material) {
    const g = new THREE.Group()
    if (pts.length < 2) return g
    const curve = new THREE.CatmullRomCurve3(pts)
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length), r, 12, false), mat))
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat)
      cap.position.copy(p)
      g.add(cap)
    }
    return g
  }

  /** Contact patch on the handle surface between arc lengths s0–s1 and x0–x1 (shown with the hand see-through). */
  private patch(surf: Loop, s0: number, s1: number, x0: number, x1: number) {
    if (!this.state.contact || s1 <= s0) return
    const n = Math.max(2, Math.ceil((s1 - s0) / 1.5))
    const pos: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= n; i++) {
      const q = at(surf, s0 + ((s1 - s0) * i) / n)
      pos.push(x0, q.p[0], q.p[1], x1, q.p[0], q.p[1])
      if (i < n) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    this.patches.add(new THREE.Mesh(g, this.touch))
  }

  /** A curved arrow round the handle's end: the twist being applied. */
  private twistArrow(D: number) {
    const r = D / 2 + 14
    const x = X1 + 4
    const pts: THREE.Vector3[] = []
    for (let a = 20; a <= 120; a += 5) pts.push(new THREE.Vector3(x, r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)))
    const end = pts[pts.length - 1]
    const kit = this.v.kit
    this.marks.add(line(pts, kit.sketch))
    const tipA = (120 * Math.PI) / 180
    const back = new THREE.Vector3(x, r * Math.cos(tipA - 0.2), r * Math.sin(tipA - 0.2))
    const side = end.clone().sub(back).normalize()
    const nrm = new THREE.Vector3(0, Math.cos(tipA), Math.sin(tipA))
    this.marks.add(line([end.clone().addScaledVector(side, -5).addScaledVector(nrm, 3), end, end.clone().addScaledVector(side, -5).addScaledVector(nrm, -3)], kit.sketch))
    const s = this.state
    if (s.twisting) {
      const msg = s.section === "round" ? t("把手在手里打滑", "The handle slips in the hand") : t("棱角卡住手，手跟着转", "The corners catch the hand: it turns too")
      this.marks.add(label(msg, new THREE.Vector3(x, 0, r + 18), s.section === "round" ? "border-scene-modified font-sans" : "border-scene-good font-sans"))
    }
  }
}
