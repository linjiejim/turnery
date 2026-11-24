import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { edges, label, line } from "@/three/build"
import { extrude, roundedRect } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 6.5.4 「活动铰链」: a one-piece box, moulded open: the base and the lid lie
 * side by side, rims up, joined at their rims by a thin web. Closing folds
 * the web through 180°. The web keeps its length L and bends into an arc of
 * radius r = L / φ (a semicircle of R = L / π when closed); the outer fibre
 * stretches by ε = t / (2r) = t·φ / (2L). Simplified on purpose: real webs
 * bend unevenly and PP goes far past yield, which is the point of PP.
 */

export type Material = "PP" | "PE" | "ABS" | "PC" | "PS"
export const MATERIALS: Material[] = ["PP", "PE", "ABS", "PC", "PS"]
/** PP and PE cold-draw on the first flexes and then take repeated folding; the others don't. */
export const FLEXES = (m: Material) => m === "PP" || m === "PE"
/**
 * Covestro (Bayer) "Snap-Fit Joints for Plastics", Table 2: about 4 % short-term strain for PC in a
 * one-time snap; about 60 % of that (2.4 %) for repeated use. Used here as the yardstick for the
 * stiff amorphous plastics (ABS and PS are of the same order or lower; check the resin maker's data).
 */
export const PC_ONCE = 4
export const PC_REPEAT = 2.4
/** Hinge thickness from the design guides (they differ): start 0.20–0.25, up to 0.38 mm; some go to 0.5. */
export const T_GUIDE: [number, number] = [0.2, 0.38]
export const T_SOFT_MAX = 0.5
/** Hinge (land) length: about 1.5 mm is typical; the band drawn green here is illustrative. */
export const L_GUIDE: [number, number] = [1, 3]

export type Gate = "base" | "side" | "two"

export type HingeState = {
  step: number
  /** Fold angle, radians: 0 open (as moulded) … π closed. */
  phi: number
  t: number
  L: number
  material: Material
  /** Completed open–close cycles in the endurance run, and whether it cracked. */
  cycles: number
  cracked: boolean
  gate: Gate
  /** Melt flow progress 0 … 1.2. */
  fill: number
  flexed: boolean
  closedOnce: boolean
  triedStrain: boolean
  triedLong: boolean
  materialsRun: Material[]
  gatesRun: Gate[]
}

/** Strain of the outer fibre at fold angle phi, %. */
export const strainAt = (t: number, L: number, phi: number) => ((t * phi) / (2 * L)) * 100
/** At the full 180° fold. */
export const strain180 = (t: number, L: number) => strainAt(t, L, Math.PI)
/** The hinge length a stiff plastic would need to stay under its repeated-use strain at 180°. */
export const lengthFor = (t: number, limitPct: number) => (Math.PI * t) / (2 * (limitPct / 100))

export type Check = "good" | "warn" | "bad"
export const thicknessCheck = (t: number): Check => (t >= T_GUIDE[0] - 1e-9 && t <= T_GUIDE[1] + 1e-9 ? "good" : t > T_GUIDE[1] && t <= T_SOFT_MAX + 1e-9 ? "warn" : "bad")
export const lengthCheck = (L: number): Check => (L >= L_GUIDE[0] - 1e-9 && L <= L_GUIDE[1] + 1e-9 ? "good" : "warn")

// ------------------------------------------------------------------ geometry (mm)

const W = 40
const D = 28
const H = 10
const WALL = 1.4
const CORNER = 3
/** Width of the web along the hinge line. */
const WX = 32

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** An open box, rim up, footprint centred on (0, cy). */
function openBox(cy: number) {
  const ring = roundedRect(new THREE.Shape(), W, D, CORNER, 0, cy)
  ring.holes.push(roundedRect(new THREE.Path(), W - 2 * WALL, D - 2 * WALL, CORNER - WALL, 0, cy))
  const walls = extrude(ring, H - WALL, { z0: WALL })
  const floor = extrude(roundedRect(new THREE.Shape(), W, D, CORNER, 0, cy), WALL)
  return [walls, floor]
}

/** The web: thickness t, length L, bent to angle phi (arc radius L / phi), starting at (y 0, z zh) heading +Y. */
function webGeo(L: number, t: number, phi: number, zh: number, n = 28) {
  const pos: number[] = []
  const at = (s: number, off: number): [number, number] => {
    if (phi < 1e-4) return [s, zh - off]
    const r = L / phi
    const a = s / r
    // Centre of curvature is towards +Z (the fold closes upwards); `off` > 0 is the outer, stretched side.
    return [r * Math.sin(a) + off * Math.sin(a), zh + r * (1 - Math.cos(a)) - off * Math.cos(a)]
  }
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d)
  for (let i = 0; i < n; i++) {
    const s0 = (L * i) / n
    const s1 = (L * (i + 1)) / n
    const [o0y, o0z] = at(s0, t / 2)
    const [o1y, o1z] = at(s1, t / 2)
    const [i0y, i0z] = at(s0, -t / 2)
    const [i1y, i1z] = at(s1, -t / 2)
    const x0 = -WX / 2
    const x1 = WX / 2
    quad([x0, o0y, o0z], [x1, o0y, o0z], [x1, o1y, o1z], [x0, o1y, o1z]) // outer
    quad([x0, i0y, i0z], [x0, i1y, i1z], [x1, i1y, i1z], [x1, i0y, i0z]) // inner
    quad([x1, o0y, o0z], [x1, i0y, i0z], [x1, i1y, i1z], [x1, o1y, o1z]) // end +X
    quad([x0, o0y, o0z], [x0, o1y, o1z], [x0, i1y, i1z], [x0, i0y, i0z]) // end −X
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return { geo: g, at }
}

const initial = (): HingeState => ({
  step: 0,
  phi: 0,
  t: 0.3,
  L: 1.5,
  material: "PP",
  cycles: 0,
  cracked: false,
  gate: "side",
  fill: 0,
  flexed: false,
  closedOnce: false,
  triedStrain: false,
  triedLong: false,
  materialsRun: [],
  gatesRun: [],
})

export class LivingHingeScene extends LessonScene<HingeState> {
  private base = new THREE.Group()
  private lid = new THREE.Group()
  private web = new THREE.Group()
  private notes = new THREE.Group()
  private flow = new THREE.Group()
  private handle: CSS2DObject
  private boxMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  private webMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, side: THREE.DoubleSide })
  private meltMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })
  private gateMat = new THREE.MeshBasicMaterial()
  private builtL = NaN
  private meltTimes: number[] = []

  constructor(v: Viewer, emit: (s: HingeState) => void) {
    super(v, emit, initial())
    v.setGrid(80, 10)
    for (const m of [this.boxMat, this.webMat, this.meltMat, this.gateMat]) this.own(() => m.dispose())
    this.handle = this.makeHandle()
    this.lid.add(this.handle)
    this.root.add(this.base, this.lid, this.web, this.notes, this.flow)
  }

  enter(step: number) {
    for (const tag of ["fold", "cycles", "melt", "flex"]) this.v.tweens.cancel(tag)
    const patch: Partial<HingeState> = { step, cycles: 0, cracked: false }
    if (step === 0) Object.assign(patch, { phi: 0, t: 0.3, L: 1.5, material: "PP" })
    if (step === 1) Object.assign(patch, { phi: Math.PI, t: 0.3, L: 1.5, material: "PP" })
    if (step === 2) Object.assign(patch, { phi: 0, t: 0.3, L: 1.5, material: "ABS" })
    if (step === 3) Object.assign(patch, { phi: 0, t: 0.3, L: 1.5, material: "PP", gate: "side", fill: 1.2 })
    if (step === 4) Object.assign(patch, { phi: 0, material: "PP", flexed: false })
    if (step === 4 && this.state.gatesRun.length === 0) patch.gate = "base"
    this.set(patch)
    const v = this.v
    const zh = H - this.state.L / Math.PI
    if (step === 0) v.flyTo(V(70, -95, 92), V(-8, 14, 4), 900)
    else if (step === 1) v.setView("right", { target: V(WX / 2, 0.2, zh + 0.5), distance: 15 })
    else if (step === 2) v.flyTo(V(85, -40, 70), V(-4, 6, 8), 900)
    else if (step === 3) v.setView("top", { target: V(-14, this.state.L / 2, 0), distance: 165 })
    else v.flyTo(V(58, 40, 42), V(-6, 2, zh - 2), 900)
  }

  // ------------------------------------------------------------ actions

  setPhi(phi: number) {
    const p = Math.max(0, Math.min(Math.PI, phi))
    this.set({ phi: p, closedOnce: this.state.closedOnce || p > Math.PI * 0.97 })
  }

  playFold() {
    const from = this.state.phi
    const to = from > Math.PI / 2 ? 0 : Math.PI
    this.v.tweens.run(1300, (k) => this.setPhi(from + (to - from) * k), { tag: "fold" })
  }

  setT(t: number) {
    this.set({ t, triedStrain: this.state.triedStrain || this.state.step === 1 })
  }

  setL(L: number) {
    const s = this.state
    this.set({ L, triedStrain: s.triedStrain || s.step === 1, triedLong: s.triedLong || (s.step === 1 && strain180(s.t, L) <= PC_REPEAT) })
  }

  setMaterial(material: Material) {
    this.v.tweens.cancel("cycles")
    this.set({ material, cycles: 0, cracked: false, phi: 0 })
  }

  /**
   * Open and close ten times. PP and PE come through; the stiff plastics whiten on the first fold
   * (past their strain limit) and crack a few cycles in (illustrative: the count depends on grade and design).
   */
  runCycles() {
    const s = this.state
    this.set({ cycles: 0, cracked: false, phi: 0 })
    const m = s.material
    const flexes = FLEXES(m)
    const total = 10
    const crackAt = 3
    const seen = () => (this.state.materialsRun.includes(m) ? this.state.materialsRun : [...this.state.materialsRun, m])
    this.v.tweens
      .run(
        total * 520,
        (k) => {
          if (this.state.cracked) return
          const c = k * total
          if (!flexes && c >= crackAt - 0.5) {
            this.set({ cracked: true, cycles: crackAt, phi: Math.PI * 0.62, materialsRun: seen() })
            return
          }
          const done = Math.floor(c)
          const phase = c - done
          this.set({ cycles: Math.min(total, done), phi: Math.PI * (phase < 0.5 ? phase * 2 : 2 - phase * 2) })
        },
        { tag: "cycles", ease: (x) => x },
      )
      .then(() => {
        if (flexes && this.state.material === m && this.state.cycles >= total - 1) this.set({ cycles: total, phi: 0, materialsRun: seen() })
      })
  }

  setGate(gate: Gate) {
    this.v.tweens.cancel("melt")
    this.set({ gate, fill: 0 })
  }

  playFill(gate = this.state.gate) {
    this.set({ gate, fill: 0 })
    this.v.tweens.run(1800, (k) => this.set({ fill: k * 1.2 }), { tag: "melt", ease: (x) => x }).then(() => {
      if (this.state.fill >= 1.2 && !this.state.gatesRun.includes(gate)) this.set({ gatesRun: [...this.state.gatesRun, gate] })
    })
  }

  /** Fold it a few times straight out of the mould, while it's warm. */
  flexWarm() {
    this.v.tweens.run(
      2400,
      (k) => {
        const c = k * 3
        const phase = c - Math.floor(c)
        this.state.phi = k >= 1 ? 0 : Math.PI * 0.95 * (phase < 0.5 ? phase * 2 : 2 - phase * 2)
        this.render()
      },
      { tag: "flex", ease: (x) => x },
    ).then(() => this.set({ phi: 0, flexed: true }))
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.boxMat.color.copy(tk.model)
    this.gateMat.color.copy(tk.sketch)
    const R = s.L / Math.PI
    const zh = H - R

    // The two halves (rebuilt only when the hinge length moves the lid).
    if (s.L !== this.builtL) {
      this.builtL = s.L
      this.clear(this.base)
      for (const c of [...this.lid.children]) if (c !== this.handle) {
        this.lid.remove(c)
        c.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
      }
      for (const g of openBox(-D / 2)) this.base.add(this.mesh(g))
      for (const g of openBox(s.L + D / 2)) this.lid.add(this.mesh(g))
      this.handle.position.set(0, s.L + D, H)
    }
    // Lid: rotate by phi about its hinge edge, then carry that edge to the end of the bent web.
    const { geo, at } = webGeo(s.L, s.t, s.phi, zh)
    const [ey, ez] = at(s.L, 0)
    const rot = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), s.phi)
    const pivot = V(0, s.L, zh).applyQuaternion(rot)
    this.lid.quaternion.copy(rot)
    this.lid.position.set(0, ey - pivot.y, ez - pivot.z)
    this.handle.visible = s.step === 0

    // Web colour: its state for this material and this fold.
    const eps = strainAt(s.t, s.L, s.phi)
    const flexes = FLEXES(s.material)
    let tone: THREE.Color = tk.highlight
    if (s.step >= 2) {
      if (!flexes) tone = s.cracked ? tk.bad : eps > PC_REPEAT ? tk.warn : tk.good
      else tone = s.step === 4 && thicknessCheck(s.t) !== "good" ? tk.warn : tk.good
    }
    if (!flexes && s.step >= 2 && eps > PC_REPEAT && !s.cracked) tone = tk.paper.clone().lerp(tk.warn, 0.55)
    this.webMat.color.copy(tone)
    this.clear(this.web)
    const webMesh = new THREE.Mesh(geo, this.webMat)
    webMesh.add(edges(geo, kit, 35))
    this.web.add(webMesh)

    this.clear(this.notes)
    this.annotate(s, { zh, at, eps })
    this.renderFlow(s)
    this.v.invalidate()
  }

  private mesh(g: THREE.BufferGeometry) {
    const m = new THREE.Mesh(g, this.boxMat)
    m.add(edges(g, this.v.kit, 30))
    return m
  }

  private annotate(s: HingeState, g: { zh: number; at: (s: number, off: number) => [number, number]; eps: number }) {
    const kit = this.v.kit
    const n = this.notes
    const plain = "border-transparent bg-transparent font-sans text-muted-foreground"
    const x = WX / 2 + 0.05
    if (s.step === 0) {
      n.add(label(t("底座", "Base"), V(-W / 2 - 4, -D / 2, H), plain))
      if (s.phi < 0.3) n.add(label(t("盖子", "Lid"), V(-W / 2 - 4, s.L + D / 2, H), plain))
      n.add(label(t("活动铰链：一层薄膜", "Living hinge: a thin web"), V(-WX / 2 - 1, 0, H + 3), "font-sans"))
    }
    if (s.step === 1 && s.phi > 0.5) {
      // The outer fibre (stretched) and the inner one (squashed), drawn on the web's end face.
      const outer: THREE.Vector3[] = []
      const inner: THREE.Vector3[] = []
      for (let i = 0; i <= 24; i++) {
        const [oy, oz] = g.at((s.L * i) / 24, s.t / 2)
        const [iy, iz] = g.at((s.L * i) / 24, -s.t / 2)
        outer.push(V(x, oy, oz))
        inner.push(V(x, iy, iz))
      }
      n.add(line(outer, kit.sketch))
      const [my, mz] = g.at(s.L / 2, s.t / 2)
      const [ny, nz] = g.at(s.L / 2, -s.t / 2)
      n.add(label(t(`外侧被拉长 ${g.eps.toFixed(0)}%`, `Outside stretched ${g.eps.toFixed(0)}%`), V(x, my + 1.4, mz), "border-primary text-primary font-sans"))
      n.add(label(t("内侧被压短", "Inside squashed"), V(x, ny - 1.3, nz + 0.9), "font-sans"))
      const r = s.L / s.phi
      n.add(label(t(`弯曲半径 R ≈ ${r.toFixed(2)} mm`, `Bend radius R ≈ ${r.toFixed(2)} mm`), V(x, my + 1.4, g.zh + 2.2), "font-sans"))
    }
    if (s.step === 2 && !FLEXES(s.material)) {
      if (s.cracked) n.add(label(t("发白，几次后开裂（示意）", "Whitened, then cracked after a few folds (illustrative)"), V(0, 0, H + 6), "border-destructive text-destructive font-sans"))
      else if (g.eps > PC_REPEAT) n.add(label(t("超过允许应变：发白", "Past the allowable strain: whitening"), V(0, 0, H + 6), "border-warning text-warning font-sans"))
    }
    if (s.step === 2 && FLEXES(s.material) && s.cycles > 0)
      n.add(label(t(`开合 ${s.cycles} 次：完好`, `${s.cycles} cycles: intact`), V(0, 0, H + 6), "border-success text-success font-sans"))
    if (s.step === 4) {
      n.add(label(t(`厚 ${s.t.toFixed(2)} · 长 ${s.L.toFixed(1)} mm`, `${s.t.toFixed(2)} thick · ${s.L.toFixed(1)} mm long`), V(WX / 2 - 2, s.L / 2, H + 1.5)))
      if (s.flexed) n.add(label(t("出模后折过：分子沿弯折方向拉开", "Flexed out of the mould: molecules drawn out across the fold"), V(-WX / 2 + 6, s.L / 2, H + 1.5), "border-success text-success font-sans"))
    }
  }

  /** Step 4: the melt front over the open part, seen from above, and what it leaves at the hinge. */
  private renderFlow(s: HingeState) {
    this.clear(this.flow)
    if (s.step !== 3) return
    const kit = this.v.kit
    const tk = this.v.tokens
    const z = H + 0.4
    const ys: number[] = []
    for (let y = -D; y < 0 - 1e-6; y += 1) ys.push(y)
    for (let i = 0; i < 3; i++) ys.push((s.L * i) / 3)
    for (let y = s.L; y < s.L + D - 1e-6; y += 1) ys.push(y)
    ys.push(s.L + D)
    const pos: number[] = []
    this.meltTimes = []
    const total = 2 * D + s.L
    const time = (x: number, y: number) => {
      if (s.gate === "base") return (y + D) / total + (y > 0 ? 0.08 : 0)
      if (s.gate === "two") return Math.min(y + D, s.L + D - y) / (total / 2)
      return Math.hypot(x + W / 2, y - s.L / 2) / Math.hypot(W, D + s.L / 2)
    }
    for (let j = 0; j < ys.length - 1; j++) {
      const y0 = ys[j]
      const y1 = ys[j + 1]
      const inHinge = y0 >= -1e-6 && y1 <= s.L + 1e-6
      for (let x0 = -W / 2; x0 < W / 2 - 1e-6; x0 += 1) {
        const x1 = x0 + 1
        if (inHinge && (x0 < -WX / 2 || x1 > WX / 2)) continue
        pos.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z)
        this.meltTimes.push(time((x0 + x1) / 2, (y0 + y1) / 2))
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    // Only the cells the melt has reached are drawn.
    const keep: number[] = []
    for (let c = 0; c < this.meltTimes.length; c++) if (this.meltTimes[c] <= s.fill) keep.push(...pos.slice(c * 18, c * 18 + 18))
    g.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3))
    const col = new Float32Array(keep.length)
    for (let k = 0; k < keep.length / 3; k++) col.set([tk.highlight.r, tk.highlight.g, tk.highlight.b], k * 3)
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    this.flow.add(new THREE.Mesh(g, this.meltMat))

    // Gates.
    const plain = "border-transparent bg-transparent font-sans text-muted-foreground"
    const gateLine = (y: number) => {
      this.flow.add(line([V(-W / 2 + 4, y, z + 0.2), V(W / 2 - 4, y, z + 0.2)], kit.sketch))
      this.flow.add(label(t("浇口", "Gate"), V(W / 2 + 2, y, z), plain))
    }
    if (s.gate === "base" || s.gate === "two") gateLine(-D)
    if (s.gate === "two") gateLine(s.L + D)
    if (s.gate === "side") {
      const cone = new THREE.ConeGeometry(1.6, 4, 16)
      cone.rotateX(-Math.PI / 2)
      cone.translate(-W / 2 - 1.5, s.L / 2, z + 2)
      this.flow.add(new THREE.Mesh(cone, this.gateMat))
      this.flow.add(label(t("浇口", "Gate"), V(-W / 2 - 3, s.L / 2 - 4, z), plain))
    }

    // What the hinge ends up with, once the cavity is full.
    if (s.fill < 1.05) return
    const zz = z + 0.3
    if (s.gate === "base") {
      for (let x = -WX / 2 + 3; x <= WX / 2 - 3; x += 4) this.flow.add(line([V(x, -2.2, zz), V(x, s.L + 2.2, zz)], kit.sketchDefined))
      this.flow.add(label(t("料横穿铰链：取向跨过折痕", "Melt crosses the hinge: orientation runs across the fold"), V(0, s.L + D + 6, z), "border-success text-success font-sans"))
    } else if (s.gate === "side") {
      for (let k = 0; k < 3; k++) this.flow.add(line([V(-WX / 2 + 1, -1.2 + k * (s.L / 2 + 1.2), zz), V(WX / 2 - 1, -1.2 + k * (s.L / 2 + 1.2), zz)], kit.sketchDefined))
      this.flow.add(label(t("料顺着铰链走：取向和折痕平行，容易沿折痕撕开", "Melt runs along the hinge: orientation parallel to the fold, so it splits along it"), V(0, s.L + D + 6, z), "border-warning text-warning font-sans"))
    } else {
      // The weld line: a zigzag along the middle of the hinge, where the two fronts met.
      const zig: THREE.Vector3[] = []
      for (let i = 0; i <= 32; i++) zig.push(V(-WX / 2 + (i * WX) / 32, s.L / 2 + (i % 2 ? 1 : -1), zz))
      this.flow.add(line(zig, kit.sketchDefined))
      this.flow.add(label(t("两股料在铰链上相遇：熔接线，一折就裂", "Two fronts meet on the hinge: a weld line that cracks on the first fold"), V(0, s.L + D + 6, z), "border-destructive text-destructive font-sans"))
    }
  }

  private makeHandle() {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("拖动盖子合上", "Drag the lid closed")
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      this.v.tweens.cancel("fold")
      const plane = new THREE.Plane(V(1, 0, 0), -W / 2)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const zh = H - this.state.L / Math.PI
        const a = Math.atan2(hit.z - zh, hit.y - this.state.L / 2)
        // Below the hinge on the closed side reads as fully closed, not open.
        this.setPhi(a < -Math.PI / 2 ? Math.PI : a)
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
    })
    return new CSS2DObject(el)
  }
}
