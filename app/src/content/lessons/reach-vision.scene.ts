import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { label, line } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { ANSUR, atPct, type Group } from "./anthropometry.data"
import { LessonScene } from "./scene"

/**
 * 6.2.4 「视线与可达范围」: a seated mannequin seen from the side (it faces +X), with its comfortable
 * viewing zones (from the eye) and reach envelopes (from the elbow and the shoulder). The learner drags
 * a screen and two controls; colour says how comfortable each one is, for the person shown.
 *
 * Angles: MIL-STD-1472G as quoted in the FAA's human factors design guidance (normal line of sight 15°
 * below horizontal; eye rotation alone: ±15° optimum around it, 40° up and 20° down at most) and the OSHA
 * computer workstation eTool (screen centre 15–20° below horizontal eye level, 50–100 cm away).
 * Reach: Farley's normal area (forearm swung about the elbow) and maximum area (straight arm about the
 * shoulder), with ANSUR II lengths to the fingertip. The envelopes are drawn as circles in the side
 * plane: real ones are 3D and change with posture. Guidelines, not hard limits.
 */
export type Person = "f5" | "m50" | "m95"
export type Status = "good" | "ok" | "bad"
export type P2 = [number, number]

export type ReachState = {
  step: number
  person: Person
  screen: P2
  freq: P2
  occ: P2
  persons: Person[]
  moved: boolean
  /** Step 2's guess answered: the viewing zones show. */
  revealed: boolean
}

const PERSON: Record<Person, { g: Group; pct: number }> = { f5: { g: "f", pct: 5 }, m50: { g: "m", pct: 50 }, m95: { g: "m", pct: 95 } }
const dim = (k: keyof typeof ANSUR, p: Person) => atPct(ANSUR[k][PERSON[p].g], PERSON[p].pct)

/** Lateral offset of the right shoulder from the body's midline, mm (drawing only). */
const SIDE = -190

export type Body = {
  seat: number
  eye: P2
  shoulder: P2
  elbow: P2
  normal: number
  max: number
  knee: P2
  scale: number
}

/** The mannequin's landmarks (x forward from the seat back, z up from the floor), each dimension at the person's percentile. */
export function bodyOf(p: Person): Body {
  const seat = dim("popliteal", p)
  const scale = dim("eyeSitting", p) / dim("eyeSitting", "m50")
  const shoulder: P2 = [70 * scale, seat + dim("shoulderSitting", p)]
  return {
    seat,
    eye: [135 * scale, seat + dim("eyeSitting", p)],
    shoulder,
    elbow: [shoulder[0], shoulder[1] - dim("upperArm", p)],
    normal: dim("forearmHand", p),
    max: dim("armLength", p),
    knee: [dim("buttockKnee", p) - 55 * scale, seat + 55 * scale],
    scale,
  }
}

/** Optimum and maximum viewing angles, degrees from horizontal (negative = below). */
export const NLOS = -15
export const OPT: P2 = [NLOS - 15, NLOS + 15]
export const MAXV: P2 = [NLOS - 20, NLOS + 40]
/** OSHA: screen centre 15–20° below horizontal, 500–1000 mm away. */
export const OSHA_ANGLE: P2 = [-20, -15]
export const OSHA_DIST: P2 = [500, 1000]
export const SCREEN = { w: 530, h: 310 }

export function screenView(p: Person, c: P2) {
  const b = bodyOf(p)
  const dx = c[0] - b.eye[0]
  const dz = c[1] - b.eye[1]
  const angle = THREE.MathUtils.radToDeg(Math.atan2(dz, dx))
  const dist = Math.hypot(dx, dz)
  const topAbove = c[1] + SCREEN.h / 2 - b.eye[1]
  const inRange = dist >= OSHA_DIST[0] && dist <= OSHA_DIST[1]
  const status: Status = dx <= 0 ? "bad" : angle >= OPT[0] && angle <= OPT[1] && inRange ? "good" : angle >= MAXV[0] && angle <= MAXV[1] && dist >= 400 && dist <= 1200 ? "ok" : "bad"
  return { angle, dist, topAbove, status, osha: angle >= OSHA_ANGLE[0] && angle <= OSHA_ANGLE[1] && inRange }
}

export function reachOf(p: Person, c: P2) {
  const b = bodyOf(p)
  const fromElbow = Math.hypot(c[0] - b.elbow[0], c[1] - b.elbow[1])
  const fromShoulder = Math.hypot(c[0] - b.shoulder[0], c[1] - b.shoulder[1])
  const status: Status = fromElbow <= b.normal && c[0] > b.elbow[0] ? "good" : fromShoulder <= b.max ? "ok" : "bad"
  return { fromElbow, fromShoulder, status, b }
}

/** The task of each check: the frequent control in the normal area, the occasional one within reach. */
export const freqOk = (p: Person, c: P2) => reachOf(p, c).status === "good"
export const occOk = (p: Person, c: P2) => reachOf(p, c).status !== "bad"

const START = { screen: [980, 1480] as P2, freq: [880, 760] as P2, occ: [1050, 1150] as P2 }

const initial = (): ReachState => ({ step: 0, person: "m50", screen: START.screen, freq: START.freq, occ: START.occ, persons: [], moved: false, revealed: false })

type Item = "screen" | "freq" | "occ"

export class ReachVisionScene extends LessonScene<ReachState> {
  private body = new THREE.Group()
  private zones = new THREE.Group()
  private items = new THREE.Group()
  private marks = new THREE.Group()
  private handles: Record<Item, CSS2DObject>
  private skin = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 })
  private chair = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 })
  private mats: Record<Status, THREE.MeshStandardMaterial> = {
    good: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 }),
    ok: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 }),
    bad: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, emissiveIntensity: 0.15 }),
  }
  private fill: Record<"good" | "ok", THREE.MeshBasicMaterial> = {
    good: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    ok: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide }),
  }

  constructor(v: Viewer, emit: (s: ReachState) => void) {
    super(v, emit, initial())
    v.setGrid(1600, 100)
    for (const m of [this.skin, this.chair, ...Object.values(this.mats), ...Object.values(this.fill)]) this.own(() => m.dispose())
    this.handles = { screen: this.handle("screen"), freq: this.handle("freq"), occ: this.handle("occ") }
    this.root.add(this.zones, this.body, this.items, this.marks, ...Object.values(this.handles))
  }

  enter(step: number) {
    const s = this.state
    const p: Partial<ReachState> = { step }
    if (step === 0) Object.assign(p, { person: "m50" })
    if (step === 1 || step === 2) Object.assign(p, { person: "m50" })
    if (step === 1 && !s.moved) p.screen = START.screen
    if (step === 3) Object.assign(p, { person: "f5" })
    // Step 5 starts from a screen set right for the small woman only: too low for the big man.
    if (step === 4) Object.assign(p, { person: "f5", screen: [790, 835], persons: s.persons.includes("f5") ? s.persons : [...s.persons, "f5"] })
    this.set(p)
    const dir = new THREE.Vector3(0.22, -1, 0.16).normalize()
    const center = step === 0 ? new THREE.Vector3(420, 0, 780) : new THREE.Vector3(660, 0, 900)
    const dist = step === 0 ? 3500 : 4900
    const right = new THREE.Vector3().crossVectors(dir.clone().negate(), new THREE.Vector3(0, 0, 1)).normalize()
    const target = center.clone().addScaledVector(right, -0.05 * dist)
    this.v.flyTo(target.clone().addScaledVector(dir, dist), target, 800)
  }

  // ------------------------------------------------------------ actions

  setPerson(person: Person) {
    const s = this.state
    this.set({ person, persons: s.persons.includes(person) ? s.persons : [...s.persons, person] })
  }

  reveal() {
    this.set({ revealed: true })
  }

  move(item: Item, p: P2) {
    this.set({ [item]: p, moved: true } as Partial<ReachState>)
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.skin.color.copy(tk.model).lerp(tk.modified, 0.18)
    this.chair.color.copy(tk.modelDark)
    this.mats.good.color.copy(tk.good)
    this.mats.ok.color.copy(tk.warn)
    this.mats.bad.color.copy(tk.bad)
    this.mats.bad.emissive.copy(tk.bad)
    this.fill.good.color.copy(tk.good)
    this.fill.ok.color.copy(tk.warn)
    const b = bodyOf(s.person)
    this.clear(this.body)
    this.clear(this.zones)
    this.clear(this.items)
    this.clear(this.marks)
    this.buildBody(b)
    const vision = (s.step === 1 && s.revealed) || s.step === 2 || s.step === 4
    const reach = s.step >= 3
    if (vision) this.visionZones(b)
    if (reach) this.reachZones(b)
    const showScreen = s.step >= 1 && s.step !== 3
    const showControls = s.step >= 3
    if (showScreen) this.screen(s.screen, screenView(s.person, s.screen).status, b)
    if (showControls) {
      this.control(s.freq, reachOf(s.person, s.freq).status, "freq")
      this.control(s.occ, reachOf(s.person, s.occ).status, "occ")
    }
    this.handles.screen.visible = showScreen
    this.handles.freq.visible = showControls
    this.handles.occ.visible = showControls
    this.handles.screen.position.set(s.screen[0] - 40, -SCREEN.w / 2 - 20, s.screen[1])
    this.handles.freq.position.set(s.freq[0], SIDE - 80, s.freq[1])
    this.handles.occ.position.set(s.occ[0], SIDE - 80, s.occ[1])
    this.v.invalidate()
  }

  private cyl(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
    const len = a.distanceTo(b)
    const g = new THREE.CapsuleGeometry(r, Math.max(1, len), 6, 16)
    const m = new THREE.Mesh(g, mat)
    m.position.copy(a).add(b).multiplyScalar(0.5)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    return m
  }

  /** A seated figure from capsules and a sphere, plus an adjustable chair. */
  private buildBody(b: Body) {
    const k = b.scale
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const hip = V(110 * k, 0, b.seat + 95 * k)
    const neck = V(95 * k, 0, b.shoulder[1] + 40 * k)
    const add = (o: THREE.Object3D) => this.body.add(o)
    // Chair: seat, back, column, base.
    const seatBox = new THREE.Mesh(new THREE.BoxGeometry(460 * k, 440, 50), this.chair)
    seatBox.position.set(230 * k - 20, 0, b.seat - 25)
    add(seatBox)
    const back = new THREE.Mesh(new THREE.BoxGeometry(40, 420, 480 * k), this.chair)
    back.position.set(-45, 0, b.seat + 280 * k)
    back.rotation.y = -0.08
    add(back)
    add(this.cyl(V(200 * k, 0, 70), V(200 * k, 0, b.seat - 50), 22, this.chair))
    const base = new THREE.Mesh(new THREE.BoxGeometry(560, 70, 40), this.chair)
    base.position.set(200 * k, 0, 40)
    add(base)
    // Torso, head, eye.
    add(this.cyl(hip, neck, 125 * k, this.skin))
    const head = new THREE.Mesh(new THREE.SphereGeometry(100 * k, 32, 20), this.skin)
    head.scale.set(1.05, 0.85, 1.15)
    head.position.set(b.eye[0] - 70 * k, 0, b.eye[1] + 25 * k)
    add(head)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(14 * k, 16, 10), this.chair)
    eye.position.set(b.eye[0], -60 * k, b.eye[1])
    add(eye)
    // Legs: thigh on the seat, shank down to the floor, foot.
    add(this.cyl(hip, V(b.knee[0], 0, b.knee[1]), 70 * k, this.skin))
    add(this.cyl(V(b.knee[0], 0, b.knee[1]), V(b.knee[0] - 10, 0, 90), 52 * k, this.skin))
    const foot = new THREE.Mesh(new THREE.BoxGeometry(250 * k, 100 * k, 70), this.skin)
    foot.position.set(b.knee[0] + 60 * k, 0, 35)
    add(foot)
    // Right arm, at the side: upper arm hanging, forearm forward (the "normal" posture).
    const sh = V(b.shoulder[0], SIDE, b.shoulder[1])
    const el = V(b.elbow[0], SIDE, b.elbow[1])
    add(this.cyl(sh, el, 46 * k, this.skin))
    const wrist = el.clone().add(V(b.normal - 190 * k, 0, 0))
    add(this.cyl(el, wrist, 36 * k, this.skin))
    const hand = new THREE.Mesh(new THREE.BoxGeometry(170 * k, 80 * k, 30 * k), this.skin)
    hand.position.copy(wrist).add(V(85 * k, 0, 0))
    add(hand)
    for (const c of this.body.children) {
      const m = c as THREE.Mesh
      if (m.geometry) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 40), this.v.kit.edgeSoft))
    }
    const tagCls = "font-sans text-muted-foreground"
    this.marks.add(label(t("眼", "Eye"), V(b.eye[0] + 80, -120, b.eye[1] + 95), tagCls))
    if (this.state.step === 0 || this.state.step >= 3) {
      this.marks.add(label(t("肩", "Shoulder"), V(b.shoulder[0] - 90, SIDE - 60, b.shoulder[1] + 30), tagCls))
      this.marks.add(label(t("肘", "Elbow"), V(b.elbow[0] - 90, SIDE - 60, b.elbow[1] - 20), tagCls))
    }
  }

  /** A flat sector in the side plane at `y`, centred on c, from angle a0 to a1 (degrees from horizontal). */
  private sector(c: P2, y: number, r0: number, r1: number, a0: number, a1: number, mat: THREE.Material) {
    const shape = new THREE.Shape()
    const n = 40
    const pt = (r: number, a: number) => new THREE.Vector2(c[0] + r * Math.cos((a * Math.PI) / 180), c[1] + r * Math.sin((a * Math.PI) / 180))
    shape.moveTo(pt(r0, a0).x, pt(r0, a0).y)
    for (let i = 0; i <= n; i++) shape.lineTo(pt(r1, a0 + ((a1 - a0) * i) / n).x, pt(r1, a0 + ((a1 - a0) * i) / n).y)
    for (let i = n; i >= 0; i--) shape.lineTo(pt(r0, a0 + ((a1 - a0) * i) / n).x, pt(r0, a0 + ((a1 - a0) * i) / n).y)
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(Math.PI / 2)
    const m = new THREE.Mesh(g, mat)
    m.position.y = y
    m.renderOrder = -1
    return m
  }

  private ray(c: P2, y: number, a: number, r: number) {
    const rad = (a * Math.PI) / 180
    return line([new THREE.Vector3(c[0], y, c[1]), new THREE.Vector3(c[0] + r * Math.cos(rad), y, c[1] + r * Math.sin(rad))], this.v.kit.construction)
  }

  private arc(c: P2, y: number, r: number, a0: number, a1: number) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 48; i++) {
      const a = ((a0 + ((a1 - a0) * i) / 48) * Math.PI) / 180
      pts.push(new THREE.Vector3(c[0] + r * Math.cos(a), y, c[1] + r * Math.sin(a)))
    }
    return line(pts, this.v.kit.sketchThin)
  }

  /** Viewing zones from the eye: maximum (eye rotation alone), optimum ±15° around the normal line of sight. */
  private visionZones(b: Body) {
    const s = this.state
    const R = 1250
    const e = b.eye
    this.zones.add(this.sector(e, 5, 60, R, MAXV[0], MAXV[1], this.fill.ok))
    this.zones.add(this.sector(e, 4, 60, R, OPT[0], OPT[1], this.fill.good))
    this.zones.add(this.ray(e, 0, 0, R + 80))
    this.zones.add(this.ray(e, 0, NLOS, R + 80))
    const tag = "font-sans"
    const at = (a: number, r: number) => new THREE.Vector3(e[0] + r * Math.cos((a * Math.PI) / 180), -40, e[1] + r * Math.sin((a * Math.PI) / 180))
    this.marks.add(label(t("水平", "Horizontal"), at(0, R + 170), "border-transparent bg-transparent font-sans text-faint-foreground"))
    this.marks.add(label(t("正常视线 −15°", "Normal line of sight −15°"), at(NLOS, R + 260), tag))
    if (s.step === 1) {
      this.marks.add(label(t("最佳 ±15°", "Optimum ±15°"), at(OPT[0] + 3, R - 120), "border-scene-good font-sans"))
      this.marks.add(label(t("眼动最大范围", "Eye rotation limit"), at(MAXV[1] - 4, R - 160), "border-scene-modified font-sans"))
    }
    if (s.step === 2) {
      // OSHA's preferred viewing distance.
      for (const r of OSHA_DIST) this.zones.add(this.arc(e, -2, r, MAXV[0], MAXV[1]))
      this.marks.add(label("500", at(MAXV[0] - 3, OSHA_DIST[0]), "border-transparent bg-transparent font-sans text-faint-foreground"))
      this.marks.add(label("1000 mm", at(MAXV[0] - 3, OSHA_DIST[1]), "border-transparent bg-transparent font-sans text-faint-foreground"))
    }
  }

  /** Reach envelopes in the plane of the right arm: normal (forearm about the elbow), maximum (arm about the shoulder). */
  private reachZones(b: Body) {
    this.zones.add(this.sector(b.shoulder, SIDE + 6, 0, b.max, -70, 90, this.fill.ok))
    this.zones.add(this.sector(b.elbow, SIDE + 4, 0, b.normal, -45, 90, this.fill.good))
    this.zones.add(this.arc(b.shoulder, SIDE, b.max, -70, 90))
    this.zones.add(this.arc(b.elbow, SIDE, b.normal, -45, 90))
    const at = (c: P2, r: number, a: number) => new THREE.Vector3(c[0] + r * Math.cos((a * Math.PI) / 180), SIDE - 40, c[1] + r * Math.sin((a * Math.PI) / 180))
    this.marks.add(label(t(`正常作业区 · 前臂 ${b.normal.toFixed(0)}`, `Normal area · forearm ${b.normal.toFixed(0)}`), at(b.elbow, b.normal * 0.55, 62), "border-scene-good font-sans"))
    this.marks.add(label(t(`最大可达区 · 手臂 ${b.max.toFixed(0)}`, `Maximum reach · arm ${b.max.toFixed(0)}`), at(b.shoulder, b.max + 60, 68), "border-scene-modified font-sans"))
  }

  /** The screen, facing the eye, on a thin stand. */
  private screen(c: P2, st: Status, b: Body) {
    const g = new THREE.Group()
    const panel = new THREE.Mesh(new THREE.BoxGeometry(24, SCREEN.w, SCREEN.h), this.mats[st])
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(4, SCREEN.w - 30, SCREEN.h - 30), this.chair)
    bezel.position.x = -13
    g.add(panel, bezel)
    // Tilt so the face is square to the line of sight.
    const a = Math.atan2(c[1] - b.eye[1], c[0] - b.eye[0])
    g.rotation.y = -a
    g.position.set(c[0], 0, c[1])
    panel.add(new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), this.v.kit.edge))
    this.items.add(g)
    this.items.add(this.cyl(new THREE.Vector3(c[0] + 26, 0, 0), new THREE.Vector3(c[0] + 26, 0, c[1]), 12, this.chair))
    // Line of sight to the centre.
    this.items.add(line([new THREE.Vector3(b.eye[0], -6, b.eye[1]), new THREE.Vector3(c[0], -6, c[1])], this.v.kit.sketchThin))
  }

  private control(c: P2, st: Status, which: "freq" | "occ") {
    const g = new THREE.Group()
    if (which === "freq") {
      const box = new THREE.Mesh(new THREE.BoxGeometry(140, 110, 60), this.mats[st])
      box.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), this.v.kit.edge))
      g.add(box)
    } else {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(48, 48, 50, 32), this.mats[st])
      knob.rotation.z = Math.PI / 2
      knob.add(new THREE.LineSegments(new THREE.EdgesGeometry(knob.geometry, 40), this.v.kit.edge))
      g.add(knob)
    }
    g.position.set(c[0], SIDE, c[1])
    this.items.add(g)
    this.items.add(this.cyl(new THREE.Vector3(c[0], SIDE, 0), new THREE.Vector3(c[0], SIDE, c[1] - 40), 10, this.chair))
    const name = which === "freq" ? t("常用按键", "Frequent control") : t("偶尔用的旋钮", "Occasional knob")
    this.marks.add(label(name, new THREE.Vector3(c[0] + 110, SIDE - 80, c[1] + 110), st === "good" ? "border-scene-good font-sans" : st === "ok" ? "border-scene-modified font-sans" : "border-destructive text-destructive font-sans"))
  }

  /** A drag dot for an item, moving it in its side plane. */
  private handle(item: Item) {
    const el = document.createElement("div")
    el.className = "interactive size-4 rounded-full border-2 border-primary bg-background cursor-grab shadow-popover transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("拖动", "Drag")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const y = item === "screen" ? 0 : SIDE
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y)
      const start = this.v.rayOnPlane(e, plane)
      const p0 = this.state[item]
      const moveFn = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit || !start) return
        const x = Math.round(Math.max(150, Math.min(1700, p0[0] + hit.x - start.x)) / 5) * 5
        const z = Math.round(Math.max(item === "screen" ? SCREEN.h / 2 + 20 : 80, Math.min(1900, p0[1] + hit.z - start.z)) / 5) * 5
        this.move(item, [x, z])
      }
      const up = () => {
        el.removeEventListener("pointermove", moveFn)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", moveFn)
      el.addEventListener("pointerup", up)
    })
    return o
  }
}
