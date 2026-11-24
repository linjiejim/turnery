import * as THREE from "three"
import { edgeLine, edges, face, label, line, linearDim } from "@/three/build"
import { lathe, ringPoints, type V2 } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 6.5.3 「密封与 O 形圈」: a round cup with a face-seal groove in its flange,
 * an O-ring and a flat lid, cut in half through the axis so the groove and
 * the ring's cross-section show. The ring's section is computed with its
 * area kept (rubber is nearly incompressible): squashed by the lid it turns
 * into a stadium, and once it touches both groove walls into a rounded
 * rectangle; if even a plain rectangle can't hold it, the lid stops short.
 *
 * Numbers: Parker O-Ring Handbook ORD 5700, Design Chart 4-3 (face seal
 * glands, liquids), squeeze section 3.6 and gland fill section 3.7.
 */

/** AS568 cross-sections (mm): -0xx, -1xx, -2xx, -3xx. */
export const CORDS = [1.78, 2.62, 3.53, 5.33] as const
export type Cord = (typeof CORDS)[number]

/** Parker ORD 5700 Design Chart 4-3, O-ring face seal glands, inches converted to mm: gland depth and groove width (liquids). */
export const CHART: Record<Cord, { depth: [number, number]; width: [number, number] }> = {
  1.78: { depth: [1.27, 1.37], width: [2.57, 2.72] },
  2.62: { depth: [1.88, 2.03], width: [3.45, 3.61] },
  3.53: { depth: [2.57, 2.72], width: [4.5, 4.75] },
  5.33: { depth: [3.86, 4.11], width: [6.86, 7.37] },
}
/** The worked example: inside the chart for a 3.53 mm cord. Squeeze 24.9 %, fill 78.6 %. */
export const DEFAULTS: Record<Cord, { depth: number; width: number }> = {
  1.78: { depth: 1.3, width: 2.65 },
  2.62: { depth: 1.95, width: 3.55 },
  3.53: { depth: 2.65, width: 4.7 },
  5.33: { depth: 4.0, width: 7.1 },
}
/** Parker 3.6: minimum squeeze for any seal, about 0.2 mm (.007 in). */
export const MIN_DEFLECTION = 0.2

export const area = (d: number, swell = 0) => ((Math.PI * d * d) / 4) * (1 + swell / 100)
export const squeezeOf = (d: number, L: number) => (d - L) / d
export const fillOf = (d: number, L: number, G: number, swell = 0) => area(d, swell) / (G * L)
/** Percent, rounded to 0.1, so slider steps land on the band edges cleanly. */
export const pct = (x: number) => Math.round(x * 1000) / 10

export type Tone = "good" | "warn" | "bad"
/** Squeeze 20–30 % is the band of Design Chart 4-3; under 0.2 mm the ring takes a set and leaks. */
export function squeezeTone(d: number, L: number): Tone {
  if (d - L < MIN_DEFLECTION - 1e-9) return "bad"
  const p = pct(squeezeOf(d, L))
  return p >= 20 && p <= 30 ? "good" : "warn"
}
/** Fill 60–85 % recommended; at least 10 % void is essential (Parker 3.7). */
export function fillTone(f: number): Tone {
  const p = pct(f)
  if (p > 90) return "bad"
  return p >= 60 && p <= 85 ? "good" : "warn"
}

// ------------------------------------------------------------------ the plastic lid between screws

export const SCREW_R = 31
/**
 * How far a plastic lid bows up between two screws, mm. Simplified on purpose: it grows with the
 * span to the fourth power and falls with the lid thickness cubed (a plate), calibrated so four
 * screws on a 2.5 mm lid lift about 0.45 mm. Illustrative, not a design value.
 */
export function lidBow(screws: number, lidT: number) {
  const span = (2 * Math.PI * SCREW_R) / screws
  const span0 = (2 * Math.PI * SCREW_R) / 4
  return 0.45 * Math.pow(span / span0, 4) * Math.pow(2.5 / lidT, 3)
}
export const minSqueeze = (d: number, L: number, screws: number, lidT: number) => (d - L - lidBow(screws, lidT)) / d
/** 3D shows the bow this many times larger. */
export const BOW_EXAG = 15

export type IpId = "IPX4" | "IPX7" | "IPX8" | "IP6X"

export type SealState = {
  step: number
  cord: Cord
  depth: number
  width: number
  /** Lid travel: 0 lifted … 1 down on the flange. */
  close: number
  /** Growth of the ring's section from heat or fluid swell, %. */
  swell: number
  screws: number
  lidT: number
  ip: IpId
  closedOnce: boolean
  tunedSqueeze: boolean
  sawLeak: boolean
  tunedFill: boolean
  sawStuck: boolean
  swellOk: boolean
  flexOk: boolean
  ipSeen: IpId[]
}

// ------------------------------------------------------------------ geometry (mm)

const RO = 34
const RI = 18
const H = 16
const FLOOR = 3
/** The groove's outer wall: the ring rests against it (pressure from inside pushes it outwards). */
const GO = 28
const LIFT = 6
/** How much larger the gap under a lid held up by an overfilled groove is drawn. */
export const STUCK_EXAG = 6

type Section = { w: number; h: number; rc: number; over: number }

/**
 * The ring's cross-section with the lid `hMax` above the groove bottom, area kept. `over` is the
 * area that doesn't fit even as a sharp rectangle (then the lid can't come down that far).
 */
export function squashed(d: number, A: number, G: number, hMax: number): Section {
  let w: number
  let h: number
  let rc: number
  if (d <= G) {
    w = d
    h = d
    rc = d / 2
  } else {
    // Narrower than the cord: the walls pinch it, it stands taller.
    w = G
    rc = G / 2
    h = G + (A - (Math.PI * G * G) / 4) / G
  }
  if (h <= hMax) return { w, h, rc, over: 0 }
  h = hMax
  w = h + (A - (Math.PI * h * h) / 4) / h
  rc = h / 2
  if (w <= G) return { w, h, rc, over: 0 }
  const spare = G * h - A
  if (spare >= 0) return { w: G, h, rc: Math.min(h / 2, G / 2, Math.sqrt(spare / (4 - Math.PI))), over: 0 }
  return { w: G, h, rc: 0, over: -spare }
}

/** A rounded rectangle, right edge at x = 0, bottom at z = 0, counter-clockwise. */
function roundedLoop(w: number, h: number, rc: number, n = 10): V2[] {
  const out: V2[] = []
  const corner = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (Math.PI / 2) * (i / n)
      out.push([cx + Math.cos(a) * rc, cz + Math.sin(a) * rc])
    }
  }
  corner(-rc, rc, -Math.PI / 2)
  corner(-rc, h - rc, 0)
  corner(-w + rc, h - rc, Math.PI / 2)
  corner(-w + rc, rc, Math.PI)
  return out
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const initial = (): SealState => ({
  step: 0,
  cord: 3.53,
  depth: DEFAULTS[3.53].depth,
  width: DEFAULTS[3.53].width,
  close: 0,
  swell: 0,
  screws: 4,
  lidT: 2.5,
  ip: "IPX7",
  closedOnce: false,
  tunedSqueeze: false,
  sawLeak: false,
  tunedFill: false,
  sawStuck: false,
  swellOk: false,
  flexOk: false,
  ipSeen: [],
})

export class SealsScene extends LessonScene<SealState> {
  private body = new THREE.Group()
  private ringG = new THREE.Group()
  private notes = new THREE.Group()
  private drops = new THREE.Group()
  private dropPath: THREE.Vector3[] = []
  private dropT = 0
  private rubber = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 })
  private rubberFlex = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, vertexColors: true })
  private cutMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 })
  private lidCutMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 })
  private toneMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, side: THREE.DoubleSide })
  private water = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.2, side: THREE.DoubleSide })
  private dropMat = new THREE.MeshBasicMaterial()
  private dust = new THREE.PointsMaterial({ size: 2.5, sizeAttenuation: false })

  constructor(v: Viewer, emit: (s: SealState) => void) {
    super(v, emit, initial())
    v.setGrid(80, 10)
    for (const m of [this.rubber, this.rubberFlex, this.cutMat, this.lidCutMat, this.toneMat, this.water, this.dropMat, this.dust]) this.own(() => m.dispose())
    this.root.add(this.body, this.ringG, this.notes, this.drops)
    // Leak droplets run along the lid–flange interface while a closed seal leaks.
    this.own(
      v.onFrame((dt) => {
        if (!this.drops.visible || this.dropPath.length < 2) return false
        this.dropT = (this.dropT + dt * 0.22) % 1
        this.placeDrops()
        return true
      }),
    )
  }

  enter(step: number) {
    this.v.tweens.cancel("lid")
    this.v.tweens.cancel("swell")
    const d: Cord = 3.53
    const base: Partial<SealState> = { step, cord: d, depth: DEFAULTS[d].depth, width: DEFAULTS[d].width, close: 1, swell: 0 }
    if (step === 0) Object.assign(base, { close: 0 })
    if (step === 1) Object.assign(base, { depth: 3.1 })
    if (step === 2) Object.assign(base, { width: 6.4 })
    if (step === 3) Object.assign(base, { width: 3.9 })
    if (step === 4) Object.assign(base, { screws: 4, lidT: 2.5 })
    this.set(base)
    const v = this.v
    if (step === 0) v.flyTo(V(46, -128, 72), V(2, 6, 15), 900)
    else if (step <= 3) v.setView("front", { target: V(24, 0, 14), distance: 66 })
    else if (step === 4) v.flyTo(V(66, -150, 132), V(-12, 0, 10), 900)
    else v.flyTo(V(150, -285, 170), V(-22, 0, 24), 900)
  }

  // ------------------------------------------------------------ actions

  toggleLid() {
    const from = this.state.close
    const to = from > 0.5 ? 0 : 1
    this.v.tweens.run(1100, (k) => this.set({ close: from + (to - from) * k }), { tag: "lid" }).then(() => {
      if (to === 1 && this.state.close === 1) this.set({ closedOnce: true, sawStuck: this.state.sawStuck || this.stuck() })
    })
  }

  /** Close the lid again from open (the Predict reveals). */
  replayClose(patch: Partial<SealState>) {
    this.set({ ...patch, close: 0 })
    this.v.tweens.run(1100, (k) => this.set({ close: k }), { tag: "lid" }).then(() => {
      if (this.state.close === 1) this.set({ closedOnce: true, sawStuck: this.state.sawStuck || this.stuck() })
    })
  }

  setCord(cord: Cord) {
    this.set({ cord, depth: DEFAULTS[cord].depth, width: DEFAULTS[cord].width })
  }

  setDepth(depth: number) {
    const s = this.state
    this.set({ depth, tunedSqueeze: s.tunedSqueeze || (s.step === 1 && squeezeTone(s.cord, depth) === "good") })
  }

  setWidth(width: number) {
    const s = this.state
    const patch: Partial<SealState> = { width }
    if (s.step === 2 && fillTone(fillOf(s.cord, s.depth, width)) === "good") patch.tunedFill = true
    this.set(patch)
    this.checkSwell()
    if (this.stuck() && s.close === 1) this.set({ sawStuck: true })
  }

  setSwell(swell: number) {
    this.set({ swell })
    this.checkSwell()
  }

  playSwell(to = 10) {
    const from = this.state.swell
    this.v.tweens.run(1200, (k) => this.setSwell(Math.round((from + (to - from) * k) * 10) / 10), { tag: "swell" })
  }

  setFlex(patch: { screws?: number; lidT?: number }) {
    const s = { ...this.state, ...patch }
    this.set({ ...patch, flexOk: this.state.flexOk || pct(minSqueeze(s.cord, s.depth, s.screws, s.lidT)) >= 20 })
  }

  setIp(ip: IpId) {
    this.set({ ip, ipSeen: this.state.ipSeen.includes(ip) ? this.state.ipSeen : [...this.state.ipSeen, ip] })
  }

  private checkSwell() {
    const s = this.state
    if (s.step !== 3 || s.swellOk) return
    if (s.swell >= 10 && fillOf(s.cord, s.depth, s.width, s.swell) <= 1 && fillTone(fillOf(s.cord, s.depth, s.width)) === "good") this.set({ swellOk: true })
  }

  /** The ring doesn't fit even as a rectangle: the lid can't reach the flange. */
  stuck() {
    const s = this.state
    return area(s.cord, s.swell) > s.width * s.depth + 1e-9
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.rubber.color.copy(tk.modelDark)
    this.cutMat.color.copy(tk.cut)
    // The lid's section a step lighter than the base's, so the joint between them reads.
    this.lidCutMat.color.copy(tk.cut).lerp(tk.model, 0.55)
    this.water.color.copy(tk.hover)
    this.dropMat.color.copy(tk.hover)
    this.dust.color.copy(tk.edgeSoft)
    this.clear(this.body)
    this.clear(this.ringG)
    this.clear(this.notes)

    const cut = s.step <= 3
    const phi = cut ? Math.PI : Math.PI * 2
    const L = s.depth
    const G = s.width
    const d0 = s.cord * Math.sqrt(1 + s.swell / 100)
    const A = area(s.cord, s.swell)
    const zb = H - L

    // Where the lid face is: lifted by the travel, but never lower than the ring lets it.
    const want = L + (1 - s.close) * LIFT
    // An overfilled groove holds the lid up by a few hundredths of a millimetre: drawn 6× larger.
    const hStop = L + Math.max(0, A / G - L) * STUCK_EXAG
    const gap = Math.max(want, hStop)
    const lift = gap - L
    const stuckNow = A > G * L + 1e-9
    const sec = squashed(d0, stuckNow && gap <= hStop + 1e-9 ? G * hStop : A, G, gap)

    // ---- base: a cup with the groove in its flange
    const groove = s.step === 1 || s.step === 2 || s.step === 3
    const prof: V2[] = [
      [0, 0],
      [RO, 0],
      [RO, H],
      [GO, H],
      [GO, zb],
      [GO - G, zb],
      [GO - G, H],
      [RI, H],
      [RI, FLOOR],
      [0, FLOOR],
    ]
    this.revolveSolid(prof, phi, (i) => (groove && i >= 3 && i <= 5 ? "highlight" : "model"), cut, this.cutMat)

    // ---- lid
    const lidZ = H + lift
    const T = s.step >= 4 ? s.lidT : 3
    const lidProf: V2[] = [
      [0, lidZ],
      [RO, lidZ],
      [RO, lidZ + T],
      [0, lidZ + T],
    ]
    if (s.step === 4) this.bowedLid(lidProf, s)
    else this.revolveSolid(lidProf, phi, () => "model", cut, this.lidCutMat)

    // ---- screws (whole product only)
    if (!cut) {
      const n = s.step === 4 ? s.screws : 6
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + ((k + 0.5) * 2 * Math.PI) / n
        const g = new THREE.CylinderGeometry(2.3, 2.3, 1.4, 20)
        g.rotateX(Math.PI / 2)
        g.translate(Math.cos(a) * SCREW_R, Math.sin(a) * SCREW_R, lidZ + T + 0.7)
        this.body.add(face(g, kit, { role: "metal" }))
      }
    }

    // ---- ring
    const loop = roundedLoop(sec.w, sec.h, sec.rc).map(([x, z]) => [GO + x, zb + z] as V2)
    const ringGeo = lathe([...loop, loop[0]], phi, cut ? 96 : 160)
    if (s.step === 4) {
      this.colourByLocalSqueeze(ringGeo, s)
      this.ringG.add(new THREE.Mesh(ringGeo, this.rubberFlex))
    } else this.ringG.add(new THREE.Mesh(ringGeo, this.rubber))
    if (cut) {
      const sq = squeezeTone(s.cord, Math.min(gap, s.cord))
      const tone: Tone = s.close < 1 && gap >= s.cord ? "good" : this.stuck() ? "bad" : s.step === 2 || s.step === 3 ? fillTone(A / (G * L)) : sq
      this.toneMat.color.copy(tone === "good" ? tk.good : tone === "warn" ? tk.warn : tk.bad)
      for (const side of [1, -1]) {
        const shape = new THREE.Shape(loop.map(([r, z]) => new THREE.Vector2(side * r, z)))
        const g = new THREE.ShapeGeometry(shape)
        g.rotateX(Math.PI / 2)
        g.translate(0, -0.02, 0)
        this.ringG.add(new THREE.Mesh(g, this.toneMat))
        this.ringG.add(edgeLine([...loop, loop[0]].map(([r, z]) => V(side * r, -0.05, z)), kit))
      }
    }

    this.annotate(s, { zb, gap, lift, sec, A, cut })
    this.v.invalidate()
  }

  /**
   * Revolve a (r, z) polygon that starts and ends on the axis by phi; with a cut, cap it at y = 0 with
   * one section through the axis (both halves in one face, so no line runs down the middle).
   */
  private revolveSolid(prof: V2[], phi: number, role: (segment: number) => "model" | "highlight", cut: boolean, cutMat: THREE.Material) {
    const kit = this.v.kit
    for (let i = 0; i < prof.length; i++) {
      const a = prof[i]
      const b = prof[(i + 1) % prof.length]
      if (a[0] < 0.01 && b[0] < 0.01) continue
      this.body.add(face(lathe([a, b], phi, cut ? 96 : 128), kit, { role: role(i), edges: false }))
      if (a[0] > 0.01) this.body.add(edgeLine(ringPoints(a[0], a[1], phi, cut ? 96 : 128), kit))
    }
    if (!cut) return
    const full: V2[] = [...prof, ...prof.slice(1, -1).reverse().map(([r, z]) => [-r, z] as V2)]
    const g = new THREE.ShapeGeometry(new THREE.Shape(full.map(([r, z]) => new THREE.Vector2(r, z))))
    g.rotateX(Math.PI / 2)
    this.body.add(new THREE.Mesh(g, cutMat))
    this.body.add(edgeLine([...full, full[0]].map(([r, z]) => V(r, -0.03, z)), kit))
  }

  /** The lid of step 5: see-through, bowing up between the screws (exaggerated). */
  private bowedLid(prof: V2[], s: SealState) {
    const kit = this.v.kit
    const bow = lidBow(s.screws, s.lidT) * BOW_EXAG
    for (let i = 0; i < prof.length; i++) {
      const a = prof[i]
      const b = prof[(i + 1) % prof.length]
      if (a[0] < 0.01 && b[0] < 0.01) continue
      const g = lathe([a, b], Math.PI * 2, 160)
      const p = g.getAttribute("position")
      for (let k = 0; k < p.count; k++) {
        const th = Math.atan2(p.getY(k), p.getX(k))
        const r = Math.hypot(p.getX(k), p.getY(k))
        p.setZ(k, p.getZ(k) + bow * bowShape(th, s.screws) * Math.min(1, r / GO))
      }
      g.computeVertexNormals()
      const m = new THREE.Mesh(g, kit.glass)
      m.add(edges(g, kit, 40))
      this.body.add(m)
    }
  }

  private colourByLocalSqueeze(g: THREE.BufferGeometry, s: SealState) {
    const tk = this.v.tokens
    const p = g.getAttribute("position")
    const col = new Float32Array(p.count * 3)
    const bow = lidBow(s.screws, s.lidT)
    const c = new THREE.Color()
    for (let k = 0; k < p.count; k++) {
      const th = Math.atan2(p.getY(k), p.getX(k))
      const local = s.depth + bow * bowShape(th, s.screws)
      const sq = pct(squeezeOf(s.cord, local))
      if (s.cord - local < MIN_DEFLECTION) c.copy(tk.bad)
      else c.copy(sq >= 20 ? tk.good : tk.warn)
      col.set([c.r, c.g, c.b], k * 3)
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  }

  private annotate(s: SealState, g: { zb: number; gap: number; lift: number; sec: Section; A: number; cut: boolean }) {
    const kit = this.v.kit
    const n = this.notes
    const plain = "border-transparent bg-transparent font-sans text-muted-foreground"
    const leaking = g.cut && s.close >= 1 && !this.stuck() && s.cord - g.gap < MIN_DEFLECTION
    this.drops.visible = leaking
    this.buildDrops(leaking, g.zb)
    if (leaking && !this.state.sawLeak && s.step === 1) queueMicrotask(() => this.set({ sawLeak: true }))

    if (g.cut) {
      const y = -0.15
      // Contact flats: where the squashed ring presses on the lid and on the groove bottom.
      const flat = g.sec.w - 2 * g.sec.rc
      if (g.gap < s.cord * Math.sqrt(1 + s.swell / 100) - 1e-3 && flat > 0.05) {
        const x0 = GO - g.sec.w + g.sec.rc
        const x1 = GO - g.sec.rc
        n.add(line([V(x0, y, g.zb + g.sec.h), V(x1, y, g.zb + g.sec.h)], kit.sketch))
        n.add(line([V(x0, y, g.zb), V(x1, y, g.zb)], kit.sketch))
        if (s.step === 0) n.add(label(t("密封线：圈顶住盖子和槽底", "Seal lines: the ring pushes on the lid and the groove bottom"), V(GO + 1.5, y, g.zb + g.sec.h + 5.2), "font-sans"))
      }
      if (s.step >= 1 && s.step <= 3) {
        n.add(linearDim(kit, V(GO, y, g.zb), V(GO, y, H), V(1, 0, 0), 3, t(`槽深 ${s.depth.toFixed(2)}`, `Depth ${s.depth.toFixed(2)}`)))
        n.add(linearDim(kit, V(GO - s.width, y, g.zb), V(GO, y, g.zb), V(0, 0, -1), 3, t(`槽宽 ${s.width.toFixed(2)}`, `Width ${s.width.toFixed(2)}`)))
      }
      if (s.close < 0.05) n.add(label(t(`线径 ${s.cord.toFixed(2)}`, `Cord ${s.cord.toFixed(2)}`), V(GO - g.sec.w / 2, y, g.zb + g.sec.h + 1.2)))
      if (s.step === 0) {
        n.add(label(t("内侧：水、油或气", "Inside: water, oil or gas"), V(RI - 7, y, H - 4), plain))
        n.add(label(t("外侧", "Outside"), V(RO + 4, y, H - 4), plain))
      }
      if (this.stuck() && s.close >= 1) {
        const msg =
          s.step === 3
            ? t("圈涨大后没地方去：顶开盖子，挤进缝里", "The swollen ring has nowhere to go: it pushes the lid open and squeezes into the gap")
            : t("圈没地方去，盖子压不下来", "Nowhere for the rubber to go: the lid won't come down")
        n.add(label(msg, V(GO - 2, y, H + g.lift + 4.6), "border-destructive text-destructive font-sans"))
        n.add(label(t(`缝隙放大 ${STUCK_EXAG} 倍显示`, `Gap drawn ${STUCK_EXAG}× larger`), V(RO + 3, y, H + g.lift + 1.5), "border-transparent bg-transparent font-sans text-muted-foreground"))
        if (s.step === 3) {
          // Rubber squeezed into the gap the lid was pushed open by.
          const tongue = new THREE.Shape([new THREE.Vector2(GO - s.width - 0.9, H), new THREE.Vector2(GO - s.width, H), new THREE.Vector2(GO - s.width, H + g.lift), new THREE.Vector2(GO - s.width - 0.9, H + g.lift)])
          const tg = new THREE.ShapeGeometry(tongue)
          tg.rotateX(Math.PI / 2)
          tg.translate(0, -0.03, 0)
          this.ringG.add(new THREE.Mesh(tg, this.toneMat))
        }
      }
      if (leaking) n.add(label(t("压得太轻：圈很快失去回弹，液体从这里漏出", "Too light a squeeze: the ring soon loses its spring, and fluid gets past"), V(GO - 2, y, H + 4.6), "border-destructive text-destructive font-sans"))
    }

    if (s.step === 4) {
      const ms = minSqueeze(s.cord, s.depth, s.screws, s.lidT)
      const ok = pct(ms) >= 20
      n.add(
        label(
          t(`螺钉之间：压缩率 ${pct(ms).toFixed(1)}%`, `Between screws: squeeze ${pct(ms).toFixed(1)}%`),
          V(0, -GO - 4, H + 9),
          ok ? "border-success text-success font-sans" : "border-destructive text-destructive font-sans",
        ),
      )
      n.add(label(t(`拱起量放大 ${BOW_EXAG} 倍显示`, `Bow shown ${BOW_EXAG}× larger`), V(RO + 2, -RO, H + 12), plain))
    }

    if (s.step === 5) this.ipScene(s)
  }

  private ipScene(s: SealState) {
    const kit = this.v.kit
    const n = this.notes
    const plain = "border-transparent bg-transparent font-sans text-muted-foreground"
    if (s.ip === "IPX7" || s.ip === "IPX8") {
      const top = s.ip === "IPX7" ? 52 : 76
      const g = new THREE.BoxGeometry(104, 90, top + 4)
      g.translate(0, 0, top / 2 - 2)
      const m = new THREE.Mesh(g, this.water)
      m.add(edges(g, kit, 30))
      n.add(m)
      n.add(label(t("水面", "Water surface"), V(-52, -45, top + 2), plain))
      n.add(linearDim(kit, V(-RO - 6, -45, H + 3), V(-RO - 6, -45, top - 2), V(-1, 0, 0), 6, s.ip === "IPX7" ? t("1 m · 30 min（示意，不按比例）", "1 m · 30 min (not to scale)") : t("更深、更久：厂家和用户约定", "Deeper, longer: as agreed")))
    } else if (s.ip === "IPX4") {
      // Splashing from every direction: arrows aimed at the product.
      const c = V(0, 0, 12)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const el = (i % 3) * 0.45 - 0.1
        const dir = V(Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el), Math.sin(el))
        const from = c.clone().addScaledVector(dir, 70)
        const to = c.clone().addScaledVector(dir, 46)
        n.add(line([from, to], kit.sketch))
        const back = to.clone().addScaledVector(dir, 4)
        const side = new THREE.Vector3().crossVectors(dir, V(0, 0, 1)).normalize().multiplyScalar(2)
        n.add(line([back.clone().add(side), to, back.clone().sub(side)], kit.sketch))
      }
      n.add(label(t("任何方向的溅水", "Splashing from any direction"), V(0, -80, 50), plain))
    } else {
      const pts: number[] = []
      let seed = 7
      const rnd = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      for (let i = 0; i < 420; i++) pts.push((rnd() - 0.5) * 104, (rnd() - 0.5) * 90, rnd() * 56)
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
      n.add(new THREE.Points(g, this.dust))
      n.add(label(t("粉尘箱：试验后里面不能有灰", "Dust chamber: no dust inside after the test"), V(0, -60, 66), plain))
    }
  }

  private buildDrops(on: boolean, zb: number) {
    this.clear(this.drops)
    this.dropPath = []
    if (!on) return
    const y = -0.35
    const s = this.state
    const top = Math.min(H, zb + s.cord)
    this.dropPath = [V(RI - 5, y, H - 3), V(RI, y, H - 0.15), V(GO - s.width, y, H - 0.15), V(GO - s.width / 2, y, Math.max(top, H - 0.15)), V(GO, y, H - 0.15), V(RO, y, H - 0.15), V(RO + 3, y, H - 4)]
    for (let i = 0; i < 6; i++) {
      const g = new THREE.SphereGeometry(0.42, 12, 8)
      this.drops.add(new THREE.Mesh(g, this.dropMat))
    }
    this.placeDrops()
  }

  private placeDrops() {
    const path = this.dropPath
    const lens = path.slice(1).map((p, i) => p.distanceTo(path[i]))
    const total = lens.reduce((a, b) => a + b, 0)
    this.drops.children.forEach((m, i) => {
      let d = ((this.dropT + i / this.drops.children.length) % 1) * total
      let k = 0
      while (k < lens.length - 1 && d > lens[k]) d -= lens[k++]
      m.position.lerpVectors(path[k], path[k + 1], Math.min(1, d / lens[k]))
    })
  }
}

/** 0 at each screw, 1 midway between two. Screws sit half a span either side of the front (−Y). */
function bowShape(theta: number, screws: number) {
  return (1 - Math.cos(screws * (theta + Math.PI / 2) + Math.PI)) / 2
}
