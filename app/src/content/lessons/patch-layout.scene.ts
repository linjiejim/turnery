import * as THREE from "three"
import { face, tag } from "@/three/build"
import type { Viewer } from "@/three/viewer"
import { t } from "@/lib/i18n"
import { LessonScene } from "./scene"
import {
  PATCHES,
  SEG_N,
  blendFn,
  dome,
  domeNormal,
  fitA,
  layerOf,
  outlineA,
  plan,
  radialGrid,
  roleOf,
  topBoundary,
  trimmedIsoLines,
  twinOf,
  wallFn,
  type MouseParams,
  type PatchId,
  type Role,
} from "./patch-layout.mouse"
import { gridGeometry, isoCurves, noPick, orient, paintZebra, params, sampleGrid, segmentsGeometry, zebraMaterial, type Grid } from "./patch-layout.surf"

/**
 * 5.4.1 「分面/布面」: a mouse-like shell built as one big trimmed surface (A) and as a hierarchy of
 * primary surfaces, transitions and corner patches (B). Isoparms and zebra stripes compare them; the
 * learner labels B's patches by clicking, then steps through the build order.
 */
export type Display = "shade" | "iso" | "zebra"

export type PatchState = {
  step: number
  display: Display
  h0: number
  ts: number
  labels: Partial<Record<PatchId, Role>>
  brush: Role
  last: PatchId | null
  layer: number
  steppedAll: boolean
  h0Changed: boolean
  tsChanged: boolean
  orbited: boolean
  zebraSeen: boolean
}

const SIDE = 40
const KEY_DIR = new THREE.Vector3(0.32, -1, 0.85)

export class PatchScene extends LessonScene<PatchState> {
  private a = new THREE.Group()
  private b = new THREE.Group()
  private marks = new THREE.Group()
  private meshes = new Map<PatchId, THREE.Mesh>()
  private aMeshes: THREE.Mesh[] = []
  private zebra = zebraMaterial()
  private hover: PatchId | null = null
  private down: { x: number; y: number } | null = null
  private geoKey = ""
  private trackOrbit = false
  private keyDir = KEY_DIR.clone()

  constructor(v: Viewer, emit: (s: PatchState) => void) {
    super(v, emit, {
      step: 0,
      display: "iso",
      h0: 38,
      ts: 8,
      labels: {},
      brush: "primary",
      last: null,
      layer: 3,
      steppedAll: false,
      h0Changed: false,
      tsChanged: false,
      orbited: false,
      zebraSeen: false,
    })
    v.setGrid(120, 10)
    this.root.add(this.a, this.b, this.marks)

    const el = v.renderer.domElement
    const onMove = (e: PointerEvent) => {
      if (e.buttons || this.state.step !== 2) return
      const id = this.pickId(e)
      if (id !== this.hover) {
        this.hover = id
        el.style.cursor = id ? "pointer" : ""
        this.paint()
      }
    }
    const onDown = (e: PointerEvent) => (this.down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null)
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 || this.state.step !== 2) return
      const id = this.pickId(e)
      if (id) this.label(id)
    }
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => {
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
      el.style.cursor = ""
    })
    this.own(
      v.onCameraChange(() => {
        if (!this.trackOrbit || this.state.orbited) return
        const d = v.camera.position.clone().sub(v.controls.target).normalize()
        if (d.angleTo(this.keyDir) > THREE.MathUtils.degToRad(20)) this.set({ orbited: true })
      }),
    )
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<PatchState> = { step, last: null }
    if (step === 0) patch.display = "iso"
    if (step === 1) patch.display = s.display === "zebra" ? "zebra" : "iso"
    if (step === 2 || step === 3) patch.display = "shade"
    if (step === 3) patch.layer = 1
    if (step !== 3) patch.layer = 3
    if (step === 4) patch.display = "zebra"
    this.hover = null
    this.set(patch)
    this.trackOrbit = false
    const both = step <= 1
    const target = new THREE.Vector3(0, 0, 16)
    this.keyDir = (step === 4 ? new THREE.Vector3(0.75, -1, 0.55) : step >= 2 ? new THREE.Vector3(0.6, -1, 0.95) : KEY_DIR).clone().normalize()
    const dist = both ? 300 : 270
    this.v.flyTo(target.clone().addScaledVector(this.keyDir, dist), target, 850).then(() => (this.trackOrbit = this.state.step === 0))
  }

  // ------------------------------------------------------------ actions

  setDisplay(display: Display) {
    this.set({ display, zebraSeen: this.state.zebraSeen || (display === "zebra" && this.state.step === 1) })
  }

  setBrush(brush: Role) {
    this.set({ brush })
  }

  label(id: PatchId) {
    const s = this.state
    const labels = { ...s.labels, [id]: s.brush, [twinOf(id)]: s.brush }
    this.set({ labels, last: id })
  }

  clearLabels() {
    this.set({ labels: {}, last: null })
  }

  setLayer(layer: number) {
    this.set({ layer, steppedAll: this.state.steppedAll || layer === 3 })
  }

  setH0(h0: number) {
    this.set({ h0, h0Changed: this.state.h0Changed || this.state.step === 3 })
  }

  setTs(ts: number) {
    this.set({ ts, tsChanged: this.state.tsChanged || (this.state.step === 4 && this.state.display === "zebra") })
  }

  resetView() {
    const target = new THREE.Vector3(0, 0, 16)
    this.v.flyTo(target.clone().addScaledVector(this.keyDir, this.state.step <= 1 ? 300 : 270), target, 700)
  }

  /** How many patches carry the right label. */
  static score(s: PatchState) {
    const right = PATCHES.filter((id) => s.labels[id] === roleOf(id)).length
    const done = PATCHES.filter((id) => s.labels[id]).length
    return { right, done, total: PATCHES.length }
  }

  private pickId(e: PointerEvent): PatchId | null {
    const hit = this.v.pick(e, [...this.meshes.values()], false)
    return (hit?.object.userData.feature as PatchId | undefined) ?? null
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const both = s.step <= 1
    const key = [s.h0, s.ts, both, s.step === 3 ? s.layer : 3, s.display === "iso", this.v.tokens.dark].join("|")
    if (key !== this.geoKey) {
      this.geoKey = key
      this.build()
    }
    this.paint()
  }

  private build() {
    const s = this.state
    const kit = this.v.kit
    const p: MouseParams = { h0: s.h0, ts: s.ts }
    const both = s.step <= 1
    const iso = s.display === "iso"
    this.clear(this.a)
    this.clear(this.b)
    this.clear(this.marks)
    this.meshes.clear()
    this.aMeshes = []
    this.a.visible = both
    this.a.position.x = -SIDE
    this.b.position.x = both ? SIDE : 0
    const layer = s.step === 3 ? s.layer : 3

    // ---- B: primaries, transitions, corner patches
    const add = (id: PatchId, g: Grid) => {
      const m = face(gridGeometry(g), kit, { feature: id, edges: false })
      this.meshes.set(id, m)
      this.b.add(m)
    }
    const boundaryTop = topBoundary(p, layer === 1)
    add("top", radialGrid(boundaryTop, (x, y) => dome(p, x, y), domeNormal, 14))
    const lines: THREE.Vector3[][] = []
    const isos: THREE.Vector3[][] = []
    for (let k = 0; k < 8; k++) {
      const m = plan(k, 0.5).m
      const ref = new THREE.Vector3(m[0], m[1], 1)
      const extended = layer === 1 && k % 2 === 0
      const wall = wallFn(p, k, extended)
      if (layer > 1 || k % 2 === 0) {
        add(`w${k}`, orient(sampleGrid(wall, SEG_N[k], 4), ref))
        lines.push(...isoCurves(wall, [0, 1], [0, 1], 24))
        if (iso) isos.push(...isoCurves(wall, params(k % 2 ? 2 : k % 4 === 0 ? 4 : 2), [0.5], 16))
      }
      const blend = blendFn(p, k)
      add(`b${k}`, orient(sampleGrid(blend, SEG_N[k], 10), ref))
      if (layer >= layerOf(`b${k}`)) {
        lines.push(...isoCurves(blend, [0, 1], [0, 1], 24))
        if (iso) isos.push(...isoCurves(blend, params(k % 2 ? 2 : k % 4 === 0 ? 4 : 2), [1 / 3, 2 / 3], 24))
      }
      if (layer === 1 && k % 2 === 1) add(`w${k}`, orient(sampleGrid(wallFn(p, k), SEG_N[k], 4), ref))
    }
    const loop = [...boundaryTop, boundaryTop[0]].map((q) => new THREE.Vector3(q[0], q[1], dome(p, q[0], q[1])))
    lines.push(loop)
    if (iso) isos.push(...trimmedIsoLines(boundaryTop, [-20, -10, 0, 10, 20], [-42, -28, -14, 0, 14, 28, 42], (x, y) => dome(p, x, y)))
    this.b.add(noPick(new THREE.LineSegments(segmentsGeometry(lines), kit.edge)))
    if (isos.length) this.b.add(noPick(new THREE.LineSegments(segmentsGeometry(isos), kit.edgeSoft)))

    // ---- A: one spline surface for top and edge roll, trimmed hard by the wall
    if (both) {
      const fit = fitA(p)
      const outline = outlineA()
      const top = face(gridGeometry(radialGrid(outline, fit.h, fit.n, 18)), kit, { feature: "a-top", edges: false })
      const wallG: Grid = { pos: [[], []], nor: [[], []] }
      const ring = [...outline, outline[0]]
      ring.forEach((q, i) => {
        const prev = ring[(i - 1 + ring.length - 1) % (ring.length - 1)]
        const next = ring[(i + 1) % (ring.length - 1)]
        const tx = next[0] - prev[0]
        const ty = next[1] - prev[1]
        const n = new THREE.Vector3(ty, -tx, 0).normalize()
        wallG.pos[0].push(new THREE.Vector3(q[0], q[1], 0))
        wallG.pos[1].push(new THREE.Vector3(q[0], q[1], fit.h(q[0], q[1])))
        wallG.nor[0].push(n)
        wallG.nor[1].push(n.clone())
      })
      const wall = face(gridGeometry(wallG), kit, { feature: "a-wall", edges: false })
      this.aMeshes = [top, wall]
      this.a.add(top, wall)
      const aLines = [wallG.pos[0], wallG.pos[1]]
      this.a.add(noPick(new THREE.LineSegments(segmentsGeometry(aLines), kit.edge)))
      if (iso) this.a.add(noPick(new THREE.LineSegments(segmentsGeometry(trimmedIsoLines(outline, fit.xs.slice(1, -1), fit.ys.slice(1, -1), fit.h)), kit.edgeSoft)))
      this.marks.add(tag(t("A · 一张大面，硬剪裁", "A · one big surface, trimmed hard"), new THREE.Vector3(-SIDE, -30, s.h0 + 12)))
      this.marks.add(tag(t("B · 主面、过渡面、角片", "B · primaries, transitions, corners"), new THREE.Vector3(SIDE, -30, s.h0 + 12)))
    }
    this.v.invalidate()
  }

  /** Materials only: labels, hover, layers, zebra. */
  private paint() {
    const s = this.state
    const kit = this.v.kit
    paintZebra(this.zebra, this.v.tokens, 9)
    const roleMat = (r: Role) => (r === "primary" ? kit.highlight : r === "transition" ? kit.added : kit.modified)
    for (const [id, m] of this.meshes) {
      if (s.display === "zebra") m.material = this.zebra
      else if (s.step === 2) m.material = id === this.hover || (this.hover && twinOf(this.hover) === id) ? kit.hovered : s.labels[id] ? roleMat(s.labels[id]!) : kit.model
      else if (s.step === 3) m.material = layerOf(id) <= s.layer ? roleMat(roleOf(id)) : kit.ghost
      else m.material = kit.model
    }
    for (const m of this.aMeshes) m.material = s.display === "zebra" ? this.zebra : kit.model
    this.v.invalidate()
  }

  dispose() {
    super.dispose()
    this.zebra.dispose()
  }
}
