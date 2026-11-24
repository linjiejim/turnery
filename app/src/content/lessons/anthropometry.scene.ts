import * as THREE from "three"
import { face, label, line, linearDim, tag } from "@/three/build"
import { extrude, roundedRect } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { ANSUR, atPct, pctOf, shareBelow, type Group } from "./anthropometry.data"
import { LessonScene } from "./scene"

/**
 * 6.2.1 「人体尺寸与百分位」: hand breadth as a distribution. A hand drawn at any percentile of either
 * group, a hand hole in a crate wall whose width the learner sets (a clearance: it has to let the big
 * hands in), a strap around the palm that has to fit from both sides (one size, three sizes, or
 * adjustable), and Daniels' 1952 count of "average" airmen as a crowd of 4063 figures.
 *
 * Hand breadth is the only measured number on the hand: the rest of the hand is drawn in proportion to it.
 */
export type Strategy = "one" | "sizes" | "adjust"

export type AnthroState = {
  step: number
  group: Group
  pct: number
  /** Width of the hand hole, mm. */
  opening: number
  strategy: Strategy
  /** How many of Daniels' ten dimensions are applied (0–10). */
  dims: number
  /** Step 2's guess has been answered: the fit shading shows. */
  revealed: boolean
  seenSmall: boolean
  seenLarge: boolean
  sawBlocked: boolean
  strategies: Strategy[]
}

export const HB = ANSUR.handBreadth
export const breadthOf = (g: Group, pct: number) => atPct(HB[g], pct)

/** Share of a 50/50 mix of women and men whose hands are at or below x. */
export const mixedBelow = (x: number) => 0.5 * shareBelow(HB.f, x) + 0.5 * shareBelow(HB.m, x)
/** Share of the mix with hands between a and b. */
export const mixedWithin = (a: number, b: number) => mixedBelow(b) - mixedBelow(a)

/**
 * How loose a strap may be and still hold: illustrative, not from a standard. A strap fits a hand
 * whose breadth lies within [size − SLACK, size].
 */
export const SLACK = 8
function bestStart(span: number) {
  let best = 60
  let cover = 0
  for (let a = 60; a <= 100; a += 0.5) {
    const c = mixedWithin(a, a + span)
    if (c > cover) {
      cover = c
      best = a
    }
  }
  return best
}
const ONE_LO = bestStart(SLACK)
const SIZES_LO = bestStart(SLACK * 3)
/** Fit windows (hand breadth, mm) of each strategy: one size, S/M/L, or adjustable from P5 women to P95 men. */
export const WINDOWS: Record<Strategy, [number, number][]> = {
  one: [[ONE_LO, ONE_LO + SLACK]],
  sizes: [0, 1, 2].map((i) => [SIZES_LO + i * SLACK, SIZES_LO + (i + 1) * SLACK] as [number, number]),
  adjust: [[breadthOf("f", 5), breadthOf("m", 95)]],
}
/** The hand goes in if its breadth, to the millimetre shown, is no wider than the opening. */
export const fitsIn = (B: number, opening: number) => Math.round(B) <= opening

export const coverage = (s: Strategy) => WINDOWS[s].reduce((sum, [a, b]) => sum + mixedWithin(a, b), 0)
export const SIZE_NAMES = ["S", "M", "L"]

/**
 * Daniels, G. S. (1952) "The 'Average Man'?": of 4063 Air Force flying personnel, how many stayed within
 * the middle 30% of the range (about ±0.3 SD) as each of ten dimensions was added in turn.
 */
export const FUNNEL = [4063, 1055, 302, 143, 73, 28, 12, 6, 3, 2, 0]
export const FUNNEL_DIMS = [
  t("身高", "Stature"),
  t("胸围", "Chest circumference"),
  t("袖长", "Sleeve length"),
  t("裆高", "Crotch height"),
  t("躯干围", "Torso circumference"),
  t("臀围", "Hip circumference"),
  t("颈围", "Neck circumference"),
  t("腰围", "Waist circumference"),
  t("大腿围", "Thigh circumference"),
  t("裆长", "Crotch length"),
]

// ------------------------------------------------------------------ the scene (mm)

const SLOT_H = 40
const SLOT_Z = 62
const WALL = { w: 220, h: 130, t: 5 }
const COLS = 64

const initial = (): AnthroState => ({
  step: 0,
  group: "f",
  pct: 50,
  opening: 88,
  strategy: "one",
  dims: 0,
  revealed: false,
  seenSmall: false,
  seenLarge: false,
  sawBlocked: false,
  strategies: [],
})

/** Deterministic shuffle, so the same people stay "average" as dimensions are added. */
function order(n: number) {
  let seed = 1952
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class AnthropometryScene extends LessonScene<AnthroState> {
  private wall = new THREE.Group()
  private hand = new THREE.Group()
  private strap = new THREE.Group()
  private marks = new THREE.Group()
  private crowd: THREE.InstancedMesh
  private crowdLabels = new THREE.Group()
  private rank: number[]
  private skin = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 })
  private bad = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, emissiveIntensity: 0.15 })
  private good = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 })
  private warn = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 })
  private crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 })
  private builtWall = NaN

  constructor(v: Viewer, emit: (s: AnthroState) => void) {
    super(v, emit, initial())
    v.setGrid(160, 10)
    for (const m of [this.skin, this.bad, this.good, this.warn, this.crowdMat]) this.own(() => m.dispose())
    const pillar = new THREE.CylinderGeometry(1.5, 1.9, 1, 6)
    pillar.rotateX(Math.PI / 2)
    pillar.translate(0, 0, 0.5)
    this.crowd = new THREE.InstancedMesh(pillar, this.crowdMat, FUNNEL[0])
    this.crowd.frustumCulled = false
    this.own(() => this.crowd.dispose())
    this.rank = order(FUNNEL[0])
    this.root.add(this.wall, this.hand, this.strap, this.marks, this.crowd, this.crowdLabels)
  }

  enter(step: number) {
    this.v.tweens.cancel("funnel")
    const s = this.state
    const p: Partial<AnthroState> = { step }
    if (step === 0) Object.assign(p, { group: "f", pct: 50 })
    if (step === 1) Object.assign(p, { group: "m", pct: 50, opening: Math.round(breadthOf("m", 50)), revealed: false })
    if (step === 2) Object.assign(p, { group: "m", pct: 95, opening: Math.round(breadthOf("m", 50)) })
    if (step === 3) Object.assign(p, { group: "f", pct: 50, strategies: s.strategies.includes(s.strategy) ? s.strategies : [...s.strategies, s.strategy] })
    if (step === 4) p.dims = 0
    this.set(p)
    this.v.setGrid(step === 4 ? 240 : 160, step === 4 ? 20 : 10)
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    if (step === 0) this.look(V(0, -120, 60), V(0.35, -0.75, 0.9), 640)
    else if (step === 3) this.look(V(0, -130, 60), V(0.35, -0.75, 0.9), 640)
    else if (step === 4) this.look(V(0, 0, 0), V(0.4, -1, 0.95), 1050, 0.07)
    else this.look(V(0, -100, 60), V(-0.45, -1, 0.95), 780)
  }

  /** Look at `center` from `dir`, aimed a little left of it so it sits right of the chart panel. */
  private look(center: THREE.Vector3, dir: THREE.Vector3, dist: number, shift = 0.11) {
    const d = dir.clone().normalize()
    const right = new THREE.Vector3().crossVectors(d.clone().negate(), new THREE.Vector3(0, 0, 1)).normalize()
    const target = center.clone().addScaledVector(right, -shift * dist)
    this.v.flyTo(target.clone().addScaledVector(d, dist), target, 800)
  }

  // ------------------------------------------------------------ actions

  setGroup(group: Group) {
    this.set({ group, ...this.seen(group, this.state.pct) })
  }

  setPct(pct: number) {
    this.set({ pct, ...this.seen(this.state.group, pct) })
  }

  private seen(group: Group, pct: number): Partial<AnthroState> {
    const s = this.state
    const B = breadthOf(group, pct)
    return {
      seenSmall: s.seenSmall || (group === "f" && pct <= 5),
      seenLarge: s.seenLarge || (group === "m" && pct >= 95),
      sawBlocked: s.sawBlocked || ((s.step === 1 || s.step === 2) && !fitsIn(B, s.opening)),
    }
  }

  setOpening(opening: number) {
    this.set({ opening, sawBlocked: this.state.sawBlocked || !fitsIn(breadthOf(this.state.group, this.state.pct), opening) })
  }

  /** Step 2's guess answered: show the shares, and a big hand at the hole. */
  reveal() {
    this.set({ revealed: true, group: "m", pct: 95, sawBlocked: true })
  }

  setStrategy(strategy: Strategy) {
    const st = this.state.strategies
    this.set({ strategy, strategies: st.includes(strategy) ? st : [...st, strategy] })
  }

  setDims(dims: number) {
    this.set({ dims })
  }

  /** Add the dimensions one by one, as Daniels did. */
  playFunnel() {
    const from = this.state.dims >= 10 ? 0 : this.state.dims
    this.v.tweens.run(
      (10 - from) * 420,
      (k) => {
        const d = from + Math.floor(k * (10 - from) + 1e-6)
        if (d !== this.state.dims) this.set({ dims: Math.min(10, d) })
      },
      { tag: "funnel" },
    )
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.skin.color.copy(tk.model).lerp(tk.modified, 0.18)
    this.bad.color.copy(tk.bad)
    this.bad.emissive.copy(tk.bad)
    this.good.color.copy(tk.good)
    this.warn.color.copy(tk.warn)

    const crowdStep = s.step === 4
    this.wall.visible = s.step === 1 || s.step === 2
    this.hand.visible = !crowdStep
    this.strap.visible = s.step === 3
    this.crowd.visible = crowdStep
    this.crowdLabels.visible = crowdStep
    this.clear(this.marks)
    this.clear(this.hand)
    this.clear(this.strap)

    if (crowdStep) this.renderCrowd()
    else {
      const B = breadthOf(s.group, s.pct)
      if (this.wall.visible && this.builtWall !== s.opening) this.buildWall(s.opening)
      if (this.wall.visible) this.renderHole(B)
      else this.renderFree(B)
    }
    this.v.invalidate()
  }

  /** Steps 0 and 3: the hand alone, with its breadth dimensioned (and the strap in step 3). */
  private renderFree(B: number) {
    const s = this.state
    const kit = this.v.kit
    const pos = new THREE.Vector3(0, -60, SLOT_Z)
    const h = this.buildHand(B, [])
    h.position.copy(pos)
    this.hand.add(h)
    const zTop = pos.z + B * 0.2
    this.marks.add(
      linearDim(kit, new THREE.Vector3(-B / 2, pos.y - 8, zTop), new THREE.Vector3(B / 2, pos.y - 8, zTop), new THREE.Vector3(0, 0, 1), 16, `${t("手宽", "Hand breadth")} ${B.toFixed(0)}`),
    )
    if (s.step === 3) this.renderStrap(B, pos)
  }

  /** Steps 1–2: the hand in front of the hole; it goes in if the hole is at least as wide. */
  private renderHole(B: number) {
    const s = this.state
    const kit = this.v.kit
    const fits = fitsIn(B, s.opening)
    const L = 2.2 * B
    // Fits: the fingers go through and the knuckles stop just short of the wall. Doesn't: the fingertips stop at the wall.
    const y = fits ? -6 : -(L * 0.42) - 3
    const outer = fits ? [] : this.blockedFingers(B, s.opening)
    const h = this.buildHand(B, outer)
    h.position.set(0, y, SLOT_Z)
    this.hand.add(h)
    const zTop = SLOT_Z + SLOT_H / 2 + 6
    this.marks.add(
      linearDim(kit, new THREE.Vector3(-s.opening / 2, -1, SLOT_Z + SLOT_H / 2), new THREE.Vector3(s.opening / 2, -1, SLOT_Z + SLOT_H / 2), new THREE.Vector3(0, 0, 1), 22, `${t("开口", "Opening")} ${s.opening}`),
    )
    const msg = fits ? t("伸得进去", "Goes in") : t("手比开口宽，伸不进去", "The hand is wider than the opening: it won't go in")
    this.marks.add(label(msg, new THREE.Vector3(0, y - L * 0.35, zTop + 30), fits ? "border-scene-good font-sans" : "border-destructive text-destructive font-sans"))
  }

  /** Indices of the fingers (0 index … 3 little) that hit the edge of the hole. */
  private blockedFingers(B: number, W: number) {
    const r = (B / 8) * 0.95
    const xs = [-3, -1, 1, 3].map((k) => (k * B) / 8)
    const hit = xs.map((x, i) => (Math.abs(x) + r > W / 2 ? i : -1)).filter((i) => i >= 0)
    return hit.length ? hit : [0, 3]
  }

  /** The strap around the palm, as the strategy sizes it for this hand. */
  private renderStrap(B: number, pos: THREE.Vector3) {
    const s = this.state
    let size: number
    let sizeName = ""
    const wins = WINDOWS[s.strategy]
    if (s.strategy === "adjust") {
      const [lo, hi] = wins[0]
      size = Math.min(hi, Math.max(lo, B)) + 1
    } else if (s.strategy === "sizes") {
      // Pick the size whose window holds the hand; outside them all, the nearest one.
      let k = wins.findIndex(([a, b]) => B >= a && B <= b)
      if (k < 0) k = B < wins[0][0] ? 0 : wins.length - 1
      size = wins[k][1]
      sizeName = SIZE_NAMES[k]
    } else size = wins[0][1]
    const tight = B > size + 0.01
    const loose = size - B > SLACK
    const mat = tight ? this.bad : loose ? this.warn : this.good
    const T = B * 0.33
    const inner = new THREE.Shape()
    roundedRect(inner, size, T + 2, 6)
    const outerShape = roundedRect(new THREE.Shape(), size + 7, T + 9, 9)
    outerShape.holes.push(roundedRect(new THREE.Path(), size, T + 2, 6))
    const geo = extrude(outerShape, 22)
    geo.rotateX(Math.PI / 2)
    const band = new THREE.Mesh(geo, mat)
    // Loose: the band hangs on the top of the hand, the gap shows underneath.
    const sag = loose ? -(size - B) * 0.15 : 0
    const palmLen = 0.56 * 2.2 * B
    band.position.set(pos.x, pos.y - palmLen * 0.45 + 11, pos.z + sag)
    this.strap.add(band)
    if (s.strategy === "adjust") {
      const buckle = face(new THREE.BoxGeometry(9, 26, 14), this.v.kit, { role: "modelDark" })
      buckle.position.set(pos.x + size / 2 + 6, band.position.y - 11, pos.z + sag)
      this.strap.add(buckle)
    }
    const what = tight ? t("太紧", "Too tight") : loose ? t("太松，会滑", "Too loose: it slips") : t("合适", "Fits")
    const name = s.strategy === "sizes" ? t(`${sizeName} 号 · `, `Size ${sizeName} · `) : s.strategy === "adjust" ? t("调到 ", "Set to ") : t("均码 ", "One size ")
    const text = s.strategy === "adjust" ? `${name}${size.toFixed(0)} · ${what}` : `${name}${s.strategy === "one" ? size.toFixed(0) + " · " : ""}${what}`
    this.marks.add(label(text, new THREE.Vector3(pos.x + size / 2 + 34, band.position.y - 10, pos.z + 10), tight ? "border-destructive text-destructive font-sans" : loose ? "border-scene-modified font-sans" : "border-scene-good font-sans"))
  }

  /** The crate wall with a stadium-shaped hand hole of width W. */
  private buildWall(W: number) {
    this.clear(this.wall)
    const kit = this.v.kit
    const shape = new THREE.Shape()
    shape.moveTo(-WALL.w / 2, 0)
    shape.lineTo(WALL.w / 2, 0)
    shape.lineTo(WALL.w / 2, WALL.h)
    shape.lineTo(-WALL.w / 2, WALL.h)
    shape.closePath()
    shape.holes.push(roundedRect(new THREE.Path(), W, SLOT_H, SLOT_H / 2 - 0.01, 0, SLOT_Z))
    const geo = extrude(shape, WALL.t, { curveSegments: 20 })
    geo.rotateX(Math.PI / 2)
    geo.translate(0, WALL.t, 0)
    this.wall.add(face(geo, kit, { feature: "wall" }))
    this.wall.add(tag(t("周转箱侧壁上的手孔", "Hand hole in the side of a crate"), new THREE.Vector3(WALL.w / 2 - 60, 0, WALL.h + 12)))
    this.builtWall = W
  }

  /**
   * A right hand, palm down, fingers along +Y, from simple solids. Origin on the knuckle line, at the
   * middle of the fingers' thickness. Proportions scale with the breadth B; `hit` fingers are painted red.
   */
  private buildHand(B: number, hit: number[]) {
    const g = new THREE.Group()
    const kit = this.v.kit
    const L = 2.2 * B
    const palmLen = 0.56 * L
    const T = 0.28 * B
    const palmShape = roundedRect(new THREE.Shape(), B, palmLen, B * 0.18, 0, -palmLen / 2 + 4)
    const palmGeo = extrude(palmShape, T, { round: T * 0.45, curveSegments: 10 })
    palmGeo.translate(0, 0, -T / 2 + B * 0.03)
    g.add(face(palmGeo, kit, { edges: false }))
    ;(g.children[0] as THREE.Mesh).material = this.skin
    const r = (B / 8) * 0.95
    const lens = [0.38, 0.42, 0.39, 0.31]
    lens.forEach((f, i) => {
      const len = f * L
      const rr = i === 3 ? r * 0.88 : r
      const geo = new THREE.CapsuleGeometry(rr, Math.max(1, len - 2 * rr), 6, 12)
      geo.scale(1, 1, 0.82)
      const m = new THREE.Mesh(geo, hit.includes(i) ? this.bad : this.skin)
      m.position.set(((2 * i - 3) * B) / 8, len / 2 - (i === 3 ? 5 : 0), 0)
      g.add(m)
    })
    // Thumb: along the index side, angled forward and tucked a little under the palm.
    const tl = 0.3 * L
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(r * 1.05, tl - 2 * r, 6, 12), this.skin)
    thumb.position.set(-B / 2 - r * 0.6, -palmLen * 0.45, -T * 0.25)
    thumb.rotation.z = 0.55
    g.add(thumb)
    // Forearm stub.
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(B * 0.3, B * 0.33, 70, 20), this.skin)
    arm.scale.set(1, 1, 0.7)
    arm.position.set(0, -palmLen - 32, 0)
    g.add(arm)
    for (const c of g.children) c.add(new THREE.LineSegments(new THREE.EdgesGeometry((c as THREE.Mesh).geometry, 40), kit.edgeSoft))
    return g
  }

  private renderCrowd() {
    const s = this.state
    const tk = this.v.tokens
    const n = FUNNEL[0]
    const keep = s.dims === 0 ? 0 : FUNNEL[s.dims]
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    const lit: THREE.Vector3[] = []
    const step = 6
    const half = ((COLS - 1) * step) / 2
    for (let k = 0; k < n; k++) {
      const i = this.rank[k]
      const x = (i % COLS) * step - half
      const y = Math.floor(i / COLS) * step - half
      const on = k < keep
      const out = s.dims > 0 && !on
      m.makeScale(1, 1, on ? 15 : out ? 5 : 9)
      m.setPosition(x, y, 0)
      this.crowd.setMatrixAt(i, m)
      c.copy(on ? tk.highlight : out ? tk.ghost : tk.edgeSoft)
      if (out) c.lerp(tk.bg, 0.45)
      this.crowd.setColorAt(i, c)
      if (on && keep <= 12) lit.push(new THREE.Vector3(x, y, 16))
    }
    this.crowd.instanceMatrix.needsUpdate = true
    if (this.crowd.instanceColor) this.crowd.instanceColor.needsUpdate = true
    this.clear(this.crowdLabels)
    for (const p of lit) this.crowdLabels.add(line([p.clone(), p.clone().add(new THREE.Vector3(0, 0, 26))], this.v.kit.sketchThin))
    const text =
      s.dims === 0
        ? t(`${n} 名飞行员`, `${n} airmen`)
        : keep === 0
          ? t("一个也不剩", "Not one left")
          : t(`还剩 ${keep} 人`, `${keep} left`)
    this.crowdLabels.add(label(text, new THREE.Vector3(-half, half + 14, 30), keep === 0 && s.dims > 0 ? "border-destructive text-destructive font-sans" : "font-sans"))
  }
}

export const pctIn = (g: Group, x: number) => pctOf(HB[g], x)
