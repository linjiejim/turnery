import * as THREE from "three"
import { edges, face, label, line, tag } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 4.4.6 「卡扣」: a cantilever snap hook standing on part A, and a plate
 * (part B) pushed down over it. The hook's lead face pushes the arm aside,
 * the plate's edge slides over the tip, and the arm snaps back under it.
 * The arm is coloured by its bending strain at the current deflection,
 * from the Covestro (Bayer) cantilever equations: constant section
 * y = 0.67·ε·L²/t, i.e. ε = 1.5·t·y/L²; thickness tapering to half at the
 * hook y = 1.09·ε·L²/t, i.e. ε ≈ 0.92·t·y/L² (t at the root).
 *
 * Layout: the arm's front face (the hook side) is the plane x = 0; the
 * hook sticks out along +X; the arm bends towards −X. Width along Y.
 */
export type Material = "pc" | "pcabs" | "abs" | "pa" | "pcgf"
export type Mould = "none" | "window" | "slide"

export type SnapState = {
  step: number
  L: number
  t: number
  y: number
  tapered: boolean
  material: Material
  repeated: boolean
  /** Lead (insertion) and return (retention) angles, degrees from the insertion direction. */
  lead: number
  ret: number
  /** 0 apart … 1 snapped home. */
  progress: number
  /** Pull-off attempt: 0 seated … 1 off (or stuck part way). */
  pull: number
  locked: boolean
  mould: Mould
  open: number
  stuck: boolean
  snapped: boolean
  triedTaper: boolean
  triedConst: boolean
  pulledSeparable: boolean
  pulledLocked: boolean
  openedMould: boolean
}

/**
 * Permissible short-term strain for a single snap at 23 °C, from Covestro (Bayer) design guides
 * (Part and Mold Design, table 4-1). Values depend on the grade; for repeated assembly use about 60%.
 */
export const MATERIALS: Record<Material, { name: string; strain: number }> = {
  pc: { name: t("PC", "PC"), strain: 4.0 },
  pcabs: { name: t("PC/ABS", "PC/ABS"), strain: 2.5 },
  abs: { name: t("ABS", "ABS"), strain: 1.8 },
  pa: { name: t("PA 调湿", "PA cond."), strain: 6.0 },
  pcgf: { name: t("PC+GF20", "PC+GF20"), strain: 2.0 },
}
export const REPEAT = 0.6
/** Friction between two parts of the same plastic, about 0.5 on steel × 1.2 (Covestro table 3, PC). */
export const MU = 0.6
export const LOCK_ANGLE = THREE.MathUtils.radToDeg(Math.atan(1 / MU))
export const WIDTH = 8
const LAND = 0.6
const PLATE = 2.5
/** Clearance between plate B's edge and the arm's front face: the deflection equals the hook depth. */
const GAP = 0.05

/** Root strain (fraction) for a deflection d at the hook. */
export function strainAt(s: Pick<SnapState, "L" | "t" | "tapered">, d: number) {
  return s.tapered ? (s.t * d) / (1.09 * s.L * s.L) : (1.5 * s.t * d) / (s.L * s.L)
}
export const maxStrain = (s: SnapState) => strainAt(s, s.y) * 100
export const permissible = (s: SnapState) => MATERIALS[s.material].strain * (s.repeated ? REPEAT : 1)
/** Mating force over deflection force for a face at `deg` to the insertion direction (∞ once self-locking). */
export function forceFactor(deg: number) {
  const k = Math.tan(THREE.MathUtils.degToRad(deg))
  const den = 1 - MU * k
  return den <= 0 ? Infinity : (MU + k) / den
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const cot = (deg: number) => 1 / Math.tan(THREE.MathUtils.degToRad(deg))

/** The hook's outline above the arm tip: heights of its corners. */
export function hookOf(s: Pick<SnapState, "L" | "y" | "lead" | "ret">) {
  const r1 = s.L + s.y * cot(s.ret)
  const r2 = r1 + LAND
  const top = r2 + s.y * cot(s.lead)
  return { r0: s.L, r1, r2, top }
}

/** How far the hook sticks out at height z (0 below or above it). */
function hookX(s: SnapState, z: number) {
  const h = hookOf(s)
  if (z < h.r0 || z > h.top) return 0
  if (z <= h.r1) return h.r1 > h.r0 ? (s.y * (z - h.r0)) / (h.r1 - h.r0) : s.y
  if (z <= h.r2) return s.y
  return (s.y * (h.top - z)) / (h.top - h.r2)
}

/** Plate B's top for an assembly progress: from above the hook down to resting on its catch. */
function plateTop(s: SnapState, p: number) {
  const h = hookOf(s)
  const start = h.top + PLATE + 3
  return start + (s.L - start) * p
}

/** Deflection the plate's edge forces when its top is at zTop (the hook's widest point inside the plate band). */
function deflectionFor(s: SnapState, zTop: number) {
  let d = 0
  // Strictly inside the plate's edge: resting on the catch face doesn't bend the arm.
  for (let i = 0; i <= 24; i++) d = Math.max(d, hookX(s, zTop - 0.02 - ((PLATE - 0.04) * i) / 24) - GAP)
  return Math.max(0, d)
}

export class SnapScene extends LessonScene<SnapState> {
  private group = new THREE.Group()
  private mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })

  constructor(v: Viewer, emit: (s: SnapState) => void) {
    super(v, emit, {
      step: 0,
      L: 12,
      t: 2,
      y: 1.4,
      tapered: false,
      material: "pcabs",
      repeated: false,
      lead: 30,
      ret: 90,
      progress: 0,
      pull: 0,
      locked: false,
      mould: "none",
      open: 0,
      stuck: false,
      snapped: false,
      triedTaper: false,
      triedConst: false,
      pulledSeparable: false,
      pulledLocked: false,
      openedMould: false,
    })
    v.setGrid(60, 5)
    this.root.add(this.group)
  }

  enter(step: number) {
    this.v.tweens.cancel("snap")
    const patch: Partial<SnapState> = { step, pull: 0, locked: false, open: 0, stuck: false }
    if (step === 0) patch.progress = 0
    // Strain steps show the arm at its largest deflection: the plate's edge on the hook's tip.
    if (step >= 1 && step <= 3) patch.progress = this.tipProgress()
    if (step === 4 || step === 5) patch.progress = 1
    if (step <= 1) Object.assign(patch, { tapered: false })
    if (step <= 2) Object.assign(patch, { material: "pcabs", repeated: false })
    if (step !== 5) patch.mould = "none"
    this.set(patch)
    const v = this.v
    const mid = V(4, 0, this.state.L * 0.6)
    // Low, from the front and the hook's side: the face under the hook only shows from below its level.
    if (step === 5) v.flyTo(V(46, -62, 2), V(1, 0, 7), 900)
    else if (step === 4) v.flyTo(V(10, -78, mid.z + 6), mid.clone().add(V(2, 0, 3)), 900)
    // From the front and a little to the left: part B sits behind the beam, not in front of the hook.
    else v.flyTo(V(-24, -90, mid.z + 16), mid.clone().add(V(2, 0, 1)), 900)
  }

  /** Progress at which the plate's edge sits on the hook's tip (the largest deflection). */
  private tipProgress(s = this.state) {
    const h = hookOf(s)
    const start = h.top + PLATE + 3
    // Plate top at the land's middle plus the plate thickness.
    const zTop = (h.r1 + h.r2) / 2 + PLATE * 0.5
    return THREE.MathUtils.clamp((start - zTop) / (start - s.L), 0, 1)
  }

  // ------------------------------------------------------------ actions

  setDims(patch: Partial<Pick<SnapState, "L" | "t" | "y">>) {
    const n = { ...this.state, ...patch }
    const keepTip = this.state.step >= 1 && this.state.step <= 3
    this.set({ ...patch, progress: keepTip ? this.tipProgress(n) : this.state.progress })
  }

  setTapered(tapered: boolean) {
    this.set({ tapered, triedTaper: this.state.triedTaper || tapered, triedConst: this.state.triedConst || !tapered })
  }

  setMaterial(material: Material) {
    this.set({ material })
  }

  setRepeated(repeated: boolean) {
    this.set({ repeated })
  }

  setAngles(patch: Partial<Pick<SnapState, "lead" | "ret">>) {
    this.v.tweens.cancel("snap")
    this.set({ ...patch, pull: 0, locked: false })
  }

  setProgress(progress: number) {
    this.set({ progress, pull: 0, snapped: this.state.snapped || progress >= 0.999 })
  }

  /** Animate the plate from apart to snapped home. */
  assemble() {
    this.v.tweens.cancel("snap")
    this.set({ pull: 0, locked: false })
    this.v.tweens.run(1600, (k) => {
      this.state.progress = k
      this.render()
    }, { tag: "snap" }).then(() => this.set({ progress: 1, snapped: true }))
  }

  /** Try to pull the plate off: a return angle past the self-locking angle doesn't let go. */
  pullOff() {
    const s = this.state
    this.v.tweens.cancel("snap")
    const locked = forceFactor(s.ret) === Infinity
    this.set({ progress: 1, pull: 0, locked: false })
    this.v.tweens
      .run(locked ? 600 : 1400, (k) => {
        this.state.pull = locked ? k * 0.02 : k
        this.render()
      }, { tag: "snap" })
      .then(() => {
        if (this.state.step !== s.step) return
        this.set({
          pull: this.state.pull,
          locked,
          pulledLocked: this.state.pulledLocked || locked,
          pulledSeparable: this.state.pulledSeparable || !locked,
        })
      })
  }

  setMould(mould: Mould) {
    this.v.tweens.cancel("snap")
    this.set({ mould, open: 0, stuck: false })
  }

  toggleMould() {
    const s = this.state
    this.v.tweens.cancel("snap")
    if (s.open > 0) {
      this.set({ open: 0, stuck: false })
      return
    }
    const stuck = s.mould === "none"
    this.v.tweens
      .run(stuck ? 600 : 1600, (k) => {
        this.state.open = stuck ? k * 0.06 : k
        this.render()
      }, { tag: "snap" })
      .then(() => {
        if (this.state.step !== s.step) return
        this.set({ open: this.state.open, stuck, openedMould: this.state.openedMould || !stuck })
      })
  }

  /** Current deflection of the hook, mm. */
  deflection(s = this.state) {
    if (s.pull > 0) {
      // Pulling up: the plate's edge rides back over the return face.
      const h = hookOf(s)
      const zTop = s.L + (h.top + PLATE + 3 - s.L) * s.pull
      return deflectionFor(s, zTop)
    }
    return deflectionFor(s, plateTop(s, s.progress))
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.group)
    const d = this.deflection()
    const h = hookOf(s)
    const tz = (z: number) => (s.tapered ? s.t * (1 - z / (2 * s.L)) : s.t)
    const w = (z: number) => {
      const zz = Math.min(z, s.L)
      const base = (d * (3 * s.L * zz * zz - zz * zz * zz)) / (2 * s.L ** 3)
      return z > s.L ? base + ((1.5 * d) / s.L) * (z - s.L) : base
    }

    const root = strainAt(s, d) * 100
    const pm = permissible(s)
    const showStrain = s.step >= 1 && s.step <= 4

    // The beam: rows of rectangular sections up to the hook, bent by w(z) and coloured by the local strain.
    const n = 24
    const rows: { z: number; c: THREE.Color }[] = []
    for (let i = 0; i <= n; i++) {
      const z = (s.L * i) / n
      const c = new THREE.Color()
      if (showStrain) heat(c, (root * (1 - z / s.L) * (s.t / tz(z)) ** 2) / pm, tk)
      else c.copy(tk.model)
      rows.push({ z, c })
    }
    const beam = this.beam(rows, (z) => -w(z), (z) => -tz(z) - w(z))
    beam.add(edges(beam.geometry, kit, 20))
    this.group.add(beam)

    // The hook: its outline in XZ (counter-clockwise), riding on the beam's tip.
    const outline: [number, number][] = [
      [-tz(s.L), s.L],
      [0, s.L],
      [s.y, h.r1],
      [s.y, h.r2],
      [0, h.top],
      [-tz(s.L), h.top],
    ]
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x - w(z), z)))
    const geo = new THREE.ExtrudeGeometry(shape, { depth: WIDTH, bevelEnabled: false, curveSegments: 1 })
    geo.rotateX(Math.PI / 2)
    geo.translate(0, WIDTH / 2, 0)
    // In the mould step, the face under the hook is the undercut (non-indexed: one colour per triangle).
    const pos = geo.getAttribute("position")
    const col = new Float32Array(pos.count * 3)
    const p0 = new THREE.Vector3()
    const p1 = new THREE.Vector3()
    const p2 = new THREE.Vector3()
    for (let i = 0; i < pos.count; i += 3) {
      p0.fromBufferAttribute(pos, i)
      p1.fromBufferAttribute(pos, i + 1)
      p2.fromBufferAttribute(pos, i + 2)
      const nrm = p1.clone().sub(p0).cross(p2.clone().sub(p0)).normalize()
      const cx = (p0.x + p1.x + p2.x) / 3
      const under = s.step === 5 && nrm.z < -0.2 && cx > 0.01
      const c = s.step === 5 && under ? (s.mould === "none" ? tk.bad : tk.highlight) : tk.model
      for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3)
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3))
    const hook = new THREE.Mesh(geo, this.mat)
    hook.userData = { kind: "face", feature: "hook", role: "model" }
    hook.add(edges(geo, kit, 20))
    this.group.add(hook)

    // Part A: the base plate, with a window under the hook if the mould needs one.
    this.group.add(this.base(s))

    // Part B: the plate pushed over the hook.
    if (s.step <= 4) {
      const zTop = s.pull > 0 ? s.L + (h.top + PLATE + 3 - s.L) * s.pull : plateTop(s, s.progress)
      const bGeo = new THREE.BoxGeometry(24, WIDTH + 6, PLATE)
      bGeo.translate(GAP + 12, 0, zTop - PLATE / 2)
      const b = face(bGeo, kit, { feature: "plate", role: "modelDark" })
      this.group.add(b)
      this.group.add(tag(t("零件 B", "Part B"), V(GAP + 24, -WIDTH / 2 - 3, zTop)))
      if (s.locked) this.group.add(label(t("自锁：拉不下来，要拨开卡钩", "Self-locking: it won't pull off; the hook has to be pushed back"), V(GAP + 12, 0, zTop + 8), "border-warning text-warning font-sans"))
    }
    this.group.add(tag(t("零件 A", "Part A"), V(-12, -WIDTH / 2 - 6, -3)))

    // Strain annotations: the root, where the strain peaks.
    if (showStrain && d > 0.01) {
      const txt = t(`根部 ${root.toFixed(2)}%`, `Root ${root.toFixed(2)}%`)
      this.group.add(label(txt, V(2.5, -WIDTH / 2, 1.5), root > pm ? "border-warning text-warning" : ""))
    }
    if (s.step >= 1 && s.step <= 3) this.dims(s, d)
    if (s.step === 4) this.angles(s, d)
    if (s.step === 5) this.mouldParts(s)
    this.v.invalidate()
  }

  /** A straight-sided beam from rows: front face at xf(z), back at xb(z), width WIDTH, each row one colour. */
  private beam(rows: { z: number; c: THREE.Color }[], xf: (z: number) => number, xb: (z: number) => number) {
    const pos: number[] = []
    const nor: number[] = []
    const col: number[] = []
    const hw = WIDTH / 2
    const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ca: THREE.Color, cc: THREE.Color) => {
      const nrm = b.clone().sub(a).cross(d.clone().sub(a)).normalize()
      for (const [p, k] of [
        [a, ca],
        [b, ca],
        [c, cc],
        [a, ca],
        [c, cc],
        [d, cc],
      ] as const) {
        pos.push(p.x, p.y, p.z)
        nor.push(nrm.x, nrm.y, nrm.z)
        col.push(k.r, k.g, k.b)
      }
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const [r0, r1] = [rows[i], rows[i + 1]]
      const f0 = xf(r0.z)
      const f1 = xf(r1.z)
      const b0 = xb(r0.z)
      const b1 = xb(r1.z)
      // Front (+X), back (−X), and the two sides (±Y), each wound to face outward.
      quad(V(f0, -hw, r0.z), V(f0, hw, r0.z), V(f1, hw, r1.z), V(f1, -hw, r1.z), r0.c, r1.c)
      quad(V(b0, hw, r0.z), V(b0, -hw, r0.z), V(b1, -hw, r1.z), V(b1, hw, r1.z), r0.c, r1.c)
      quad(V(b0, -hw, r0.z), V(f0, -hw, r0.z), V(f1, -hw, r1.z), V(b1, -hw, r1.z), r0.c, r1.c)
      quad(V(f0, hw, r0.z), V(b0, hw, r0.z), V(b1, hw, r1.z), V(f1, hw, r1.z), r0.c, r1.c)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
    const m = new THREE.Mesh(g, this.mat)
    m.userData = { kind: "face", feature: "arm", role: "model" }
    return m
  }

  private base(s: SnapState) {
    const sh = new THREE.Shape()
    sh.moveTo(-14, -12)
    sh.lineTo(20, -12)
    sh.lineTo(20, 12)
    sh.lineTo(-14, 12)
    sh.closePath()
    if (s.step === 5 && s.mould === "window") {
      const hole = new THREE.Path()
      const [x0, x1, y0, y1] = [0, s.y + 0.4, -WIDTH / 2 - 0.3, WIDTH / 2 + 0.3]
      hole.moveTo(x0, y0)
      hole.lineTo(x0, y1)
      hole.lineTo(x1, y1)
      hole.lineTo(x1, y0)
      hole.closePath()
      sh.holes.push(hole)
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false })
    g.translate(0, 0, -3)
    return face(g, this.v.kit, { feature: "base", role: "model" })
  }

  /** L, t and y dimensions on the front (XZ) plane. */
  private dims(s: SnapState, d: number) {
    const kit = this.v.kit
    const yF = -WIDTH / 2 - 0.5
    const hk = hookOf(s)
    const add = (a: THREE.Vector3, b: THREE.Vector3, text: string, at: THREE.Vector3) => {
      this.group.add(line([a, b], kit.dimension))
      this.group.add(label(text, at))
    }
    add(V(-s.t - 4, yF, 0), V(-s.t - 4, yF, s.L), `L ${s.L}`, V(-s.t - 7, yF, s.L / 2))
    add(V(-s.t, yF, 0.4), V(0, yF, 0.4), `t ${s.t}`, V(-s.t / 2, yF, -2))
    const zt = (hk.r1 + hk.r2) / 2
    const tipX = -d - ((1.5 * d) / s.L) * (hk.top - s.L)
    add(V(tipX, yF, hk.top + 1.2), V(tipX + s.y, yF, hk.top + 1.2), `y ${s.y}`, V(tipX + s.y / 2, yF, hk.top + 3))
    // The undeflected arm, for reference.
    if (d > 0.05) this.group.add(line([V(0, yF, 0), V(0, yF, s.L), V(s.y, yF, zt)], kit.construction))
  }

  /** Lead and return angles drawn at the hook. */
  private angles(s: SnapState, d: number) {
    const kit = this.v.kit
    const hk = hookOf(s)
    const yF = -WIDTH / 2 - 0.5
    const off = (1.5 * d) / s.L
    const x = (xx: number, z: number) => xx - d - off * (z - s.L)
    // Insertion direction reference lines (vertical) through the face ends.
    const leadA = V(x(s.y, hk.r2), yF, hk.r2)
    const leadB = V(x(0, hk.top), yF, hk.top)
    const retA = V(x(0, hk.r0), yF, hk.r0)
    const retB = V(x(s.y, hk.r1), yF, hk.r1)
    this.group.add(line([leadA, leadA.clone().add(V(0, 0, 4))], kit.construction))
    this.group.add(line([retA, retA.clone().add(V(0, 0, -3))], kit.construction))
    this.group.add(line([leadA, leadB], kit.sketch), line([retA, retB], kit.sketch))
    this.group.add(label(t(`导入角 ${s.lead}°`, `Lead ${s.lead}°`), leadA.clone().add(V(3.5, 0, 2)), "border-primary text-primary"))
    this.group.add(label(t(`退出角 ${s.ret}°`, `Return ${s.ret}°`), retB.clone().add(V(3.5, 0, -1.2)), "border-primary text-primary"))
  }

  /** Mould pieces for the hook: the cavity above, and from below a core pin through the window, or a slide. */
  private mouldParts(s: SnapState) {
    const kit = this.v.kit
    const hk = hookOf(s)
    const lift = s.open * 18
    const ghost = (g: THREE.BufferGeometry) => {
      const m = face(g, kit, { feature: "mould", role: "ghost", edges: false })
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), kit.edgeGhost)
      e.raycast = () => {}
      m.add(e)
      return m
    }
    const cav = new THREE.BoxGeometry(18, WIDTH + 8, hk.top + 3)
    cav.translate(1, 0, (hk.top + 3) / 2)
    const cavity = ghost(cav)
    cavity.position.z = lift
    this.group.add(cavity, tag(t("型腔 · 向上", "Cavity · up"), V(-8, -WIDTH / 2 - 4, hk.top + 3 + lift)))
    if (s.mould === "window") {
      const g = new THREE.BoxGeometry(s.y + 0.4, WIDTH + 0.6, s.L + 3 + 10)
      g.translate((s.y + 0.4) / 2, 0, (s.L + 3 + 10) / 2 - 13)
      const pin = face(g, kit, { feature: "mould", role: "highlight" })
      pin.position.z = -s.open * 12
      this.group.add(pin, tag(t("型芯镶针 · 穿过窗口向下退", "Core pin · drops back through the window"), V(s.y + 2, -WIDTH / 2, -4 - s.open * 12)))
    }
    if (s.mould === "slide") {
      // The steel under the hook, from the arm's front face outward; it backs out along +X.
      const g = new THREE.BoxGeometry(10, WIDTH + 4, s.L - 0.5)
      g.translate(5, 0, (s.L - 0.5) / 2 + 0.5)
      const sl = face(g, kit, { feature: "mould", role: "highlight" })
      sl.position.x = Math.min(1, s.open / 0.4) * 10
      this.group.add(sl, tag(t("滑块 · 先沿 +X 退出", "Slide · backs out along +X first"), V(s.y + 14 + sl.position.x, 0, hk.r2 + 2)))
    }
    if (s.stuck) this.group.add(label(t("钩子下面的钢拔不出来", "The steel under the hook can't get out"), V(s.y + 4, 0, hk.top + 8), "border-warning text-warning font-sans"))
    // Pull direction.
    const ax = -13
    const top = hk.top + 2
    this.group.add(line([V(ax, 0, 2), V(ax, 0, top)], kit.sketch), line([V(ax - 1.2, 0, top - 2.5), V(ax, 0, top), V(ax + 1.2, 0, top - 2.5)], kit.sketch))
    this.group.add(label(t("开模方向", "Pull direction"), V(ax, 0, top + 2), "border-primary text-primary font-sans"))
  }

  dispose() {
    super.dispose()
    this.mat.dispose()
  }
}

/** Strain ratio to a colour: grey at rest, green, orange near the limit, red past it. */
function heat(out: THREE.Color, r: number, tk: Viewer["tokens"]) {
  if (r >= 1) return out.copy(tk.bad)
  if (r < 0.5) return out.copy(tk.model).lerp(tk.good, r / 0.5)
  if (r < 0.8) return out.copy(tk.good).lerp(tk.warn, (r - 0.5) / 0.3)
  return out.copy(tk.warn)
}
