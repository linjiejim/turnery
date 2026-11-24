import * as THREE from "three"
import { edgeLine, face, label, linearDim, line } from "@/three/build"
import { extrude, lathe, roundedRect, sweepEllipse, type V2 } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { DARK, DESIGN, HAND_BREADTH, layout, LEVEL, measure, type Kettle, type Measure, type Part } from "./proportion-scale.model"

/**
 * 6.1.4 「比例、体块与尺度」: an electric kettle made of a primary mass (the
 * body), secondary masses (base, lid, handle, spout) and tertiary details
 * (knob, switch). Sliders change the proportions; the front silhouette's
 * centroid (dark parts weighted) is drawn as the visual centre of mass,
 * with a plumb line and the tipping angles. A real-size hand can stand
 * beside it, and the whole product can be scaled from 5 cm to 50 cm, with
 * the handle either scaling too or keeping the size the hand needs.
 */
export type PropState = Kettle & {
  step: number
  levels: boolean
  silhouette: boolean
  showHand: boolean
  seenSil: boolean
  /** Sliders moved (bit per slider). */
  touched: number
  seenSmall: boolean
  seenLarge: boolean
  m: Measure
}

export const START: Record<number, Partial<Kettle & { levels: boolean; silhouette: boolean; showHand: boolean }>> = {
  0: { ...DESIGN, levels: true, silhouette: false, showHand: false },
  1: { ...DESIGN, baseH: 50, lidH: 50, bodyH: 120, handle: 1.4, levels: true, silhouette: false, showHand: false },
  2: { ...DESIGN, levels: false, silhouette: false, showHand: false },
  3: { ...DESIGN, taper: 1, levels: false, silhouette: false, showHand: false },
  4: { ...DESIGN, levels: false, silhouette: false, showHand: true },
  5: { ...DESIGN, scale: 1.5, levels: false, silhouette: false, showHand: true },
}

const SLIDER_BITS: Partial<Record<keyof Kettle, number>> = { bodyH: 1, bodyD: 2, taper: 4, baseH: 8, lidH: 16, handle: 32, spout: 64 }

export const designHeight = (p: Kettle) => layout({ ...p, scale: 1 }).height

export class PropScene extends LessonScene<PropState> {
  private kettle = new THREE.Group()
  private marks = new THREE.Group()
  private hand = new THREE.Group()
  private flatMat = new THREE.MeshBasicMaterial()
  private skinMat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 })
  private fitTimer = 0

  constructor(v: Viewer, emit: (s: PropState) => void) {
    super(v, emit, { ...DESIGN, step: 0, levels: true, silhouette: false, showHand: false, seenSil: false, touched: 0, seenSmall: false, seenLarge: false, m: measure(DESIGN) })
    v.setGrid(400, 10)
    this.buildHand()
    this.root.add(this.kettle, this.marks, this.hand)
  }

  enter(step: number) {
    this.update({ step, ...START[step] })
    this.frame(900)
  }

  // ------------------------------------------------------------ actions

  setParam(key: keyof Kettle, value: number) {
    this.update({ [key]: value, touched: this.state.touched | (SLIDER_BITS[key] ?? 0) })
  }

  /** Overall size, as the product's height in mm. */
  setHeight(h: number) {
    const scale = h / designHeight(this.state)
    this.update({ scale, seenSmall: this.state.seenSmall || h <= 70, seenLarge: this.state.seenLarge || h >= 400 })
    window.clearTimeout(this.fitTimer)
    this.fitTimer = window.setTimeout(() => this.frame(500), 220)
  }

  setFlag(key: "levels" | "silhouette" | "showHand" | "humanHandle" | "darkHeavy", on: boolean) {
    const patch: Partial<PropState> = { [key]: on }
    if (key === "silhouette" && on) patch.seenSil = true
    if (key === "levels" && on) patch.silhouette = false
    if (key === "silhouette" && on) patch.levels = false
    this.update(patch)
    if (key === "showHand" || key === "humanHandle") this.frame(500)
  }

  private update(patch: Partial<PropState>) {
    const next = { ...this.state, ...patch }
    this.set({ ...patch, m: measure(next) })
  }

  private frame(ms: number) {
    const s = this.state
    const L = layout(s)
    const box = new THREE.Box3(new THREE.Vector3(L.xMin - 20, -L.r0, 0), new THREE.Vector3(L.xMax + 20, L.r0, L.top))
    if (s.showHand) box.union(this.hand.userData.box as THREE.Box3)
    // The centroid is measured on the front outline: draw that view without perspective so the marks sit on it.
    this.v.setProjection(s.step === 2 || s.step === 3 ? "orthographic" : "perspective")
    const dir = s.step === 2 || s.step === 3 ? new THREE.Vector3(0, -1, 0.0001) : s.step >= 4 ? new THREE.Vector3(0.22, -1, 0.2) : new THREE.Vector3(0.6, -1, 0.42)
    this.v.fit(box, { dir, padding: s.step === 2 || s.step === 3 ? 1.05 : 1.12, animate: ms > 0 })
  }

  // ------------------------------------------------------------ rendering

  private materialFor(part: Part): THREE.Material {
    const s = this.state
    const kit = this.v.kit
    if (s.silhouette) return this.flatMat
    if (s.levels) return LEVEL[part] === 1 ? kit.model : LEVEL[part] === 2 ? kit.highlight : kit.modified
    if (part === "switch") return kit.metal
    return DARK[part] ? kit.modelDark : kit.model
  }

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.flatMat.color.copy(tk.ink)
    this.skinMat.color.copy(tk.modified).lerp(tk.model, 0.55)
    const L = layout(s)
    const k = L.k

    this.clear(this.kettle)
    const add = (geo: THREE.BufferGeometry, part: Part) => {
      const m = face(geo, kit, { feature: part, edges: s.silhouette ? false : 30 })
      m.material = this.materialFor(part)
      this.kettle.add(m)
      return m
    }
    const bevel = Math.min(2 * k, L.zb / 3)
    add(lathe([[0, 0], [L.rb, 0], [L.rb, Math.max(0.01, L.zb - bevel)], [L.rb - bevel, L.zb], [0, L.zb]] as V2[]), "base")
    add(lathe([[0, L.zb], [L.r0, L.zb], [L.r1, L.zt], [0, L.zt]] as V2[]), "body")
    const dome: V2[] = []
    for (let i = 0; i <= 16; i++) {
      const a = (Math.PI / 2) * (i / 16)
      dome.push([L.r1 * Math.cos(a), L.zt + L.lidH * Math.sin(a)])
    }
    add(lathe([[0, L.zt], ...dome]), "lid")
    add(lathe([[0, L.knob.z0], [L.knob.r, L.knob.z0], [L.knob.r, L.knob.z1 - 2 * k], [L.knob.r - 2 * k, L.knob.z1], [0, L.knob.z1]] as V2[]), "knob")
    const curve = new THREE.CatmullRomCurve3(L.handle.map(([x, z]) => new THREE.Vector3(x, 0, z)))
    add(sweepEllipse(curve, { a: L.grip, b: L.grip * 1.4, binormal: new THREE.Vector3(0, 1, 0), tubular: 64, radial: 20 }), "handle")
    if (L.spoutAxis) {
      const { from, to, r0, r1 } = L.spoutAxis
      const len = Math.hypot(to[0] - from[0], to[1] - from[1])
      const g = lathe([[0, 0], [r0, 0], [r1, len], [0, len]] as V2[], Math.PI * 2, 32)
      g.rotateY(Math.atan2(to[0] - from[0], to[1] - from[1]))
      g.translate(from[0], 0, from[1])
      add(g, "spout")
    }
    if (L.zb > 4 * k) {
      const sw = new THREE.BoxGeometry(16 * k, 3 * k, Math.min(6 * k, L.zb * 0.5))
      sw.translate(0, -L.rb, L.zb / 2)
      add(sw, "switch")
    }

    this.hand.position.set(L.xMax + 60 + HAND_BREADTH / 2, 0, 0)
    this.hand.visible = s.showHand
    this.hand.updateMatrixWorld(true)
    this.hand.userData.box = new THREE.Box3().setFromObject(this.hand, true)

    this.clear(this.marks)
    if (s.step === 2 || s.step === 3) this.drawCentroid(L)
    if (s.step >= 4) this.drawScale(L)
    this.v.invalidate()
  }

  /** The visual centre of mass, a plumb line to the table, and how far the silhouette can lean either way. */
  private drawCentroid(L: ReturnType<typeof layout>) {
    const s = this.state
    const kit = this.v.kit
    const y = -L.width
    const c = new THREE.Vector3(s.m.cx, y, s.m.cz)
    const r = 5 * L.k
    const ring: THREE.Vector3[] = []
    for (let i = 0; i <= 32; i++) ring.push(new THREE.Vector3(c.x + r * Math.cos((i / 32) * Math.PI * 2), y, c.z + r * Math.sin((i / 32) * Math.PI * 2)))
    this.marks.add(line(ring, kit.sketch))
    this.marks.add(line([c.clone().add(new THREE.Vector3(-r * 1.8, 0, 0)), c.clone().add(new THREE.Vector3(r * 1.8, 0, 0))], kit.sketch))
    this.marks.add(line([c.clone().add(new THREE.Vector3(0, 0, -r * 1.8)), c.clone().add(new THREE.Vector3(0, 0, r * 1.8))], kit.sketch))
    const lb = label(t("视觉重心", "Visual centre of mass"), c.clone().add(new THREE.Vector3(r * 2.4, 0, r * 1.2)), "border-primary text-primary font-sans")
    lb.center.set(0, 1)
    this.marks.add(lb)
    // Plumb line and the base edges.
    const foot = new THREE.Vector3(c.x, y, 0)
    this.marks.add(line([c, foot], kit.construction))
    for (const sx of [-1, 1]) {
      const e = new THREE.Vector3(sx * L.rb, y, 0)
      this.marks.add(line([c, e], kit.dimension))
      const ang = sx > 0 ? s.m.tipHandle : s.m.tipSpout
      const tl = label(`${ang.toFixed(0)}°`, e.clone().lerp(c, 0.22).add(new THREE.Vector3(sx * 6 * L.k, 0, 0)), ang < 0 ? "border-destructive text-destructive" : "")
      tl.center.set(sx > 0 ? 0 : 1, 0.5)
      this.marks.add(tl)
    }
    this.marks.add(edgeLine([new THREE.Vector3(-L.rb, y, 0), new THREE.Vector3(L.rb, y, 0)], kit))
  }

  /** Height dimension and the handle's opening. */
  private drawScale(L: ReturnType<typeof layout>) {
    const kit = this.v.kit
    const y = -L.r0 - 4
    const xAt = L.xMin - 4
    this.marks.add(linearDim(kit, new THREE.Vector3(xAt, y, 0), new THREE.Vector3(xAt, y, L.height), new THREE.Vector3(-1, 0, 0), Math.max(12, L.width * 0.12), `${Math.round(L.height)} mm`))
    const zMax = Math.max(...L.handle.map((q) => q[1]))
    const xh = Math.max(...L.handle.map((q) => q[0])) - L.grip
    const opening = L.opening
    const fits = opening >= HAND_BREADTH
    const lb = label(
      fits ? t(`把手内空 ${Math.round(opening)} mm：四指放得进`, `Handle opening ${Math.round(opening)} mm: four fingers fit`) : t(`把手内空 ${Math.round(opening)} mm：四指放不进`, `Handle opening ${Math.round(opening)} mm: four fingers don't fit`),
      new THREE.Vector3(xh, -L.grip * 2, zMax + L.grip * 2),
      fits ? "font-sans text-success" : "font-sans border-destructive text-destructive",
    )
    lb.center.set(0.5, 1)
    this.marks.add(lb)
  }

  /** A real-size hand (about 85 mm across four fingers, 180 mm long), standing with the palm to the viewer. */
  private buildHand() {
    const add = (g: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(g, this.skinMat)
      this.hand.add(m)
    }
    const palm = extrude(roundedRect(new THREE.Shape(), HAND_BREADTH, 26, 11), 100, { round: 8 })
    add(palm)
    const fingers: [number, number][] = [
      [-31, 64],
      [-10.5, 76],
      [10.5, 72],
      [31, 58],
    ]
    for (const [x, len] of fingers) {
      const g = new THREE.CapsuleGeometry(9, len - 18, 6, 12)
      g.rotateX(Math.PI / 2)
      g.translate(x, 0, 100 + (len - 18) / 2 - 2)
      add(g)
    }
    const thumb = new THREE.CapsuleGeometry(11, 42, 6, 12)
    thumb.rotateX(Math.PI / 2)
    thumb.rotateY(0.75)
    thumb.translate(-HAND_BREADTH / 2 - 12, -6, 62)
    add(thumb)
    const tag = label(t("真实大小的手", "A real-size hand"), new THREE.Vector3(0, -20, -6), "border-transparent bg-transparent font-sans text-muted-foreground")
    tag.center.set(0.5, 0)
    this.hand.add(tag)
    this.hand.visible = false
  }

  dispose() {
    window.clearTimeout(this.fitTimer)
    this.v.setProjection("perspective")
    super.dispose()
    this.flatMat.dispose()
    this.skinMat.dispose()
  }
}
