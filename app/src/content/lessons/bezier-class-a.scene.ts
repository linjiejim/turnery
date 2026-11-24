import * as THREE from "three"
import type { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { face, label, line } from "@/three/build"
import type { V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { t } from "@/lib/i18n"
import { LessonScene } from "./scene"
import { countInflections, knotSpans, sampleCurve, secondDiffs } from "./nurbs-curves.nurbs"
import { comb, dragHandle, fixedDot, styleHandle } from "./nurbs-curves.draw"
import { bezierPatch, elevateNet, evalPatch, gridNet, isoparm, patchGeometry, patchOf, section, zebraMaterial, type Patch, type V3 } from "./bezier-class-a.surface"

/**
 * 5.4.3 · 5.4.4 「Bezier 与 NURBS、单跨度面与升阶；Class-A 的概念与质量标准」: a gently crowned
 * panel with its control net. One net read three ways (single-span degree 5, three cubic spans,
 * four quadratic spans) with a curvature comb on a section and zebra stripes; degree elevation
 * that adds points without changing the shape; a lumpy row of the net to smooth by hand; two
 * patches joined G1 / G2 / G3; and a blind pick of the sample closest to Class-A.
 */
export type Reading = "bezier" | "cubic" | "quadratic"
export type Joint = "G1" | "G2" | "G3"

export type ClassAState = {
  step: number
  zebra: boolean
  reading: Reading
  net: V3[][]
  /** Degree elevations done in the elevation step (0–2). */
  elev: number
  joint: Joint
  sample: number
  guess: number | null
  focus: [number, number] | null
  /** Turns in the wrong direction along the lumpy row of the net. */
  folds: number
  inflections: number
  dragged: boolean
  readings: Reading[]
  smoothed: boolean
  joints: Joint[]
  guessedRight: boolean
}

const W = 160
const H = 100
const ZU = [0, 10, 16, 18, 15, 8]
const ZV = [0, 5, 6, 3]
/** Row 1 of the net, pushed up and down: the lumpy polygon to smooth. */
const LUMPS = [0, 3.5, -4, 4.5, -3, 0]
const LUMPY_ROW = 1
const KEY_POS = new THREE.Vector3(70, -340, 210)
const KEY_TARGET = new THREE.Vector3(0, 2, 6)

export const baseNet = (): V3[][] => gridNet(6, 4, W, H, (i, j) => ZU[i] + ZV[j])
export const lumpyNet = (): V3[][] => gridNet(6, 4, W, H, (i, j) => ZU[i] + ZV[j] + (j === LUMPY_ROW ? LUMPS[i] : 0))
/** A bicubic patch for the elevation step. */
const cubicNet = (): V3[][] => gridNet(4, 4, W, H, (i, j) => [0, 15, 17, 6][i] + [0, 6, 6, 1][j])
/** The same crown with ten cubic columns: 7 spans along u. */
const denseNet = (): V3[][] => {
  const bz = bezierPatch(baseNet())
  const U = patchOf(gridNet(10, 4, W, H, () => 0), 3, 3).Uu
  return Array.from({ length: 10 }, (_, i) => {
    let g = 0
    for (let k = 1; k <= 3; k++) g += U[i + k]
    g /= 3
    // The crown is separable (z = profile(u) + ZV[j]): sample the profile at this column's Greville point.
    const profile = evalPatch(bz, g, 0).p.z - ZV[0]
    return Array.from({ length: 4 }, (_, j) => [-W / 2 + W * g, -H / 2 + (H * j) / 3, profile + ZV[j]] as V3)
  })
}

/** Heights of a profile row, for joining two patches with continuity k across their seam. */
const PA = [0, 9, 15, 18, 19.5, 19.4]
const PB = [19.4, 19.3, 15.5, 11.5, 5, -5]

/** B's leading heights forced so the forward differences at the seam match A's (C^k → G^k). */
export function joinProfile(a: number[], b: number[], k: number) {
  const out = [...b]
  const n = a.length - 1
  out[0] = a[n]
  // Δ^r b_0 = Δ^r a_{n−r} for r = 1..k with equal spacing and degree: solve for b_r in turn.
  for (let r = 1; r <= k; r++) {
    let diffA = 0
    for (let m = 0; m <= r; m++) diffA += (-1) ** (r - m) * binom(r, m) * a[n - r + m]
    let rest = 0
    for (let m = 0; m < r; m++) rest += (-1) ** (r - m) * binom(r, m) * out[m]
    out[r] = diffA - rest
  }
  return out
}

function binom(n: number, k: number) {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

const JOINT_K: Record<Joint, number> = { G1: 1, G2: 2, G3: 3 }

function pairNets(joint: Joint): [V3[][], V3[][]] {
  const b = joinProfile(PA, PB, JOINT_K[joint])
  const zv = [0, 4, 5, 2]
  const A = gridNet(6, 4, 100, H, (i, j) => PA[i] + zv[j], -100)
  const B = gridNet(6, 4, 100, H, (i, j) => b[i] + zv[j], 0)
  return [A, B]
}

/** Samples in the blind test: what each one is. */
export const SAMPLES = ["dense", "smooth", "lumpy"] as const
export type SampleKind = (typeof SAMPLES)[number]

export function samplePatch(kind: SampleKind): Patch {
  if (kind === "dense") return patchOf(denseNet(), 3, 3)
  return bezierPatch(kind === "lumpy" ? lumpyNet() : baseNet())
}

export function readingPatch(net: V3[][], r: Reading): Patch {
  return r === "bezier" ? bezierPatch(net) : patchOf(net, r === "cubic" ? 3 : 2, net[0].length - 1)
}

function folds(net: V3[][]) {
  return secondDiffs(net.map((col) => col[LUMPY_ROW][2])).filter((d) => d > -0.3).length
}

export class ClassAScene extends LessonScene<ClassAState> {
  private surf = new THREE.Group()
  private wires = new THREE.Group()
  private marks = new THREE.Group()
  private handles: CSS2DObject[][] = []
  private dots: CSS2DObject[] = []
  private zebraMat = zebraMaterial()
  private teethMat = new THREE.LineBasicMaterial({ depthTest: false, transparent: true, opacity: 0.8 })
  private envMat = new THREE.LineBasicMaterial({ depthTest: false })
  private animNet: V3[][] | null = null
  /** Bumped when an elevation tween is cancelled, so its ending doesn't land later on. */
  private elevRun = 0

  constructor(v: Viewer, emit: (s: ClassAState) => void) {
    super(v, emit, {
      step: 0,
      zebra: false,
      reading: "bezier",
      net: baseNet(),
      elev: 0,
      joint: "G1",
      sample: 0,
      guess: null,
      focus: null,
      folds: 0,
      inflections: 0,
      dragged: false,
      readings: ["bezier"],
      smoothed: false,
      joints: [],
      guessedRight: false,
    })
    v.setGrid(150, 10)
    v.showGrid(false)
    this.root.add(this.surf, this.wires, this.marks)
    for (let i = 0; i < 6; i++) {
      const col: CSS2DObject[] = []
      for (let j = 0; j < 4; j++) {
        const h = dragHandle(v, {
          plane: () => {
            const p = this.state.net[i][j]
            const f = v.forward().setZ(0)
            if (f.lengthSq() < 1e-6) f.set(0, 1, 0)
            return new THREE.Plane().setFromNormalAndCoplanarPoint(f.normalize(), new THREE.Vector3(p[0], p[1], p[2]))
          },
          move: (hit) => this.dragPoint(i, j, Math.max(-25, Math.min(60, hit.z))),
          hover: (on) => {
            if (on && this.state.step <= 1) this.set({ focus: [i, j] })
          },
        })
        col.push(h)
        this.root.add(h)
      }
      this.handles.push(col)
    }
    for (let k = 0; k < 50; k++) {
      const d = fixedDot()
      this.dots.push(d)
      this.root.add(d)
    }
  }

  enter(step: number) {
    const s = this.state
    this.stopElevation()
    const patch: Partial<ClassAState> = { step, focus: null }
    if (step === 0) Object.assign(patch, { zebra: false, reading: "bezier", net: baseNet() })
    if (step === 1) Object.assign(patch, { zebra: true, net: s.step === 0 ? s.net : baseNet(), reading: s.reading })
    if (step === 2) Object.assign(patch, { zebra: false, elev: 0 })
    if (step === 3) Object.assign(patch, { zebra: true, reading: "bezier", net: lumpyNet() })
    if (step === 4) Object.assign(patch, { zebra: true, joints: s.joints.includes(s.joint) ? s.joints : [...s.joints, s.joint] })
    if (step === 5) Object.assign(patch, { zebra: true, sample: 0, guess: null })
    this.update(patch)
    const pos = step === 4 ? new THREE.Vector3(80, -430, 260) : step === 3 ? new THREE.Vector3(60, -350, 160) : KEY_POS.clone()
    this.v.flyTo(pos, KEY_TARGET.clone(), 900)
  }

  // ------------------------------------------------------------ actions

  setZebra(zebra: boolean) {
    this.set({ zebra })
  }

  setReading(reading: Reading) {
    const s = this.state
    this.set({ reading, readings: s.readings.includes(reading) ? s.readings : [...s.readings, reading] })
  }

  setJoint(joint: Joint) {
    const s = this.state
    this.set({ joint, joints: s.joints.includes(joint) ? s.joints : [...s.joints, joint] })
  }

  setSample(sample: number) {
    this.set({ sample, guess: null })
  }

  guess() {
    const s = this.state
    this.set({ guess: s.sample, guessedRight: s.guessedRight || SAMPLES[s.sample] === "smooth" })
  }

  /** Raise the degree one step both ways, sliding the new points along the old net. */
  elevateOnce() {
    const s = this.state
    if (s.elev >= 2 || this.animNet) return
    const from = this.elevNet(s.elev)
    const run = this.elevRun
    this.v.tweens
      .run(
        1000,
        (k) => {
          this.animNet = elevateNet(from, k)
          this.render()
        },
        { tag: "elevate" },
      )
      .then(() => {
        if (run !== this.elevRun) return
        this.animNet = null
        this.set({ elev: s.elev + 1 })
      })
  }

  resetElevation() {
    this.stopElevation()
    this.set({ elev: 0 })
  }

  private stopElevation() {
    this.elevRun++
    this.v.tweens.cancel("elevate")
    this.animNet = null
  }

  resetNet() {
    this.update({ net: this.state.step === 3 ? lumpyNet() : baseNet() })
  }

  elevNet(e: number) {
    let n = cubicNet()
    for (let i = 0; i < e; i++) n = elevateNet(n)
    return n
  }

  /** Largest distance between the bicubic patch and the elevated one, sampled (mm). */
  elevationError() {
    const a = bezierPatch(cubicNet())
    const b = bezierPatch(this.elevNet(this.state.elev))
    let e = 0
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) e = Math.max(e, evalPatch(a, i / 8, j / 8).p.distanceTo(evalPatch(b, i / 8, j / 8).p))
    return e
  }

  private dragPoint(i: number, j: number, z: number) {
    const s = this.state
    if (s.step === 3 && (j !== LUMPY_ROW || i === 0 || i === 5)) return
    if (s.step > 3 || s.step === 2) return
    const net = s.net.map((col) => col.map((p) => [...p] as V3))
    net[i][j][2] = z
    this.update({ net, focus: [i, j], dragged: true })
  }

  private update(patch: Partial<ClassAState>) {
    const next = { ...this.state, ...patch }
    const f = folds(next.net)
    const sec = section(bezierPatch(next.net), 1 / 3)
    const infl = countInflections(sampleCurve(sec.curve, 40), 1e-4)
    this.set({ ...patch, folds: f, inflections: infl, smoothed: this.state.smoothed || (next.step === 3 && f === 0 && infl === 0) })
  }

  // ------------------------------------------------------------ rendering

  /** What the viewport shows: one patch or two, and which section gets a comb. */
  private shown(): { patches: Patch[]; v0: number; editable: boolean } {
    const s = this.state
    if (s.step === 2) return { patches: [bezierPatch(this.elevNet(s.elev))], v0: 0.5, editable: false }
    if (s.step === 3) return { patches: [bezierPatch(s.net)], v0: 1 / 3, editable: true }
    if (s.step === 4) return { patches: pairNets(s.joint).map((n) => bezierPatch(n)), v0: 0.5, editable: false }
    if (s.step === 5) return { patches: [samplePatch(SAMPLES[s.sample])], v0: 1 / 3, editable: false }
    return { patches: [readingPatch(s.net, s.step === 0 ? "bezier" : s.reading)], v0: 0.5, editable: true }
  }

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.surf)
    this.clear(this.wires)
    this.clear(this.marks)
    const u = this.zebraMat.uniforms
    ;(u.uA.value as THREE.Color).copy(tk.defined)
    ;(u.uB.value as THREE.Color).copy(tk.bg)
    this.teethMat.color.copy(tk.edgeSoft)
    this.envMat.color.copy(tk.sketch)

    const { patches, v0, editable } = this.shown()
    const muted = "border-transparent bg-transparent font-sans text-muted-foreground"
    patches.forEach((p) => {
      const m = face(patchGeometry(p), kit, { feature: "patch", edges: false })
      if (s.zebra) m.material = this.zebraMat
      this.surf.add(m)
      // Patch boundary.
      for (const at of [0, 1]) {
        this.wires.add(thinLine(isoparm(p, "u", at, 0, 1, 24, 0.1), kit.edge))
        this.wires.add(thinLine(isoparm(p, "v", at, 0, 1, 48, 0.1), kit.edge))
      }
      // Span boundaries inside the patch.
      for (const sp of knotSpans({ pts: p.net.map(() => [0, 0] as V2), p: p.pu, U: p.Uu }).slice(1))
        this.wires.add(line(isoparm(p, "u", sp.a, 0, 1, 24, 0.3), kit.sketch))
      // The section with its comb.
      const sec = section(p, v0)
      // About 160 teeth across the patch, however many spans it has.
      const smp = sampleCurve(sec.curve, Math.max(10, Math.round(160 / (p.net.length - p.pu))))
      const to3 = (q: V2) => new THREE.Vector3(q[0], sec.y, q[1] + 0.35)
      this.wires.add(line(smp.map((q) => to3(q.p)), kit.sketchDefined))
      this.wires.add(comb(smp, s.step === 4 ? 4000 : 6000, kit, { maxTooth: 34, to3, teeth: this.teethMat, envelope: this.envMat }))
    })

    // The control net: dashed rows and columns.
    const net = this.animNet ?? (s.step === 2 ? this.elevNet(s.elev) : s.step === 4 ? null : s.step === 5 ? samplePatch(SAMPLES[s.sample]).net : s.net)
    const nets = s.step === 4 ? pairNets(s.joint) : net ? [net] : []
    for (const n of nets) {
      for (const col of n) this.wires.add(line(col.map(v3), kit.construction))
      for (let j = 0; j < n[0].length; j++) this.wires.add(line(n.map((col) => v3(col[j])), kit.construction))
    }
    if (s.step === 2 && (this.animNet || s.elev > 0)) {
      // The net before this elevation, faint: the new points sit on its legs.
      const old = this.elevNet(this.animNet ? s.elev : s.elev - 1)
      for (const col of old) this.wires.add(thinLine(col.map(v3), kit.edgeSoft))
      for (let j = 0; j < old[0].length; j++) this.wires.add(thinLine(old.map((col) => v3(col[j])), kit.edgeSoft))
    }
    if (s.step === 3) {
      const row = s.net.map((col) => v3(col[LUMPY_ROW]))
      this.wires.add(line(row, kit.path))
    }

    // Reach of the focused point (steps 0–1): the part of the patch it can move.
    if (s.focus && s.step <= 1) {
      const p = patches[0]
      const [i, j] = s.focus
      const ua = p.Uu[i]
      const ub = p.Uu[i + p.pu + 1]
      const va = p.Uv[j]
      const vb = p.Uv[j + p.pv + 1]
      const loop = [...isoparm(p, "v", va, ua, ub, 24, 0.5), ...isoparm(p, "u", ub, va, vb, 16, 0.5), ...isoparm(p, "v", vb, ub, ua, 24, 0.5), ...isoparm(p, "u", ua, vb, va, 16, 0.5)]
      this.wires.add(line(loop, kit.sketch))
      const mid = evalPatch(p, (ua + ub) / 2, (va + vb) / 2).p
      const whole = ua === 0 && ub === 1 && va === 0 && vb === 1
      this.marks.add(label(whole ? t("影响整块面", "Moves the whole patch") : t("只影响框内", "Moves only inside the frame"), mid.add(new THREE.Vector3(0, 0, 4)), "border-primary font-sans text-primary"))
    }

    if (s.step === 4) {
      this.marks.add(label("A", new THREE.Vector3(-90, -H / 2 - 10, 0), muted))
      this.marks.add(label("B", new THREE.Vector3(90, -H / 2 - 10, 0), muted))
    }

    // Handles: draggable where the step edits the net, plain dots elsewhere.
    const handleNet = editable ? s.net : null
    this.handles.forEach((col, i) =>
      col.forEach((h, j) => {
        const draggable = !!handleNet && (s.step !== 3 || (j === LUMPY_ROW && i > 0 && i < 5))
        h.visible = draggable
        if (!draggable) return
        const p = handleNet![i][j]
        h.position.set(p[0], p[1], p[2])
        styleHandle(h.element, "point", !!s.focus && s.focus[0] === i && s.focus[1] === j)
        h.element.title = t("上下拖动控制点", "Drag the control point up or down")
      }),
    )
    const dotPts: V3[] = []
    if (!editable) for (const n of nets.length ? nets : []) for (const col of n) for (const p of col) dotPts.push(p)
    if (s.step === 3) s.net.forEach((col, i) => col.forEach((p, j) => !(j === LUMPY_ROW && i > 0 && i < 5) && dotPts.push(p)))
    if (this.animNet) dotPts.splice(0, dotPts.length, ...this.animNet.flat())
    this.dots.forEach((d, k) => {
      d.visible = k < dotPts.length
      if (d.visible) d.position.set(...dotPts[k])
    })
    this.v.invalidate()
  }

  dispose() {
    this.v.showGrid(true)
    super.dispose()
    this.zebraMat.dispose()
    this.teethMat.dispose()
    this.envMat.dispose()
  }
}

const v3 = (p: V3) => new THREE.Vector3(p[0], p[1], p[2])

function thinLine(pts: THREE.Vector3[], mat: THREE.LineBasicMaterial) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
  l.raycast = () => {}
  return l
}
