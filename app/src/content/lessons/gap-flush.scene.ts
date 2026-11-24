import * as THREE from "three"
import { face, label, linearDim, tag } from "@/three/build"
import { lathe } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { DEFAULT_TOL, devOf, GAP0, flushOf, mm2, seamOf, worstDev, type ContribId, type Dev, type Mode, type Tol } from "./gap-flush.model"
import { LessonScene } from "./scene"

/**
 * 6.5.1 「缝隙与段差」: a cover (A) screwed into the opening of a base (B), cut through the screws.
 * The close-up shows the right seam of one assembled unit at true scale; the unit is drawn from the
 * Monte Carlo run (gap-flush.model.ts), or is the worst case. Tolerances, the locating scheme, the
 * designed step and the shadow line all rebuild the parts.
 */
export type GapState = {
  step: number
  tol: Tol
  mode: Mode
  seed: number
  /** Which unit is shown: an index into the run, or the worst case that opens (−1) or closes (−2) the gap. */
  pick: number
  draws: number
  sawWorst: number[]
  ran: boolean
  picked: boolean
  /** Designed step: the cover sits this much below the base, mm. */
  designStep: number
  shadow: boolean
  overview: boolean
  triedTol: ContribId[]
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/**
 * Everything that varies at the seam (the gap, the screw clearance, every deviation, the flush) is
 * drawn MAG times larger, so tenths of a millimetre show; the labels give the real values.
 */
export const MAG = 4
/** Base B and cover A, mm. Origin at the centre of the base's bottom; the seam studied is at +X. */
const A = { x: 50, y: 30, t: 3, top: 30 }
const B = { x: 56, y: 36, h: 30, wall: 2, floor: 2, rim: 6, openX: A.x + MAG * GAP0, openY: A.y + MAG * GAP0 }
const BOSS = { x: 44, ro: 4.5, pilot: 1.2, top: 21 }
const SCREW = { r: 1.45, head: 2.9, headH: 1.6 }
/** Real radial clearance of the screw in the cover's hole: located by the screws, or opened up. */
const CLEAR = { screw: 0.3, datum: 0.55 }
/** The cover's locating rib (datum mode): under the edge, bearing on the opening wall. */
const RIB = { w: 1.4, z0: 24.4, clear: 0.05 }
/** Shadow line: a real 0.3 mm chamfer on both edges. */
export const CHAMFER = 0.3

const CLOSE = { target: V(46.2, 0, 22.5), dir: V(0.26, -1, 0.5).normalize(), dist: 86 }

export class GapFlushScene extends LessonScene<GapState> {
  private parts = new THREE.Group()
  private marks = new THREE.Group()
  private matA: THREE.MeshStandardMaterial
  private matB: THREE.MeshStandardMaterial
  private matBad: THREE.MeshStandardMaterial

  constructor(v: Viewer, emit: (s: GapState) => void) {
    super(v, emit, {
      step: 0,
      tol: { ...DEFAULT_TOL },
      mode: "screw",
      seed: 1,
      pick: 0,
      draws: 0,
      sawWorst: [],
      ran: false,
      picked: false,
      designStep: 0,
      shadow: false,
      overview: false,
      triedTol: [],
    })
    v.setGrid(100, 10)
    v.kit.setSection(new THREE.Plane(V(0, 1, 0), 0))
    this.matA = cutMaterial(v.kit.clipping)
    this.matB = cutMaterial(v.kit.clipping)
    this.matBad = cutMaterial(v.kit.clipping)
    this.root.add(this.parts, this.marks)
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<GapState> = { step, overview: false }
    if (step <= 1) Object.assign(patch, { tol: { ...DEFAULT_TOL }, mode: "screw", designStep: 0, shadow: false })
    if (step === 1) patch.pick = -1
    if (step === 2) Object.assign(patch, { tol: { ...DEFAULT_TOL }, mode: "screw", pick: 0 })
    if (step === 3) Object.assign(patch, { mode: "screw", pick: 0, ran: true })
    if (step === 4) Object.assign(patch, { tol: { ...DEFAULT_TOL }, mode: "screw", pick: 0, ran: true })
    if (step === 5) Object.assign(patch, { designStep: 0, shadow: false, pick: 0, ran: true })
    if (step === 0) patch.pick = s.pick >= 0 ? s.pick : 0
    this.set(patch)
    if (step === 0) {
      // Start from the whole product, then close in on the seam.
      this.v.fit(new THREE.Box3(V(-B.x, -B.y, 0), V(B.x, B.y, B.h)), { dir: V(0.55, -1, 0.75), animate: false })
      this.v.flyTo(CLOSE.target.clone().addScaledVector(CLOSE.dir, CLOSE.dist), CLOSE.target, 1300)
    } else this.closeUp(900)
  }

  // ------------------------------------------------------------ actions

  /** Assemble one more unit at random (a fresh index into the run). */
  draw() {
    const s = this.state
    const pick = Math.floor(Math.random() * 1000)
    this.set({ pick, draws: s.draws + 1 })
  }

  showWorst(side: 1 | -1) {
    const s = this.state
    this.set({ pick: side > 0 ? -1 : -2, sawWorst: s.sawWorst.includes(side) ? s.sawWorst : [...s.sawWorst, side] })
  }

  run() {
    this.set({ seed: this.state.ran ? this.state.seed + 1 : this.state.seed, ran: true })
  }

  pickUnit(i: number) {
    this.set({ pick: i, picked: true, ran: true })
  }

  setTol(id: ContribId, v: number) {
    const s = this.state
    this.set({ tol: { ...s.tol, [id]: v }, triedTol: s.triedTol.includes(id) ? s.triedTol : [...s.triedTol, id] })
  }

  resetTol() {
    this.set({ tol: { ...DEFAULT_TOL } })
  }

  setMode(mode: Mode) {
    this.set({ mode })
  }

  setDesignStep(designStep: number) {
    this.set({ designStep })
  }

  setShadow(shadow: boolean) {
    this.set({ shadow })
  }

  toggleOverview() {
    const overview = !this.state.overview
    this.set({ overview })
    if (overview) this.v.fit(new THREE.Box3(V(-B.x, -B.y, 0), V(B.x, B.y, B.h)), { dir: V(0.55, -1, 0.75) })
    else this.closeUp(900)
  }

  private closeUp(ms: number) {
    this.v.flyTo(CLOSE.target.clone().addScaledVector(CLOSE.dir, CLOSE.dist), CLOSE.target, ms)
  }

  /** The deviations of the unit on show. */
  dev(): Dev {
    const s = this.state
    if (s.pick === -1) return worstDev(s.tol, s.mode, 1)
    if (s.pick === -2) return worstDev(s.tol, s.mode, -1)
    return devOf(s.seed, s.pick, s.tol)
  }

  // ------------------------------------------------------------ build

  protected render() {
    const s = this.state
    const v = this.v
    const kit = v.kit
    const tk = v.tokens
    this.matA.color.copy(tk.model).lerp(tk.highlight, 0.16)
    ;(this.matA.userData.uCut as { value: THREE.Color }).value.copy(tk.model).lerp(tk.highlight, 0.5)
    this.matB.color.copy(tk.model)
    ;(this.matB.userData.uCut as { value: THREE.Color }).value.copy(tk.cut)
    this.matBad.color.copy(tk.bad)
    ;(this.matBad.userData.uCut as { value: THREE.Color }).value.copy(tk.bad)
    this.clear(this.parts)
    this.clear(this.marks)

    const d = this.dev()
    const seam = seamOf(d, s.mode)
    const flush = flushOf(d, s.designStep)
    const shiftX = MAG * seam.shift
    const ch = s.shadow ? MAG * CHAMFER : 0
    const clash = seam.gap < 0

    // ---- base B
    const addB = (g: THREE.BufferGeometry) => {
      const m = face(g, kit, { feature: "base", edges: 25 })
      m.material = this.matB
      this.parts.add(m)
    }
    addB(box(-B.x, -B.y, 0, B.x, B.y, B.floor))
    addB(box(B.x - B.wall, -B.y, B.floor - 0.3, B.x, B.y, B.h - B.rim + 0.3))
    addB(box(-B.x, -B.y, B.floor - 0.3, -B.x + B.wall, B.y, B.h - B.rim + 0.3))
    addB(box(-B.x + B.wall, -B.y, B.floor - 0.3, B.x - B.wall, -B.y + B.wall, B.h - B.rim + 0.3))
    addB(box(-B.x + B.wall, B.y - B.wall, B.floor - 0.3, B.x - B.wall, B.y, B.h - B.rim + 0.3))
    const rimShape = new THREE.Shape([V(-B.x, -B.y, 0), V(B.x, -B.y, 0), V(B.x, B.y, 0), V(-B.x, B.y, 0)].map((p) => new THREE.Vector2(p.x, p.y)))
    rimShape.holes.push(new THREE.Path([new THREE.Vector2(-B.openX, -B.openY), new THREE.Vector2(-B.openX, B.openY), new THREE.Vector2(B.openX, B.openY), new THREE.Vector2(B.openX, -B.openY)]))
    addB(slab(rimShape, B.h - B.rim, B.h, ch))
    // The designed step lowers the bosses, so the whole cover sits that much lower.
    const bossX = BOSS.x + MAG * d.bossX
    const leftX = -BOSS.x + shiftX
    const bossTop = BOSS.top + MAG * (d.bossZ - s.designStep)
    addB(tube(bossX, 0, BOSS.pilot, BOSS.ro, B.floor - 0.3, bossTop))
    addB(tube(leftX, 0, BOSS.pilot, BOSS.ro, B.floor - 0.3, BOSS.top - MAG * s.designStep))

    // ---- cover A, built at its own origin, then placed
    const a = new THREE.Group()
    const half = A.x + MAG * seam.grow
    const holeR = SCREW.r + MAG * CLEAR[s.mode]
    const holeX = BOSS.x + MAG * d.hole
    const plate = new THREE.Shape([new THREE.Vector2(-half, -A.y), new THREE.Vector2(half, -A.y), new THREE.Vector2(half, A.y), new THREE.Vector2(-half, A.y)])
    for (const x of [holeX, -BOSS.x]) plate.holes.push(new THREE.Path().absarc(x, 0, holeR, 0, Math.PI * 2, true))
    const thick = A.t + MAG * d.sizeZ
    const addA = (g: THREE.BufferGeometry) => {
      const m = face(g, kit, { feature: "cover", edges: 25 })
      m.material = clash ? this.matBad : this.matA
      a.add(m)
    }
    addA(slab(plate, A.top - A.t, A.top - A.t + thick, ch))
    for (const x of [holeX, -BOSS.x]) addA(tube(x, 0, holeR, BOSS.ro, BOSS.top, A.top - A.t + 0.01))
    if (s.mode === "datum") {
      // One locating rib under the right edge, bearing on the opening wall (the other side has room).
      const out = B.openX - MAG * (RIB.clear + d.rib) - shiftX
      addA(box(out - RIB.w, -A.y + 4, RIB.z0, out, A.y - 4, A.top - A.t + 0.01))
    }
    // The cover sits on the boss: its height follows the boss top; its top follows its thickness; minus the designed step.
    a.position.set(shiftX, 0, bossTop - BOSS.top)
    this.parts.add(a)

    // ---- screws: on the bosses, heads on the cover
    const coverTop = A.top - A.t + thick + bossTop - BOSS.top
    for (const x of [bossX, leftX]) {
      const shank = new THREE.CylinderGeometry(SCREW.r, SCREW.r, coverTop - 12, 24)
      shank.rotateX(Math.PI / 2)
      shank.translate(x, 0, 12 + (coverTop - 12) / 2)
      const hr = Math.max(SCREW.head, holeR + 0.8)
      const head = new THREE.CylinderGeometry(hr * 0.85, hr, SCREW.headH, 32)
      head.rotateX(Math.PI / 2)
      head.translate(x, 0, coverTop + SCREW.headH / 2)
      this.parts.add(face(shank, kit, { role: "metal", edges: false }), face(head, kit, { role: "metal", edges: 40 }))
    }

    // ---- what we read at the right seam
    const edgeX = half + shiftX
    const zTop = Math.max(coverTop, B.h)
    if (!s.overview) {
      const dim = linearDim(kit, V(edgeX, -0.02, zTop), V(B.openX, -0.02, zTop), V(0, 0, 1), 1.4, t(`缝隙 ${seam.gap.toFixed(2)}`, `Gap ${seam.gap.toFixed(2)}`))
      this.marks.add(dim)
      const fl = Math.abs(flush) < 0.005 ? t("段差 0.00 · 齐平", "Flush 0.00 · level") : flush > 0 ? t(`段差 ${mm2(flush)} · 面盖凸出`, `Flush ${mm2(flush)} · cover proud`) : t(`段差 ${mm2(flush)} · 面盖低`, `Flush ${mm2(flush)} · cover low`)
      const fe = label(fl, V(B.openX + 0.9, -0.02, B.h + 0.15), flush > 0.005 ? "border-warning text-warning font-sans" : "font-sans")
      fe.center.set(0, 0.5)
      this.marks.add(fe)
      this.marks.add(tag(t("面盖 A", "Cover A"), V(48.2, -0.02, A.top + 2.6)), tag(t("底壳 B", "Base B"), V(55, -0.02, B.h - 3.6)))
      const fix = label(s.mode === "datum" ? t("孔放大：螺丝不再定位", "Oversized hole: the screw no longer locates") : t("螺丝与孔的间隙", "Screw-to-hole clearance"), V(bossX - holeR - 0.6, -0.02, A.top - A.t + 1.2), "font-sans")
      fix.center.set(1, 0.5)
      this.marks.add(fix)
      if (s.mode === "datum") {
        const r = label(t("定位筋靠着开口内壁", "Locating rib on the opening wall"), V(edgeX - 0.6, -0.02, RIB.z0 - 0.8), "border-primary text-primary font-sans")
        r.center.set(1, 0.5)
        this.marks.add(r)
      }
      if (clash) this.marks.add(label(t("干涉：面盖顶到底壳，装不进去", "Interference: the cover hits the base and won't go in"), V(edgeX - 3, -0.02, A.top + 4.6), "border-destructive text-destructive font-sans"))
    } else {
      const left = GAP0 + seam.shift - seam.grow
      this.marks.add(
        label(t(`右缝 ${seam.gap.toFixed(2)}`, `Right gap ${seam.gap.toFixed(2)}`), V(B.openX, 0, B.h + 6), "font-sans"),
        label(t(`左缝 ${left.toFixed(2)}`, `Left gap ${left.toFixed(2)}`), V(-B.openX, 0, B.h + 6), "font-sans"),
      )
    }
    v.invalidate()
  }

  dispose() {
    this.v.kit.setSection(null)
    super.dispose()
    this.matA.dispose()
    this.matB.dispose()
    this.matBad.dispose()
  }
}

// ------------------------------------------------------------ geometry helpers

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g
}

/** A flat shape (with holes) from z0 to z1; `ch` chamfers its top and bottom edges. */
function slab(shape: THREE.Shape, z0: number, z1: number, ch: number) {
  const c = Math.min(ch, (z1 - z0) / 2 - 0.05)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: z1 - z0 - 2 * Math.max(0, c),
    bevelEnabled: c > 0,
    bevelThickness: c,
    bevelSize: c,
    bevelOffset: -c,
    bevelSegments: 1,
    curveSegments: 24,
  })
  g.translate(0, 0, z0 + Math.max(0, c))
  return g
}

/** A tube (boss) around (x, y) from z0 to z1. */
function tube(x: number, y: number, ri: number, ro: number, z0: number, z1: number) {
  const g = lathe(
    [
      [ri, z0],
      [ro, z0],
      [ro, z1],
      [ri, z1],
      [ri, z0],
    ],
    Math.PI * 2,
    40,
  )
  g.translate(x, y, 0)
  return g
}

/** A part material that, like the kit's, paints the inside of a cut solid flat: here in its own colour, so A and B read apart in section. */
function cutMaterial(clipping: THREE.Plane[]) {
  const uCut = { value: new THREE.Color() }
  const m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clipping, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  m.userData.uCut = uCut
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCutColor = uCut
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uCutColor;")
      .replace("#include <opaque_fragment>", "#include <opaque_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(uCutColor, 1.0);")
  }
  m.customProgramCacheKey = () => "gap-flush-cut"
  return m
}
